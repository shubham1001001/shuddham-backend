import mysql from 'mysql2/promise';

async function createTable() {
  try {
    const conn = await mysql.createConnection({
      host: '3.88.13.76',
      user: 'shuddham',
      password: 'shuddham@123',
      database: 'shuddham_db',
      port: 3306,
      connectTimeout: 8000
    });
    console.log('Connected to MySQL on 3.88.13.76!');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`addresses\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`user_id\` VARCHAR(50) NOT NULL,
        \`title\` VARCHAR(100) NOT NULL DEFAULT 'Home',
        \`address\` TEXT NOT NULL,
        \`city\` VARCHAR(100) DEFAULT '',
        \`pincode\` VARCHAR(20) DEFAULT '',
        \`is_default\` TINYINT(1) DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_user_id\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('Table `addresses` successfully ensured in MySQL!');
    const [rows] = await conn.query('SHOW TABLES LIKE "addresses"');
    console.log('Verification result:', rows);
    await conn.end();
  } catch (err) {
    console.error('Error creating addresses table:', err.message);
  }
}

createTable();
