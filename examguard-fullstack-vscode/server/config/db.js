const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456789',
  database: process.env.DB_NAME || 'db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Kiểm tra kết nối ngay khi khởi động server
pool.getConnection()
  .then((conn) => {
    console.log(`✅ Đã kết nối MySQL thành công tới CSDL: "${process.env.DB_NAME || 'db'}"`);
    conn.release();
  })
  .catch((err) => {
    console.error('❌ Lỗi kết nối MySQL:', err.message);
  });

module.exports = pool;