/**
 * Complete Database Setup Script
 * - Creates database
 * - Creates all tables
 * - Seeds default data
 * - Creates admin account
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true
};

const dbName = process.env.DB_NAME || 'schwab_db';

async function setupDatabase() {
  let connection;
  
  try {
    console.log('🔄 Connecting to MySQL...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to MySQL successfully\n');

    // Read and execute init.sql
    console.log('🔄 Creating database and tables...');
    const initSQL = fs.readFileSync(path.join(__dirname, 'src', 'db', 'init.sql'), 'utf8');
    await connection.query(initSQL);
    console.log('✅ Database and tables created successfully\n');

    // Switch to the database
    await connection.query(`USE ${dbName}`);

    // Insert default platform settings
    console.log('🔄 Inserting default platform settings...');
    await connection.query(`
      INSERT INTO platform_settings (id) 
      VALUES (1) 
      ON DUPLICATE KEY UPDATE id=id
    `);
    console.log('✅ Platform settings initialized\n');

    // Create admin account
    console.log('🔄 Creating admin account...');
    const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@schwab.local';
    const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'Admin@12345';
    const adminFirstName = process.env.ADMIN_SEED_FIRST_NAME || 'Admin';
    const adminLastName = process.env.ADMIN_SEED_LAST_NAME || 'User';

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const currentDate = new Date().toISOString().split('T')[0];

    const [existingAdmin] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [adminEmail]
    );

    if (existingAdmin.length === 0) {
      await connection.query(`
        INSERT INTO users 
        (email, password, first_name, last_name, role, balance, member_since, account_status, kyc_verified) 
        VALUES (?, ?, ?, ?, 'Admin', 0, ?, 'active', 1)
      `, [adminEmail, hashedPassword, adminFirstName, adminLastName, currentDate]);
      console.log('✅ Admin account created successfully');
      console.log(`   📧 Email: ${adminEmail}`);
      console.log(`   🔑 Password: ${adminPassword}\n`);
    } else {
      console.log('ℹ️  Admin account already exists\n');
    }

    // Insert default platform accounts (for deposits/withdrawals)
    console.log('🔄 Setting up default platform accounts...');
    
    // Bank Transfer Account
    await connection.query(`
      INSERT INTO platform_accounts 
      (account_name, payment_method, bank_name, account_number, routing_number, account_type, is_default, assigned_to, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE account_name=account_name
    `, [
      'Charles Schwab Corporate Account',
      'bank_transfer',
      'JPMorgan Chase Bank',
      '1234567890',
      '021000021',
      'Business Checking',
      1,
      'deposit',
      'active'
    ]);

    // Crypto Wallet (Bitcoin)
    await connection.query(`
      INSERT INTO platform_accounts 
      (account_name, payment_method, coin_symbol, wallet_address, network, is_default, assigned_to, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE account_name=account_name
    `, [
      'Bitcoin Deposit Wallet',
      'crypto',
      'BTC',
      'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      'Bitcoin',
      0,
      'deposit',
      'active'
    ]);

    // Crypto Wallet (Ethereum)
    await connection.query(`
      INSERT INTO platform_accounts 
      (account_name, payment_method, coin_symbol, wallet_address, network, is_default, assigned_to, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE account_name=account_name
    `, [
      'Ethereum Deposit Wallet',
      'crypto',
      'ETH',
      '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      'Ethereum (ERC-20)',
      0,
      'deposit',
      'active'
    ]);

    console.log('✅ Platform accounts configured\n');

    // Insert sample market stats
    console.log('🔄 Inserting sample market stats...');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (const month of months) {
      await connection.query(`
        INSERT INTO market_stats (month, btc, eth, xrp, ltc, zec)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE month=month
      `, [
        month,
        Math.floor(Math.random() * 10000) + 40000,  // BTC
        Math.floor(Math.random() * 1000) + 2000,    // ETH
        Math.random() * 2 + 0.5,                     // XRP
        Math.floor(Math.random() * 100) + 100,      // LTC
        Math.floor(Math.random() * 50) + 50          // ZEC
      ]);
    }
    console.log('✅ Market stats inserted\n');

    console.log('🎉 Database setup completed successfully!\n');
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 ADMIN LOGIN CREDENTIALS');
    console.log('═══════════════════════════════════════════════════');
    console.log(`📧 Email:    ${adminEmail}`);
    console.log(`🔑 Password: ${adminPassword}`);
    console.log('═══════════════════════════════════════════════════\n');
    console.log('✅ You can now start the server with: npm run dev\n');

  } catch (error) {
    console.error('❌ Error during database setup:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the setup
setupDatabase();
