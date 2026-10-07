import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function inspectAndClean() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('Connected to database:', process.env.DB_NAME);

  const [tablesResult] = await conn.query('SHOW TABLES');
  const tableNames = tablesResult.map(row => Object.values(row)[0]);
  console.log('Found tables:', tableNames);

  console.log('\n--- BEFORE CLEANUP ---');
  for (const table of tableNames) {
    const [cnt] = await conn.query(`SELECT COUNT(*) as count FROM \`${table}\``);
    console.log(`${table}: ${cnt[0].count} rows`);
  }

  const [users] = await conn.query('SELECT id, email, role FROM users');
  console.log('\nExisting users:', users);

  console.log('\n--- CLEANING DATA ---');
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');

  for (const table of tableNames) {
    if (table.toLowerCase() === 'users') {
      // Keep only admin@gmail.com and superadmin@gmail.com
      const [res] = await conn.query(
        "DELETE FROM users WHERE LOWER(TRIM(email)) NOT IN ('admin@gmail.com', 'superadmin@gmail.com')"
      );
      console.log(`users table cleaned: deleted ${res.affectedRows} non-admin rows`);
    } else {
      // Clear entire table
      const [res] = await conn.query(`TRUNCATE TABLE \`${table}\``);
      console.log(`Truncated table: ${table}`);
    }
  }

  await conn.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('\n--- AFTER CLEANUP ---');
  for (const table of tableNames) {
    const [cnt] = await conn.query(`SELECT COUNT(*) as count FROM \`${table}\``);
    console.log(`${table}: ${cnt[0].count} rows`);
  }

  const [remainingUsers] = await conn.query('SELECT id, email, role FROM users');
  console.log('\nRemaining users:', remainingUsers);

  await conn.end();
}

inspectAndClean().catch((err) => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
