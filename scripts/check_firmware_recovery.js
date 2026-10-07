import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function check() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [vars] = await conn.query("SHOW VARIABLES LIKE 'log_bin%'");
    console.log('Variables:', vars);
  } catch (e) {
    console.log('Vars error:', e.message);
  }

  try {
    const [binlogs] = await conn.query("SHOW BINARY LOGS");
    console.log('Binlogs:', binlogs);
  } catch (e) {
    console.log('Binlogs error:', e.message);
  }

  await conn.end();
}

check().catch(console.error);
