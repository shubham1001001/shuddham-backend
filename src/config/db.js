import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const INVENTORY_FILE = path.join(DATA_DIR, 'database_inventory.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'database_categories.json');

export const dbConfig = {
  host: (process.env.DB_HOST || 'localhost').trim(),
  user: (process.env.DB_USER || 'root').trim(),
  password: (process.env.DB_PASSWORD || '').trim(),
  database: (process.env.DB_NAME || 'shuddham_db').trim(),
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ...(process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' || (process.env.DB_HOST && process.env.DB_HOST.trim() !== 'localhost' && process.env.DB_HOST.trim() !== '127.0.0.1') ? {
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    }
  } : {})
};

let pool = null;
let isConnected = false;
let lastDbError = null;

/**
 * Initialize MySQL Connection Pool, Auto-Create Schema & Sync Data
 */
export async function initDatabase() {
  try {
    // 1. If running locally or as root, try ensuring database exists
    if (!process.env.DB_HOST || process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1') {
      try {
        const rootConnection = await mysql.createConnection({
          host: dbConfig.host,
          user: dbConfig.user,
          password: dbConfig.password,
          port: dbConfig.port
        });
        await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await rootConnection.end();
      } catch (err) {
        // Ignore root create database errors on non-root or cloud environments
      }
    }

    // 2. Initialize connection pool to the database
    pool = mysql.createPool(dbConfig);

    // 3. Test pool connection
    const connection = await pool.getConnection();
    console.log(`[MySQL Database] Connected successfully to ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);

    // 4. Auto-create 'users' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`full_name\` VARCHAR(150) NOT NULL,
        \`email\` VARCHAR(150) NOT NULL UNIQUE,
        \`phone\` VARCHAR(20) DEFAULT NULL,
        \`password\` VARCHAR(255) NOT NULL,
        \`role\` ENUM('Super Admin', 'Admin', 'Staff') NOT NULL DEFAULT 'Admin',
        \`city\` VARCHAR(100) DEFAULT 'Operations HQ',
        \`token\` VARCHAR(500) DEFAULT NULL,
        \`is_active\` TINYINT(1) DEFAULT 1,
        \`last_login\` TIMESTAMP NULL DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_email\` (\`email\`),
        INDEX \`idx_phone\` (\`phone\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Auto-seed required admin accounts (Super Admin, Admin)
    const seedUsers = [
      ['usr-superadmin', 'Super Admin', 'superadmin@gmail.com', '9800011100', '123456', 'Super Admin', 'HQ Executive Office']
    ];

    for (const u of seedUsers) {
      await connection.query(`
        INSERT INTO \`users\` (\`id\`, \`full_name\`, \`email\`, \`phone\`, \`password\`, \`role\`, \`city\`)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          \`password\` = VALUES(\`password\`),
          \`role\` = VALUES(\`role\`);
      `, u);
    }

    // 5.1 Auto-sync users from database_users.json (including created admins like testadmin@gmail.com)
    const USERS_FILE = path.join(DATA_DIR, 'database_users.json');
    if (fs.existsSync(USERS_FILE)) {
      try {
        const fileUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
        if (Array.isArray(fileUsers)) {
          for (const u of fileUsers) {
            if (!u.email) continue;
            await connection.query(`
              INSERT INTO \`users\` (\`id\`, \`full_name\`, \`email\`, \`phone\`, \`password\`, \`role\`, \`city\`, \`is_active\`)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE 
                \`full_name\` = VALUES(\`full_name\`),
                \`phone\` = VALUES(\`phone\`),
                \`password\` = VALUES(\`password\`),
                \`role\` = VALUES(\`role\`),
                \`city\` = VALUES(\`city\`),
                \`is_active\` = VALUES(\`is_active\`);
            `, [
              u.id || `usr-${Date.now()}`,
              u.fullName || u.name || u.full_name || 'Admin',
              u.email ? u.email.trim().toLowerCase() : '',
              u.phone || '',
              u.password || '123456',
              u.role || 'Admin',
              u.city || u.location || 'Operations HQ',
              u.status === 'Inactive' ? 0 : 1
            ]);
          }
        }
      } catch (err) {
        console.warn('[MySQL Database] Users sync note:', err.message);
      }
    }

    // 6. Auto-create 'device_categories' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`device_categories\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`name\` VARCHAR(100) NOT NULL UNIQUE,
        \`description\` VARCHAR(255) DEFAULT NULL,
        \`icon\` VARCHAR(50) DEFAULT 'Box',
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_cat_name\` (\`name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Auto-create 'inventory' table with support for serials and assignments
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`inventory\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`sku\` VARCHAR(50) NOT NULL UNIQUE,
        \`name\` VARCHAR(200) NOT NULL,
        \`category\` VARCHAR(100) NOT NULL,
        \`stock_quantity\` INT NOT NULL DEFAULT 0,
        \`min_threshold\` INT NOT NULL DEFAULT 5,
        \`unit\` VARCHAR(20) DEFAULT 'Units',
        \`cost_price\` DECIMAL(10,2) DEFAULT 0.00,
        \`selling_price\` DECIMAL(10,2) DEFAULT 0.00,
        \`location\` VARCHAR(150) DEFAULT 'Warehouse Bay 1',
        \`supplier\` VARCHAR(150) DEFAULT 'Shuddham Manufacturing',
        \`last_restocked\` VARCHAR(50) DEFAULT NULL,
        \`available_serials\` LONGTEXT DEFAULT NULL,
        \`assignments\` LONGTEXT DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_sku\` (\`sku\`),
        INDEX \`idx_category\` (\`category\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure columns available_serials and assignments exist if table was previously created without them
    try {
      await connection.query(`ALTER TABLE \`inventory\` ADD COLUMN \`available_serials\` LONGTEXT DEFAULT NULL;`);
    } catch (e) { /* column exists */ }
    try {
      await connection.query(`ALTER TABLE \`inventory\` ADD COLUMN \`assignments\` LONGTEXT DEFAULT NULL;`);
    } catch (e) { /* column exists */ }

    // 8. Sync categories from JSON file to MySQL if file exists
    if (fs.existsSync(CATEGORIES_FILE)) {
      try {
        const fileCats = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf-8'));
        if (Array.isArray(fileCats)) {
          for (const cat of fileCats) {
            await connection.query(`
              INSERT INTO \`device_categories\` (\`id\`, \`name\`, \`description\`, \`icon\`)
              VALUES (?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE
                \`description\` = VALUES(\`description\`),
                \`icon\` = VALUES(\`icon\`);
            `, [cat.id || `cat-${Date.now()}`, cat.name, cat.description || '', cat.icon || 'Box']);
          }
        }
      } catch (err) {
        console.warn('[MySQL Database] Categories sync note:', err.message);
      }
    }

    // 9. Sync inventory items from JSON file to MySQL if file exists
    if (fs.existsSync(INVENTORY_FILE)) {
      try {
        const fileInv = JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf-8'));
        if (Array.isArray(fileInv)) {
          for (const item of fileInv) {
            await connection.query(`
              INSERT INTO \`inventory\` (
                \`id\`, \`sku\`, \`name\`, \`category\`, \`stock_quantity\`, \`min_threshold\`, 
                \`unit\`, \`cost_price\`, \`selling_price\`, \`location\`, \`supplier\`, 
                \`last_restocked\`, \`available_serials\`, \`assignments\`
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE
                \`name\` = VALUES(\`name\`),
                \`category\` = VALUES(\`category\`),
                \`stock_quantity\` = VALUES(\`stock_quantity\`),
                \`min_threshold\` = VALUES(\`min_threshold\`),
                \`unit\` = VALUES(\`unit\`),
                \`cost_price\` = VALUES(\`cost_price\`),
                \`selling_price\` = VALUES(\`selling_price\`),
                \`location\` = VALUES(\`location\`),
                \`supplier\` = VALUES(\`supplier\`),
                \`last_restocked\` = VALUES(\`last_restocked\`),
                \`available_serials\` = VALUES(\`available_serials\`),
                \`assignments\` = VALUES(\`assignments\`);
            `, [
              item.id,
              item.sku,
              item.name,
              item.category,
              Number(item.stockQuantity) || 0,
              Number(item.minThreshold) || 5,
              item.unit || 'Units',
              Number(item.costPrice) || 0,
              Number(item.sellingPrice) || 0,
              item.location || 'Warehouse Bay 1',
              item.supplier || 'Shuddham Manufacturing',
              item.lastRestocked || new Date().toISOString().split('T')[0],
              JSON.stringify(item.availableSerials || []),
              JSON.stringify(item.assignments || [])
            ]);
          }
        }
      } catch (err) {
        console.warn('[MySQL Database] Inventory sync note:', err.message);
      }
    }

    // 10. Auto-create 'bookings' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`bookings\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`customer_name\` VARCHAR(150) NOT NULL,
        \`customer_phone\` VARCHAR(30) NOT NULL,
        \`service_title\` VARCHAR(200) NOT NULL,
        \`address\` TEXT NOT NULL,
        \`date\` VARCHAR(30) NOT NULL,
        \`time_slot\` VARCHAR(60) NOT NULL,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'Pending',
        \`technician_id\` VARCHAR(50) DEFAULT NULL,
        \`technician_name\` VARCHAR(100) DEFAULT 'Unassigned',
        \`amount\` DECIMAL(10,2) DEFAULT 499.00,
        \`payment_status\` VARCHAR(50) DEFAULT 'Pending',
        \`tds_before\` INT DEFAULT NULL,
        \`tds_after\` INT DEFAULT NULL,
        \`cancellation_reason\` TEXT DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_cust_phone\` (\`customer_phone\`),
        INDEX \`idx_booking_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 11. Auto-create 'services' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`services\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`title\` VARCHAR(200) NOT NULL,
        \`category\` VARCHAR(100) NOT NULL,
        \`price\` DECIMAL(10,2) NOT NULL,
        \`duration\` VARCHAR(50) DEFAULT '1 Hour',
        \`description\` TEXT DEFAULT NULL,
        \`featured\` TINYINT(1) DEFAULT 0,
        \`rating\` DECIMAL(3,2) DEFAULT 4.8,
        \`review_count\` INT DEFAULT 100,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_serv_cat\` (\`category\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    connection.release();
    isConnected = true;
    lastDbError = null;
    console.log('[MySQL Database] Schema verified & fully synced with live data!');
    return true;
  } catch (error) {
    isConnected = false;
    lastDbError = error.message;
    console.warn(`[MySQL Database] Note: MySQL not reachable (${error.message}). Running with resilient fallback layer.`);
    return false;
  }
}

/**
 * Helper to run queries with automatic fallback resilience
 */
export async function query(sql, params = []) {
  if (!isConnected || !pool) {
    throw new Error('MySQL connection pool not active');
  }
  const [rows] = await pool.query(sql, params);
  return rows;
}

export function isMySQLActive() {
  return isConnected;
}

export function getDbStatus() {
  return {
    isConnected,
    host: dbConfig.host,
    database: dbConfig.database,
    port: dbConfig.port,
    error: lastDbError
  };
}

export default {
  initDatabase,
  query,
  isMySQLActive,
  getDbStatus,
  dbConfig
};
