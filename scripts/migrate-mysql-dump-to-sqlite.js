const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const ROOT_DIR = path.join(__dirname, "..");
const BACKEND_DIR = path.join(ROOT_DIR, "backend");
const DEFAULT_DUMP_PATH = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "peos_db (5).sql",
);
const DEFAULT_DB_PATH = path.join(BACKEND_DIR, "peos.db");

const SUPPORTED_TABLES = new Set([
  "users",
  "activities",
  "attendance",
  "files",
]);

function parseArgs(argv) {
  const args = {
    dumpPath: DEFAULT_DUMP_PATH,
    dbPath: DEFAULT_DB_PATH,
    keepExisting: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--dump" && argv[i + 1]) {
      args.dumpPath = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg.startsWith("--dump=")) {
      args.dumpPath = path.resolve(arg.slice("--dump=".length));
      continue;
    }

    if (arg === "--db" && argv[i + 1]) {
      args.dbPath = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg.startsWith("--db=")) {
      args.dbPath = path.resolve(arg.slice("--db=".length));
      continue;
    }

    if (arg === "--keep-existing") {
      args.keepExisting = true;
    }
  }

  return args;
}

function openDb(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(db);
    });
  });
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({ affectedRows: this.changes || 0 });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row || null);
    });
  });
}

async function ensureSchema(db) {
  await run(db, "PRAGMA foreign_keys = ON");

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      venue TEXT NOT NULL,
      date TEXT NOT NULL,
      source TEXT DEFAULT 'saved',
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS attendance (
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
    )`,
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      participant_id TEXT,
      activity_id TEXT NOT NULL,
      uploaded_by TEXT,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (participant_id) REFERENCES attendance(id) ON DELETE SET NULL,
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    )`,
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS UploadedFile (
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
    )`,
  );
}

function extractInsertStatements(sqlText) {
  const pattern =
    /INSERT INTO\s+`?([A-Za-z0-9_]+)`?\s*\(([^)]+)\)\s*VALUES\s*([\s\S]*?);/g;
  const inserts = [];
  let match;

  while ((match = pattern.exec(sqlText)) !== null) {
    const table = match[1];
    if (!SUPPORTED_TABLES.has(table)) {
      continue;
    }

    const columns = match[2]
      .split(",")
      .map((column) => column.replace(/`/g, "").trim())
      .filter(Boolean);

    inserts.push({ table, columns, valuesText: match[3] });
  }

  return inserts;
}

function splitRows(valuesText) {
  const rows = [];
  let depth = 0;
  let inQuote = false;
  let escapeNext = false;
  let rowStart = -1;

  for (let i = 0; i < valuesText.length; i += 1) {
    const ch = valuesText[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (inQuote && ch === "\\") {
      escapeNext = true;
      continue;
    }

    if (ch === "'") {
      inQuote = !inQuote;
      continue;
    }

    if (inQuote) {
      continue;
    }

    if (ch === "(") {
      if (depth === 0) {
        rowStart = i + 1;
      }
      depth += 1;
      continue;
    }

    if (ch === ")") {
      depth -= 1;
      if (depth === 0 && rowStart >= 0) {
        rows.push(valuesText.slice(rowStart, i));
        rowStart = -1;
      }
    }
  }

  return rows;
}

function splitFields(rowText) {
  const fields = [];
  let inQuote = false;
  let escapeNext = false;
  let start = 0;

  for (let i = 0; i < rowText.length; i += 1) {
    const ch = rowText[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (inQuote && ch === "\\") {
      escapeNext = true;
      continue;
    }

    if (ch === "'") {
      inQuote = !inQuote;
      continue;
    }

    if (!inQuote && ch === ",") {
      fields.push(rowText.slice(start, i).trim());
      start = i + 1;
    }
  }

  fields.push(rowText.slice(start).trim());
  return fields;
}

function decodeMysqlToken(token) {
  if (token.toUpperCase() === "NULL") {
    return null;
  }

  if (/^'.*'$/.test(token)) {
    const body = token.slice(1, -1);
    return body
      .replace(/\\0/g, "\0")
      .replace(/\\b/g, "\b")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\Z/g, "\x1a")
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\");
  }

  if (/^-?\d+(\.\d+)?$/.test(token)) {
    return Number(token);
  }

  return token;
}

async function importRows(db, table, columns, rows) {
  if (!rows.length) return 0;

  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;

  let inserted = 0;
  for (const row of rows) {
    const fields = splitFields(row).map(decodeMysqlToken);
    await run(db, sql, fields);
    inserted += 1;
  }

  return inserted;
}

function backupDbIfExists(dbPath) {
  if (!fs.existsSync(dbPath)) return null;

  const stamp = new Date().toISOString().replace(/[.:]/g, "-");
  const backupPath = dbPath.replace(/\.db$/i, `.${stamp}.backup.db`);
  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}

async function clearTables(db) {
  await run(db, "DELETE FROM UploadedFile");
  await run(db, "DELETE FROM files");
  await run(db, "DELETE FROM attendance");
  await run(db, "DELETE FROM activities");
  await run(db, "DELETE FROM users");
}

async function syncUploadedFileFromFiles(db) {
  await run(
    db,
    `INSERT OR IGNORE INTO UploadedFile (id, participant_id, activity_id, uploaded_by, file_name, file_path, upload_date)
     SELECT id, participant_id, activity_id, uploaded_by, file_name, file_path, upload_date
     FROM files`,
  );
}

async function getCount(db, tableName) {
  const row = await get(db, `SELECT COUNT(*) AS count FROM ${tableName}`);
  return row?.count || 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(args.dumpPath)) {
    console.error(`Dump file not found: ${args.dumpPath}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(args.dbPath), { recursive: true });

  const backupPath = backupDbIfExists(args.dbPath);
  if (backupPath) {
    console.log(`Backup created: ${backupPath}`);
  }

  const sqlText = fs.readFileSync(args.dumpPath, "utf8");
  const inserts = extractInsertStatements(sqlText);

  if (!inserts.length) {
    console.error("No supported INSERT statements found in SQL dump.");
    process.exit(1);
  }

  const db = await openDb(args.dbPath);

  try {
    await ensureSchema(db);
    await run(db, "PRAGMA foreign_keys = OFF");
    await run(db, "BEGIN TRANSACTION");

    if (!args.keepExisting) {
      await clearTables(db);
      console.log("Cleared existing SQLite data before import.");
    }

    const insertedCounts = {
      users: 0,
      activities: 0,
      attendance: 0,
      files: 0,
    };

    for (const stmt of inserts) {
      const rows = splitRows(stmt.valuesText);
      const inserted = await importRows(db, stmt.table, stmt.columns, rows);
      insertedCounts[stmt.table] += inserted;
    }

    await syncUploadedFileFromFiles(db);

    await run(db, "COMMIT");
    await run(db, "PRAGMA foreign_keys = ON");

    const finalCounts = {
      users: await getCount(db, "users"),
      activities: await getCount(db, "activities"),
      attendance: await getCount(db, "attendance"),
      files: await getCount(db, "files"),
      UploadedFile: await getCount(db, "UploadedFile"),
    };

    console.log("\nImport complete.");
    console.log("Rows imported from dump:", insertedCounts);
    console.log("Final SQLite counts:", finalCounts);
    console.log(`SQLite DB: ${args.dbPath}`);
  } catch (error) {
    try {
      await run(db, "ROLLBACK");
    } catch (rollbackError) {
      // ignore rollback errors
    }
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
