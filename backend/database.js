const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

require("dotenv").config({ path: path.join(__dirname, ".env") });

const DATABASE_PATH =
  process.env.DATABASE_PATH || path.join(__dirname, "peos.db");

fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

const sqliteDb = new sqlite3.Database(DATABASE_PATH);

sqliteDb.serialize(() => {
  sqliteDb.run("PRAGMA foreign_keys = ON");
});

function exec(sql) {
  return new Promise((resolve, reject) => {
    sqliteDb.exec(sql, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        affectedRows: this.changes || 0,
        insertId: this.lastID,
      });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });
}

function isSelectQuery(sql) {
  return /^\s*(SELECT|WITH|EXPLAIN|VALUES)\b/i.test(sql);
}

const pool = {
  async getConnection() {
    return {
      async query(sql, params = []) {
        if (isSelectQuery(sql)) {
          return [await all(sql, params), []];
        }

        if (/^\s*PRAGMA\b/i.test(sql)) {
          if (sql.includes("=")) {
            await exec(sql);
            return [{ affectedRows: 0, insertId: undefined }, []];
          }

          return [await all(sql, params), []];
        }

        const trimmedSql = sql.trim();
        if (/^(BEGIN|COMMIT|ROLLBACK)\b/i.test(trimmedSql)) {
          await exec(trimmedSql);
          return [{ affectedRows: 0, insertId: undefined }, []];
        }

        return [await run(sql, params), []];
      },
      release() {},
    };
  },
};

async function ensureColumn(
  connection,
  tableName,
  columnName,
  columnDefinition,
) {
  const [columns] = await connection.query(`PRAGMA table_info(${tableName})`);
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    await connection.query(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`,
    );
  }
}

async function initializeDatabase() {
  let connection;

  try {
    connection = await pool.getConnection();

    await connection.query("PRAGMA foreign_keys = ON");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        venue TEXT NOT NULL,
        date TEXT NOT NULL,
        source TEXT DEFAULT 'saved',
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await ensureColumn(
      connection,
      "activities",
      "source",
      "TEXT DEFAULT 'saved'",
    );
    await ensureColumn(connection, "activities", "created_by", "TEXT");
    await ensureColumn(
      connection,
      "activities",
      "created_at",
      "DATETIME DEFAULT CURRENT_TIMESTAMP",
    );

    await connection.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        activity_id TEXT NOT NULL,
        row_number INTEGER NOT NULL,
        name TEXT,
        sex TEXT,
        office TEXT,
        position TEXT,
        contact TEXT,
        signature TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
      )
    `);

    await ensureColumn(
      connection,
      "attendance",
      "created_at",
      "DATETIME DEFAULT CURRENT_TIMESTAMP",
    );
    await exec(
      "CREATE INDEX IF NOT EXISTS idx_activity_id ON attendance (activity_id)",
    );

    await connection.query(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        participant_id TEXT,
        activity_id TEXT NOT NULL,
        uploaded_by TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (participant_id) REFERENCES attendance(id) ON DELETE SET NULL,
        FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await ensureColumn(connection, "files", "participant_id", "TEXT");
    await ensureColumn(connection, "files", "activity_id", "TEXT");
    await ensureColumn(connection, "files", "uploaded_by", "TEXT");
    await ensureColumn(connection, "files", "file_name", "TEXT");
    await ensureColumn(connection, "files", "file_path", "TEXT");
    await ensureColumn(
      connection,
      "files",
      "upload_date",
      "DATETIME DEFAULT CURRENT_TIMESTAMP",
    );
    await exec(
      "CREATE INDEX IF NOT EXISTS idx_files_activity_id ON files (activity_id)",
    );
    await exec(
      "CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files (uploaded_by)",
    );
    await exec(
      "CREATE INDEX IF NOT EXISTS idx_files_upload_date ON files (upload_date)",
    );

    await connection.query(`
      CREATE TABLE IF NOT EXISTS UploadedFile (
        id TEXT PRIMARY KEY,
        participant_id TEXT,
        activity_id TEXT NOT NULL,
        uploaded_by TEXT,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (participant_id) REFERENCES attendance(id) ON DELETE SET NULL,
        FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await ensureColumn(connection, "UploadedFile", "participant_id", "TEXT");
    await ensureColumn(connection, "UploadedFile", "activity_id", "TEXT");
    await ensureColumn(connection, "UploadedFile", "uploaded_by", "TEXT");
    await ensureColumn(connection, "UploadedFile", "file_name", "TEXT");
    await ensureColumn(connection, "UploadedFile", "file_path", "TEXT");
    await ensureColumn(connection, "UploadedFile", "file_size", "INTEGER");
    await ensureColumn(
      connection,
      "UploadedFile",
      "upload_date",
      "DATETIME DEFAULT CURRENT_TIMESTAMP",
    );
    await exec(
      "CREATE INDEX IF NOT EXISTS idx_uploadedfile_activity_id ON UploadedFile (activity_id)",
    );
    await exec(
      "CREATE INDEX IF NOT EXISTS idx_uploadedfile_uploaded_by ON UploadedFile (uploaded_by)",
    );
    await exec(
      "CREATE INDEX IF NOT EXISTS idx_uploadedfile_upload_date ON UploadedFile (upload_date)",
    );

    const { v4: uuidv4 } = require("uuid");
    let staffUserId = null;
    const existingStaffUser = await all(
      "SELECT id FROM users WHERE username = ? LIMIT 1",
      ["staff"],
    );

    if (existingStaffUser.length > 0) {
      staffUserId = existingStaffUser[0].id;
    } else {
      staffUserId = uuidv4();
      await connection.query(
        `INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)`,
        [staffUserId, "staff", "password", "admin"],
      );
    }

    console.log("✓ SQLite Database initialized successfully");
    console.log("✓ Database file: " + DATABASE_PATH);
    console.log("✓ Staff user created with ID:", staffUserId);
  } catch (error) {
    console.error("✗ Database initialization error:", error.message);
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { pool, initializeDatabase };
