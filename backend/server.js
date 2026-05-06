const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const { pool, initializeDatabase } = require("./database");

const app = express();
// Backend should run on a dedicated API port (3001) when static frontend uses 3000
const PORT = process.env.PORT || 3002;

function isAllowedOrigin(origin) {
  if (!origin) return true;

  try {
    const parsed = new URL(origin);
    const host = parsed.hostname;
    const port = parsed.port;

    if (!port || (port !== "3000" && port !== "3002")) {
      return false;
    }

    if (host === "localhost" || host === "127.0.0.1") {
      return true;
    }

    // Allow private-network clients (common LAN ranges)
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
      return true;
    }
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
      return true;
    }
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) {
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

// Initialize database on startup
(async () => {
  try {
    const { initializeDatabase } = require("./database");
    await initializeDatabase();
    console.log("✓ Database initialized successfully");
  } catch (error) {
    console.log("✗ Database initialization error:", error.message);
  }
})();

app.use(
  cors({
    origin: function (origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: Origin not allowed (${origin})`));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
    credentials: true,
  }),
);
app.options("*", cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));

// Serve uploaded files - using custom route handler instead of static middleware
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
console.log(`[INIT] Uploads directory: ${uploadsDir}`);

// Serve data directory
app.use("/data", express.static(path.join(__dirname, "../resources/json")));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}_${file.originalname}`);
  },
});

const uploadMiddleware = multer({ storage });

// ============================================
// DIAGNOSTICS ENDPOINTS
// ============================================

// Client info endpoint for network diagnostics
app.get("/api/client-info", (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress || "unknown";
  const origin = req.get("origin") || req.get("referer") || "unknown";
  res.json({
    ip: clientIp,
    origin: origin,
    hostname: req.hostname,
    method: req.method,
    protocol: req.protocol,
    userAgent: req.get("user-agent"),
  });
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query("SELECT 1");
    connection.release();
    res.json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      database: "disconnected",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// ACTIVITIES ENDPOINTS
// ============================================

// Get all activities
app.get("/api/activities", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM activities ORDER BY created_at DESC",
    );
    connection.release();
    res.json(rows || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get activity by ID
app.get("/api/activities/:id", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM activities WHERE id = ?",
      [req.params.id],
    );
    connection.release();

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Activity not found" });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new activity
app.post("/api/activities", async (req, res) => {
  const { name, venue, date, source = "saved", created_by } = req.body;

  if (!name || !venue || !date) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const connection = await pool.getConnection();
    const id = uuidv4();
    await connection.query(
      "INSERT INTO activities (id, name, venue, date, source, created_by) VALUES (?, ?, ?, ?, ?, ?)",
      [id, name, venue, date, source, created_by],
    );
    connection.release();
    res.status(201).json({ id, name, venue, date, source, created_by });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update activity
app.put("/api/activities/:id", async (req, res) => {
  const { name, venue, date } = req.body;

  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      "UPDATE activities SET name = ?, venue = ?, date = ? WHERE id = ?",
      [name, venue, date, req.params.id],
    );
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Activity not found" });
    }
    res.json({ id: req.params.id, name, venue, date });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete activity
app.delete("/api/activities/:id", async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Remove dependent records first. This avoids FK errors in older schemas
    // where ON DELETE CASCADE may not be present on attendance/files tables.
    await connection.query("DELETE FROM attendance WHERE activity_id = ?", [
      req.params.id,
    ]);
    await connection.query("DELETE FROM UploadedFile WHERE activity_id = ?", [
      req.params.id,
    ]);
    await connection.query("DELETE FROM files WHERE activity_id = ?", [
      req.params.id,
    ]);

    const [result] = await connection.query(
      "DELETE FROM activities WHERE id = ?",
      [req.params.id],
    );

    if (result.affectedRows === 0) {
      connection.release();
      return res.status(404).json({ error: "Activity not found" });
    }

    connection.release();
    res.json({ message: "Activity deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ATTENDANCE ENDPOINTS
// ============================================
// ATTENDANCE SUMMARY (must come before :activity_id parameterized route)
// ============================================

app.get("/api/attendance/summary", async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Get count of attendance records per activity
    const [attStats] = await connection.query(
      `SELECT activity_id, COUNT(*) as att_count, MAX(created_at) as latest_att FROM attendance GROUP BY activity_id`,
    );

    // Get count of files per activity
    const [fileStats] = await connection.query(
      `SELECT activity_id, COUNT(*) as file_count, MAX(upload_date) as latest_file FROM files GROUP BY activity_id`,
    );

    // Get all activities
    const [activities] = await connection.query(
      `SELECT id AS activity_id, name, venue, date, created_at FROM activities ORDER BY created_at DESC`,
    );

    connection.release();

    // Build the summary by combining the data
    const summary = activities.map((activity) => {
      const attStat = attStats.find(
        (a) => a.activity_id === activity.activity_id,
      );
      const fileStat = fileStats.find(
        (f) => f.activity_id === activity.activity_id,
      );

      const attCount = attStat?.att_count || 0;
      const fileCount = fileStat?.file_count || 0;
      const totalCount = Math.max(attCount, fileCount); // Use the larger count

      const hasSubmission = attCount > 0 || fileCount > 0;
      const lastSaved = attStat?.latest_att || fileStat?.latest_file;

      return {
        activity_id: activity.activity_id,
        name: activity.name,
        venue: activity.venue,
        date: activity.date,
        record_count: totalCount,
        last_saved: lastSaved,
        status: hasSubmission ? "Submitted" : "Not Yet Submitted",
        date_submitted: lastSaved,
      };
    });

    // Sort by submission status, then by last_saved date
    summary.sort((a, b) => {
      if (a.record_count > 0 !== b.record_count > 0) {
        return b.record_count > 0 ? 1 : -1;
      }
      return new Date(b.last_saved || 0) - new Date(a.last_saved || 0);
    });

    res.json(summary);
  } catch (error) {
    console.error("Attendance summary error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get attendance records for an activity
app.get("/api/attendance/:activity_id", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM attendance WHERE activity_id = ? ORDER BY row_number",
      [req.params.activity_id],
    );
    connection.release();
    res.json(rows || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save attendance record
app.post("/api/attendance", async (req, res) => {
  const {
    activity_id,
    row_number,
    name,
    sex,
    office,
    position,
    contact,
    signature,
  } = req.body;

  if (!activity_id || !row_number) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const connection = await pool.getConnection();
    const id = uuidv4();
    await connection.query(
      `INSERT INTO attendance (id, activity_id, row_number, name, sex, office, position, contact, signature)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        activity_id,
        row_number,
        name || null,
        sex || null,
        office || null,
        position || null,
        contact || null,
        signature || null,
      ],
    );
    connection.release();
    res.status(201).json({
      id,
      activity_id,
      row_number,
      name,
      sex,
      office,
      position,
      contact,
      signature,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update attendance record
app.put("/api/attendance/:id", async (req, res) => {
  const { name, sex, office, position, contact, signature } = req.body;

  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      `UPDATE attendance SET name = ?, sex = ?, office = ?, position = ?, contact = ?, signature = ? WHERE id = ?`,
      [
        name || null,
        sex || null,
        office || null,
        position || null,
        contact || null,
        signature || null,
        req.params.id,
      ],
    );
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Attendance record not found" });
    }
    res.json({
      id: req.params.id,
      name,
      sex,
      office,
      position,
      contact,
      signature,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete attendance record
app.delete("/api/attendance/:id", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      "DELETE FROM attendance WHERE id = ?",
      [req.params.id],
    );
    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Attendance record not found" });
    }
    res.json({ message: "Attendance record deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: Generate CSV from attendance records
function generateAttendanceCSV(activityName, records) {
  const headers = [
    "No",
    "Name",
    "Sex",
    "Office / Municipality / School",
    "Position / Course",
    "Contact Number",
    "Signature",
  ];

  // Create CSV content
  const csvLines = [headers.join(",")];

  records.forEach((record) => {
    const values = [
      record.row_number || "",
      record.name || "",
      record.sex || "",
      record.office || "",
      record.position || "",
      record.contact || "",
      record.signature || "",
    ];
    // Properly escape CSV values with quotes if they contain commas or quotes
    const escapedValues = values.map((val) => {
      const str = String(val || "");
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvLines.push(escapedValues.join(","));
  });

  return csvLines.join("\n");
}

// Batch save attendance (for entire sheet)
app.post("/api/attendance/batch/:activity_id", async (req, res) => {
  const activityId = req.params.activity_id;
  const { records, uploaded_by } = req.body;

  console.log("[BATCH] Backend received attendance submission:", {
    activityId,
    recordsCount: records?.length,
    uploadedBy: uploaded_by,
  });
  console.log(
    "[BATCH] Full records received:",
    JSON.stringify(records, null, 2),
  );

  if (!Array.isArray(records) || records.length === 0) {
    console.error("[BATCH] Invalid records received");
    return res.status(400).json({
      error: "Invalid records",
      received: { recordsType: typeof records, recordsLength: records?.length },
    });
  }

  try {
    const connection = await pool.getConnection();

    // Get activity name for CSV header
    const [activities] = await connection.query(
      "SELECT name FROM activities WHERE id = ?",
      [activityId],
    );
    const activityName =
      activities.length > 0 ? activities[0].name : "Activity";

    // Get staff user ID from database
    const [users] = await connection.query(
      "SELECT id FROM users WHERE username = ?",
      ["staff"],
    );
    if (users.length === 0) {
      connection.release();
      console.error("[BATCH] Staff user not found");
      return res
        .status(500)
        .json({ error: "Staff user not found in database" });
    }
    const staffUserId = users[0].id;

    // Delete existing records for this activity FIRST
    console.log(
      "[BATCH] ==> Deleting existing attendance records for activity:",
      activityId,
    );
    const deleteResult = await connection.query(
      "DELETE FROM attendance WHERE activity_id = ?",
      [activityId],
    );
    console.log("[BATCH] ==> DELETE result:", deleteResult[0]);
    console.log("[BATCH] ==> Rows deleted:", deleteResult[0].affectedRows);

    // Insert new records (only non-empty ones with better validation)
    const validRecords = records.filter((r) => {
      const name = (r.name || "").trim();
      const sex = (r.sex || "").trim();
      const office = (r.office || "").trim();
      const position = (r.position || "").trim();
      const contact = (r.contact || "").trim();
      const signature = (r.signature || "").trim();

      const hasData = !!(
        name ||
        sex ||
        office ||
        position ||
        contact ||
        signature
      );
      if (!hasData) {
        console.log(`[BATCH] Filtering out empty row ${r.row_number}`);
      }
      return hasData;
    });

    console.log(
      "[BATCH] Received",
      records.length,
      "records, attempting to insert",
      validRecords.length,
      "valid records",
    );
    console.log(
      "[BATCH] Records to insert:",
      JSON.stringify(validRecords, null, 2),
    );

    let insertedCount = 0;
    for (const record of validRecords) {
      const name = (record.name || "").trim() || null;
      const sex = (record.sex || "").trim() || null;
      const office = (record.office || "").trim() || null;
      const position = (record.position || "").trim() || null;
      const contact = (record.contact || "").trim() || null;
      const signature = (record.signature || "").trim() || null;

      const insertResult = await connection.query(
        `INSERT INTO attendance (id, activity_id, row_number, name, sex, office, position, contact, signature)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          activityId,
          record.row_number,
          name,
          sex,
          office,
          position,
          contact,
          signature,
        ],
      );
      insertedCount++;
      console.log(
        `[BATCH] ==> Inserted record ${insertedCount}/${validRecords.length}: row_number=${record.row_number}, name=${name}, sex=${sex}`,
      );
    }

    console.log(
      "[BATCH] ==> INSERTION COMPLETE: Total inserted =",
      insertedCount,
    );

    // ✅ CRITICAL FIX: Generate actual CSV file
    console.log("[BATCH] Generating CSV file from records");
    const csvContent = generateAttendanceCSV(activityName, records);
    const now = new Date();
    const timestamp = now.getTime();
    const csvFileName = `attendance_${activityId}_${timestamp}.csv`;
    const csvFilePath = path.join(uploadsDir, csvFileName);

    fs.writeFileSync(csvFilePath, csvContent, "utf-8");
    console.log("[BATCH] CSV file created:", csvFilePath);

    // Insert database record pointing to the ACTUAL CSV file
    const fileId = uuidv4();
    const displayFileName = `Attendance_${activityName}_${now
      .toISOString()
      .slice(0, 10)}.csv`;
    const databaseFilePath = `/uploads/${csvFileName}`;

    console.log("[BATCH] Inserting file record:", {
      fileName: displayFileName,
      filePath: databaseFilePath,
    });

    await connection.query(
      `INSERT INTO files (id, participant_id, activity_id, uploaded_by, file_name, file_path) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        fileId,
        null,
        activityId,
        staffUserId,
        displayFileName,
        databaseFilePath,
      ],
    );

    connection.release();

    console.log("[BATCH] ✓ SUCCESS: Attendance submission complete");
    res.status(201).json({
      message: "Attendance records saved successfully",
      count: records.length,
      file_id: fileId,
      file_name: displayFileName,
      file_path: databaseFilePath,
    });
  } catch (error) {
    console.error("[BATCH] ✗ ERROR:", error.message);
    res.status(500).json({
      error: error.message,
      details: "Failed to save attendance and generate CSV",
    });
  }
});

// ============================================
// FILES MANAGEMENT
// ============================================

app.post(
  "/api/files/upload",
  uploadMiddleware.single("file"),
  async (req, res) => {
    try {
      const { activity_id, participant_id, uploaded_by } = req.body;
      const file = req.file;

      if (!activity_id || !file) {
        return res
          .status(400)
          .json({ error: "activity_id and file are required" });
      }

      const id = uuidv4();
      const filePath = `/uploads/${file.filename}`;

      const connection = await pool.getConnection();
      try {
        // Resolve uploader: if provided uploaded_by doesn't match an existing user,
        // fall back to any existing user or create a default staff user.
        let uploaderId = uploaded_by || null;
        if (uploaderId) {
          const [urows] = await connection.query(
            `SELECT id FROM users WHERE id = ? LIMIT 1`,
            [uploaderId],
          );
          if (!urows || urows.length === 0) uploaderId = null;
        }

        if (!uploaderId) {
          const [anyUser] = await connection.query(
            `SELECT id FROM users LIMIT 1`,
          );
          if (anyUser && anyUser.length > 0) {
            uploaderId = anyUser[0].id;
          } else {
            // No users exist; create a default staff user
            const newStaffId = uuidv4();
            try {
              await connection.query(
                `INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)`,
                [newStaffId, "staff", "password", "admin"],
              );
              uploaderId = newStaffId;
            } catch (e) {
              // fallback: set uploaderId to null (should not happen if schema allows)
              uploaderId = null;
            }
          }
        }

        // Insert into UploadedFile table
        await connection.query(
          `INSERT INTO UploadedFile (id, participant_id, activity_id, uploaded_by, file_name, file_path, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            participant_id || null,
            activity_id,
            uploaderId,
            file.originalname,
            filePath,
            file.size,
          ],
        );
      } finally {
        connection.release();
      }

      res.status(201).json({
        id,
        participant_id: participant_id || null,
        activity_id,
        uploaded_by: uploaded_by || null,
        file_name: file.originalname,
        file_path: filePath,
        upload_date: new Date(),
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Get all files with activity information
app.get("/api/files", async (req, res) => {
  console.log("\n[GET /api/files] Request received");
  try {
    const connection = await pool.getConnection();

    const [rows] = await connection.query(
      `SELECT f.id, f.participant_id, f.activity_id, f.uploaded_by, f.file_name, f.file_path, f.upload_date, a.name AS activity_name
       FROM UploadedFile f
       LEFT JOIN activities a ON f.activity_id = a.id
       UNION ALL
       SELECT f.id, f.participant_id, f.activity_id, f.uploaded_by, f.file_name, f.file_path, f.upload_date, a.name AS activity_name
       FROM files f
       LEFT JOIN activities a ON f.activity_id = a.id
       WHERE NOT EXISTS (SELECT 1 FROM UploadedFile uf WHERE uf.id = f.id)
       ORDER BY upload_date DESC`,
    );

    connection.release();

    console.log(`[GET /api/files] ✓ Success: Found ${rows?.length || 0} files`);
    if (rows && rows.length > 0) {
      console.log(
        "[GET /api/files] Sample file:",
        JSON.stringify(rows[0], null, 2),
      );
    } else {
      console.log("[GET /api/files] No files found in database");
    }

    res.json(rows || []);
  } catch (error) {
    console.error("[GET /api/files] ✗ Error:", error.message);
    res
      .status(500)
      .json({ error: error.message, details: "Failed to fetch files" });
  }
});

app.get("/api/files/activity/:activity_id", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT * FROM (
         SELECT id, participant_id, activity_id, uploaded_by, file_name, file_path, file_size, upload_date
         FROM UploadedFile
         WHERE activity_id = ?
         UNION ALL
         SELECT id, participant_id, activity_id, uploaded_by, file_name, file_path, NULL AS file_size, upload_date
         FROM files
         WHERE activity_id = ?
           AND NOT EXISTS (SELECT 1 FROM UploadedFile uf WHERE uf.id = files.id)
       )
       ORDER BY upload_date DESC`,
      [req.params.activity_id, req.params.activity_id],
    );
    connection.release();
    res.json(rows || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a file record and remove the file from disk
app.delete("/api/files/:id", async (req, res) => {
  const fileId = req.params.id;
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      "SELECT * FROM UploadedFile WHERE id = ?",
      [fileId],
    );
    const [legacyRows] =
      !rows || rows.length === 0
        ? await connection.query("SELECT * FROM files WHERE id = ?", [fileId])
        : [[]];

    const fileRecord = rows?.[0] || legacyRows?.[0];
    if (!fileRecord) {
      connection.release();
      return res.status(404).json({ error: "File not found" });
    }

    const filePath = path.join(
      __dirname,
      "..",
      fileRecord.file_path.replace(/^\//, ""),
    );

    // Delete DB record(s) from both tables to keep legacy data consistent.
    await connection.query("DELETE FROM UploadedFile WHERE id = ?", [fileId]);
    await connection.query("DELETE FROM files WHERE id = ?", [fileId]);
    connection.release();

    // Try to remove file from disk if exists
    fs.unlink(filePath, (err) => {
      if (err) {
        console.warn(
          "[FILES] Failed to delete file from disk:",
          filePath,
          err.message,
        );
      } else {
        console.log("[FILES] Removed file from disk:", filePath);
      }
    });

    res.json({ message: "File deleted" });
  } catch (error) {
    console.error("[FILES] Delete error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to check uploads directory
app.get("/api/test-uploads", (req, res) => {
  const uploadsDir = path.join(__dirname, "../uploads");
  try {
    const files = fs.readdirSync(uploadsDir);
    res.json({
      uploadsDir,
      fileCount: files.length,
      files: files.slice(0, 5), // First 5 files
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function resolveUploadedFilePath(filename) {
  return path.join(__dirname, "../uploads", filename);
}

function sendUploadedFile(res, filename, asDownload = false) {
  const filePath = resolveUploadedFilePath(filename);

  console.log(`[UPLOADS] Request: ${filename}`);
  console.log(`[UPLOADS] Full path: ${filePath}`);
  console.log(`[UPLOADS] File exists: ${fs.existsSync(filePath)}`);

  if (!fs.existsSync(filePath)) {
    console.log(`[UPLOADS] ✗ 404 - File not found`);
    return res.status(404).send("File not found");
  }

  if (asDownload) {
    console.log(`[UPLOADS] ✓ Downloading file...`);
    return res.download(filePath, filename);
  }

  console.log(`[UPLOADS] ✓ Opening file inline...`);
  return res.sendFile(filePath);
}

// Inline view route for uploaded files
app.get("/uploads/view/:filename", (req, res) => {
  sendUploadedFile(res, req.params.filename, false);
});

// Forced download route for uploaded files
app.get("/uploads/download/:filename", (req, res) => {
  sendUploadedFile(res, req.params.filename, true);
});

// Backward-compatible route: open inline
app.get("/uploads/:filename", (req, res) => {
  sendUploadedFile(res, req.params.filename, false);
});

// Fallback static middleware for uploads
app.use(
  "/uploads",
  express.static(uploadsDir, {
    setHeaders: (res, path) => {
      res.setHeader("Content-Type", "text/csv");
      console.log(`[UPLOADS-STATIC] Serving: ${path}`);
    },
  }),
);

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`\n✓ PEOS Backend Server running on http://localhost:${PORT}`);
  console.log(`✓ Database: SQLite (embedded file)`);
  console.log(`✓ Endpoints ready:\n`);
  console.log("  GET  /api/activities         - Get all activities");
  console.log("  POST /api/activities         - Create activity");
  console.log("  GET  /api/attendance/:id     - Get attendance records");
  console.log("  POST /api/attendance/batch   - Save batch attendance");
  console.log("  GET  /api/health             - Health check\n");
});
