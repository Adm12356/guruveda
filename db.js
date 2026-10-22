require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'byiiaxruywo5cnr5tm63-mysql.services.clever-cloud.com',
  user: process.env.DB_USER || 'u0zhu3tbhvf8b2li',
  password: process.env.DB_PASSWORD || 'hnQ4m9T7EBAVy5HizuF9',
  database: process.env.DB_NAME || 'byiiaxruywo5cnr5tm63',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
