require('dotenv').config();
const mysql = require('mysql2/promise');

const dbHost = process.env.DB_HOST || 'byiiaxruywo5cnr5tm63-mysql.services.clever-cloud.com';
const dbUser = process.env.DB_USER || 'u0zhu3tbhvf8b2li';
const dbPassword = process.env.DB_PASSWORD || 'hnQ4m9T7EBAVy5HizuF9';
const dbName = process.env.DB_NAME || 'byiiaxruywo5cnr5tm63';
const dbPort = parseInt(process.env.DB_PORT || '3306', 10);

console.log(`[Database] Connecting to: ${dbHost}:${dbPort}/${dbName}`);

const poolConfig = {
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};

// Auto-enable SSL if required by provider or set in env
if (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1') {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = mysql.createPool(poolConfig);

// Automatic schema repair: ensures required columns exist without manual intervention
(async () => {
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM `admins` LIKE 'is_active'");
    if (!cols.length) {
      await pool.query("ALTER TABLE `admins` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1");
      console.log("[Database] Added missing column 'is_active' to `admins`.");
    }
  } catch (err) {
    // Non-fatal: logged if connection is delayed
    console.warn('[Database] Schema check deferred:', err.message);
  }

  try {
    const [roleCols] = await pool.query("SHOW COLUMNS FROM `admins` LIKE 'role'");
    if (!roleCols.length) {
      await pool.query("ALTER TABLE `admins` ADD COLUMN `role` ENUM('owner', 'teacher') NOT NULL DEFAULT 'teacher'");
      console.log("[Database] Added missing column 'role' to `admins`.");
    }
  } catch (err) {}

  try {
    const [stCols] = await pool.query("SHOW COLUMNS FROM `students` LIKE 'is_active'");
    if (!stCols.length) {
      await pool.query("ALTER TABLE `students` ADD COLUMN `is_active` TINYINT(1) NOT NULL DEFAULT 1");
      console.log("[Database] Added missing column 'is_active' to `students`.");
    }
  } catch (err) {}
})();

module.exports = pool;
