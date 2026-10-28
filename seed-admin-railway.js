/**
 * One-time script: Seeds/updates the admin account directly on Railway.
 * Run: node seed-admin-railway.js
 */
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const config = {
  host:     'mysql-production-b71f.up.railway.app',
  port:     3306,
  database: 'railway',
  user:     'root',
  password: process.env.RAILWAY_DB_PASSWORD,
  ssl:      { rejectUnauthorized: false },
};

const ADMIN_EMAIL    = 'larryrobert0742@gmail.com';
const ADMIN_PASSWORD = 'Password@123!';
const ADMIN_FIRST    = 'Larry';
const ADMIN_LAST     = 'Robert';

async function run() {
  if (!config.password) {
    console.error('RAILWAY_DB_PASSWORD is not set!');
    process.exit(1);
  }

  const conn = await mysql.createConnection(config);
  console.log('Connected to Railway MySQL');

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const [[existing]] = await conn.execute(
    'SELECT id, role FROM users WHERE email = ?',
    [ADMIN_EMAIL.toLowerCase()]
  );

  if (existing) {
    await conn.execute(
      "UPDATE users SET password = ?, role = 'Admin', account_status = 'active' WHERE id = ?",
      [hash, existing.id]
    );
    console.log('Updated user #' + existing.id + ' -> role=Admin, password reset');
  } else {
    const [result] = await conn.execute(
      "INSERT INTO users (email, password, first_name, last_name, role, account_status) VALUES (?, ?, ?, ?, 'Admin', 'active')",
      [ADMIN_EMAIL.toLowerCase(), hash, ADMIN_FIRST, ADMIN_LAST]
    );
    console.log('Created new admin #' + result.insertId + ': ' + ADMIN_EMAIL);
  }

  console.log('Done! Email: ' + ADMIN_EMAIL + ' / Password: ' + ADMIN_PASSWORD);
  await conn.end();
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
