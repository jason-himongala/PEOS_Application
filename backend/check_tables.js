const { pool } = require("./database");

(async function main() {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      ["files"],
    );
    if (rows && rows.length) {
      console.log("✓ Found table `files`");
      const [cols] = await conn.query("PRAGMA table_info(files)");
      console.table(cols);
    } else {
      console.warn("✗ Table `files` not found in database");
    }
  } catch (err) {
    console.error("Error checking tables:", err.message);
  } finally {
    if (conn) conn.release();
    process.exit(0);
  }
})();
