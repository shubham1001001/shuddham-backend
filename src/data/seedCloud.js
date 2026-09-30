import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const INVENTORY_FILE = path.join(DATA_DIR, 'database_inventory.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'database_categories.json');
const USERS_FILE = path.join(DATA_DIR, 'database_users.json');

async function syncTiDB() {
  try {
    const conn = await mysql.createConnection({
      host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
      port: 4000,
      user: '2JcEx3drCpaQ24W.root',
      password: 'TWsOE4pAX5oW2mKO',
      database: 'shuddham_db',
      ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    });

    console.log('Connected to TiDB Cloud shuddham_db!');

    // 1. Users Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        full_name VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        phone VARCHAR(20) DEFAULT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('Super Admin', 'Admin', 'Staff') NOT NULL DEFAULT 'Admin',
        city VARCHAR(100) DEFAULT 'Operations HQ',
        token VARCHAR(500) DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        last_login TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_phone (phone)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    if (fs.existsSync(USERS_FILE)) {
      const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      for (const u of users) {
        await conn.query(`
          INSERT INTO users (id, full_name, email, phone, password, role, city)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password = VALUES(password), role = VALUES(role)
        `, [
          u.id || `usr-${Date.now()}`,
          u.name || u.fullName || 'Admin',
          u.email,
          u.phone || '',
          u.password || '123456',
          u.role || 'Admin',
          u.city || u.location || 'Operations'
        ]);
      }
      console.log('Synced users into TiDB Cloud!');
    }

    // 2. Drop & Recreate device_categories with correct admin categories
    await conn.query('DROP TABLE IF EXISTS device_categories;');
    await conn.query(`
      CREATE TABLE device_categories (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(255) DEFAULT NULL,
        icon VARCHAR(50) DEFAULT 'Box',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_cat_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    if (fs.existsSync(CATEGORIES_FILE)) {
      const cats = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf-8'));
      for (const c of cats) {
        await conn.query(`
          INSERT INTO device_categories (id, name, description, icon)
          VALUES (?, ?, ?, ?)
        `, [c.id, c.name, c.description || '', c.icon || 'Box']);
      }
      console.log(`Synced ${cats.length} RO Categories into TiDB Cloud!`);
    }

    // 3. Drop & Recreate inventory with full schema
    await conn.query('DROP TABLE IF EXISTS inventory;');
    await conn.query(`
      CREATE TABLE inventory (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        sku VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL,
        category VARCHAR(100) NOT NULL,
        stock_quantity INT NOT NULL DEFAULT 0,
        min_threshold INT NOT NULL DEFAULT 5,
        unit VARCHAR(20) DEFAULT 'Units',
        cost_price DECIMAL(10,2) DEFAULT 0.00,
        selling_price DECIMAL(10,2) DEFAULT 0.00,
        location VARCHAR(150) DEFAULT 'Warehouse Bay 1',
        supplier VARCHAR(150) DEFAULT 'Shuddham Manufacturing',
        last_restocked VARCHAR(50) DEFAULT NULL,
        available_serials LONGTEXT DEFAULT NULL,
        assignments LONGTEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sku (sku),
        INDEX idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    if (fs.existsSync(INVENTORY_FILE)) {
      const items = JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf-8'));
      for (const item of items) {
        await conn.query(`
          INSERT INTO inventory (
            id, sku, name, category, stock_quantity, min_threshold, unit,
            cost_price, selling_price, location, supplier, last_restocked,
            available_serials, assignments
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          item.id,
          item.sku,
          item.name,
          item.category,
          Number(item.stockQuantity ?? item.stock_quantity ?? 0),
          Number(item.minThreshold ?? item.min_threshold ?? 5),
          item.unit || 'Units',
          Number(item.costPrice ?? item.cost_price ?? 0),
          Number(item.sellingPrice ?? item.selling_price ?? 0),
          item.location || 'Warehouse Bay 1',
          item.supplier || 'Shuddham Manufacturing',
          item.lastRestocked || item.last_restocked || new Date().toISOString().split('T')[0],
          JSON.stringify(Array.isArray(item.availableSerials) ? item.availableSerials : []),
          JSON.stringify(Array.isArray(item.assignments) ? item.assignments : [])
        ]);
      }
      console.log(`Synced ${items.length} inventory items into TiDB Cloud!`);
    }

    console.log('✅ ALL ADMIN PANEL DATA PERFECTLY SYNCED TO TIDB CLOUD!');
    await conn.end();
  } catch(err) {
    console.error('TiDB Sync Error:', err);
  }
}

syncTiDB();
