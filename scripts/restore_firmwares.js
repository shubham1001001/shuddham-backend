import mysql from 'mysql2/promise';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function restoreFirmwares() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('Connected to MySQL database:', process.env.DB_NAME);

  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    console.log('No uploads directory found at:', uploadDir);
    await conn.end();
    return;
  }

  const restored = [];
  const hwFolders = fs.readdirSync(uploadDir);

  for (const hv of hwFolders) {
    const hvPath = path.join(uploadDir, hv);
    if (!fs.statSync(hvPath).isDirectory()) continue;

    const fwFolders = fs.readdirSync(hvPath);
    for (const fv of fwFolders) {
      const fvPath = path.join(hvPath, fv);
      if (!fs.statSync(fvPath).isDirectory()) continue;

      const files = fs.readdirSync(fvPath);
      for (const file of files) {
        if (path.extname(file).toLowerCase() === '.bin') {
          const bin_file_path = `/uploads/${hv}/${fv}/${file}`;
          const [existing] = await conn.query(
            'SELECT id FROM `firmwares` WHERE `bin_file_path` = ?',
            [bin_file_path]
          );

          if (existing.length === 0) {
            const id = crypto.randomUUID();
            await conn.query(
              'INSERT INTO `firmwares` (`id`, `hardware_version`, `firmware_version`, `bin_file_path`) VALUES (?, ?, ?, ?)',
              [id, hv, fv, bin_file_path]
            );
            restored.push({ id, hardware_version: hv, firmware_version: fv, bin_file_path });
            console.log(`✅ Restored: HW=${hv}, FW=${fv}, File=${file}`);
          } else {
            console.log(`ℹ️ Already exists: HW=${hv}, FW=${fv}, File=${file}`);
          }
        }
      }
    }
  }

  console.log(`\nScan complete! Restored ${restored.length} firmware(s).`);
  const [rows] = await conn.query('SELECT * FROM `firmwares`');
  console.log('Current firmwares in database:', rows);

  await conn.end();
}

restoreFirmwares().catch(console.error);
