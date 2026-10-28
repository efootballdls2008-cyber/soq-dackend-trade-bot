require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS support_messages (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT DEFAULT NULL,
      name       VARCHAR(255) DEFAULT NULL,
      email      VARCHAR(255) DEFAULT NULL,
      subject    VARCHAR(255) NOT NULL,
      message    TEXT NOT NULL,
      status     ENUM('pending','resolved') NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  console.log('✅ support_messages table created');
  await conn.end();
}

run().catch(console.error);
