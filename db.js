require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'bihdaml2omrsst13fabk-mysql.services.clever-cloud.com',
  user: process.env.DB_USER || 'uvdkowwmgbpehu3o',
  password: process.env.DB_PASSWORD || 'uvdkowwmgbpehu3o',
  database: process.env.DB_NAME || 'bihdaml2omrsst13fabk',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
