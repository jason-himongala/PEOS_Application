const path = require("path");
const sqlite3 = require("sqlite3").verbose();

(async () => {
  try {
    const dbPath = path.join(__dirname, "backend", "peos.db");
    const connection = new sqlite3.Database(dbPath);

    console.log("✓ Connected to database\n");

    const all = (sql) =>
      new Promise((resolve, reject) => {
        connection.all(sql, [], (error, rows) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(rows || []);
        });
      });

    // Test activities query
    const activities = await all(
      `SELECT id AS activity_id, name, venue, date, created_at FROM activities ORDER BY created_at DESC`,
    );
    console.log("Activities from summary query:", activities);

    // Test files query
    const files = await all(
      `SELECT activity_id, COUNT(*) as file_count, MAX(upload_date) as latest_file FROM files GROUP BY activity_id`,
    );
    console.log("\nFiles stats:", files);

    connection.close();
  } catch (error) {
    console.error("Error:", error.message);
  }
})();
