// filepath: c:\jhanvi-foundation-digital-dashboard-fork\config\db.js
// require("dotenv").config();
const mysql = require("mysql2/promise");

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    connectTimeout: 10000,
    waitForConnections: true,
    connectionLimit: 10,
});

module.exports = db;