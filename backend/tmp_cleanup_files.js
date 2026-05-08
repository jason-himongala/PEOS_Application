const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const util = require("util");

(async function main() {
  try {
    const backendDir = __dirname;
    const defaultDb = path.join(backendDir, "peos.db");
    const dbPath = process.env.DATABASE_PATH || defaultDb;
    if (!fs.existsSync(dbPath)) {
      console.error("Database not found at", dbPath);
      process.exit(1);
    }

    // Backup DB
    const bakPath = dbPath + `.bak.${Date.now()}`;
    fs.copyFileSync(dbPath, bakPath);
    console.log("Backup created:", bakPath);

    const db = new sqlite3.Database(dbPath);
    const dbAll = util.promisify(db.all.bind(db));
    const dbRun = util.promisify(db.run.bind(db));

    const tables = ["UploadedFile", "files"];
    let totalDeleted = 0;

    for (const table of tables) {
      console.log(`\nChecking duplicates in table: ${table}`);
      const dupRows = await dbAll(
        `SELECT file_path, COUNT(*) as c FROM ${table} GROUP BY file_path HAVING c>1`,
      );
      if (!dupRows || dupRows.length === 0) {
        console.log("No duplicates found in", table);
        continue;
      }

      for (const r of dupRows) {
        const filePath = r.file_path;
        const rows = await dbAll(
          `SELECT id, upload_date FROM ${table} WHERE file_path = ? ORDER BY upload_date DESC`,
          [filePath],
        );
        if (rows.length <= 1) continue;
        const keepId = rows[0].id;
        const deleteIds = rows.slice(1).map((x) => x.id);
        const placeholders = deleteIds.map(() => "?").join(",");
        const sql = `DELETE FROM ${table} WHERE id IN (${placeholders})`;
        const res = await dbRun(sql, deleteIds);
        const deleted = res && res.changes ? res.changes : deleteIds.length;
        totalDeleted += deleted;
        console.log(
          `Removed ${deleted} duplicate row(s) for file_path=${filePath} in ${table} (kept id=${keepId})`,
        );
      }
    }

    // Remove orphaned files from uploads directory
    const uploadsDir = path.join(backendDir, "..", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      console.log("Uploads directory not found:", uploadsDir);
    } else {
      console.log("\nScanning uploads directory for orphaned files...");
      const files = fs.readdirSync(uploadsDir);
      let orphanCount = 0;
      for (const fname of files) {
        const dbPathRef = `/uploads/${fname}`;
        const found = await dbAll(
          `SELECT 1 FROM UploadedFile WHERE file_path = ? UNION SELECT 1 FROM files WHERE file_path = ? LIMIT 1`,
          [dbPathRef, dbPathRef],
        );
        if (!found || found.length === 0) {
          // Move orphan to uploads/orphaned (safer than immediate delete)
          const orphanDir = path.join(uploadsDir, "orphaned");
          if (!fs.existsSync(orphanDir)) fs.mkdirSync(orphanDir);
          const src = path.join(uploadsDir, fname);
          const dest = path.join(orphanDir, fname);
          fs.renameSync(src, dest);
          orphanCount++;
          console.log("Moved orphaned file to:", dest);
        }
      }
      console.log(`Orphaned files moved: ${orphanCount}`);
    }

    console.log("\nCleanup complete. Total DB rows removed:", totalDeleted);
    db.close();
    process.exit(0);
  } catch (err) {
    console.error("Cleanup error:", err && err.message);
    process.exit(2);
  }
})();
