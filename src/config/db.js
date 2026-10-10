import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const dbConfig = {
  host: (process.env.DB_HOST || 'localhost').trim(),
  user: (process.env.DB_USER || 'root').trim(),
  password: (process.env.DB_PASSWORD || '').trim(),
  database: (process.env.DB_NAME || 'shuddham_db').trim(),
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  ...(process.env.DB_SSL === 'false' || process.env.DB_SSL === '0' ? {} : {
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: false
    }
  })
};

let pool = null;
let isConnected = false;
let lastDbError = null;

/**
 * Initialize MySQL Connection Pool & Auto-Verify Schema
 */
export async function initDatabase() {
  try {
    // 1. If running locally as root, ensure database exists
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
        // Ignore root create database errors
      }
    }

    // 2. Initialize connection pool to MySQL
    pool = mysql.createPool(dbConfig);

    // 3. Test pool connection
    const connection = await pool.getConnection();
    console.log(`[MySQL Database] Connected successfully to ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);

    // 4. Ensure 'users' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`full_name\` VARCHAR(150) NOT NULL,
        \`email\` VARCHAR(150) NOT NULL UNIQUE,
        \`phone\` VARCHAR(20) DEFAULT NULL UNIQUE,
        \`password\` VARCHAR(255) NOT NULL,
        \`role\` VARCHAR(50) NOT NULL DEFAULT 'Customer',
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

    // Ensure 'device_categories' table
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

    // Ensure 'inventory' table
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

    // Ensure 'bookings' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`bookings\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`customer_id\` VARCHAR(50) DEFAULT NULL,
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
        INDEX \`idx_cust_id\` (\`customer_id\`),
        INDEX \`idx_cust_phone\` (\`customer_phone\`),
        INDEX \`idx_booking_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure 'addresses' table
    await connection.query(`
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

    // Ensure 'services' table
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

    // Auto-seed primary Super Admin account if not present
    await connection.query(`
      INSERT INTO \`users\` (\`id\`, \`full_name\`, \`email\`, \`phone\`, \`password\`, \`role\`, \`city\`)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        \`role\` = VALUES(\`role\`);
    `, ['usr-superadmin', 'Super Admin', 'superadmin@gmail.com', '9800011100', '123456', 'Super Admin', 'HQ Executive Office']);

    // Ensure 'firmwares' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`firmwares\` (
        \`id\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`hardware_version\` VARCHAR(100) NOT NULL,
        \`firmware_version\` VARCHAR(100) NOT NULL,
        \`bin_file_path\` VARCHAR(255) NOT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_hardware_version\` (\`hardware_version\`),
        INDEX \`idx_firmware_version\` (\`firmware_version\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure 'device_telemetry' table for historical readings
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`device_telemetry\` (
        \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,
        \`dev_id\` VARCHAR(100) NOT NULL,
        \`ts\` VARCHAR(100) DEFAULT NULL,
        \`status\` VARCHAR(50) DEFAULT 'online',
        \`temp\` DECIMAL(6,2) DEFAULT NULL,
        \`tds1\` INT DEFAULT NULL,
        \`tds2\` INT DEFAULT NULL,
        \`mode\` VARCHAR(50) DEFAULT NULL,
        \`tds_range\` INT DEFAULT NULL,
        \`fan\` VARCHAR(50) DEFAULT NULL,
        \`topic\` VARCHAR(255) DEFAULT 'Shudhham/tds/v1/data',
        \`raw_payload\` LONGTEXT DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_dev_id\` (\`dev_id\`),
        INDEX \`idx_ts\` (\`ts\`),
        INDEX \`idx_topic\` (\`topic\`),
        INDEX \`idx_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure 'device_latest_telemetry' table for instantaneous device status
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`device_latest_telemetry\` (
        \`dev_id\` VARCHAR(100) NOT NULL PRIMARY KEY,
        \`ts\` VARCHAR(100) DEFAULT NULL,
        \`status\` VARCHAR(50) DEFAULT 'online',
        \`temp\` DECIMAL(6,2) DEFAULT NULL,
        \`tds1\` INT DEFAULT NULL,
        \`tds2\` INT DEFAULT NULL,
        \`mode\` VARCHAR(50) DEFAULT NULL,
        \`tds_range\` INT DEFAULT NULL,
        \`fan\` VARCHAR(50) DEFAULT NULL,
        \`last_topic\` VARCHAR(255) DEFAULT NULL,
        \`raw_payload\` LONGTEXT DEFAULT NULL,
        \`last_updated\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_latest_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    connection.release();
    isConnected = true;
    lastDbError = null;
    console.log('[MySQL Database] Schema verified & active!');
    return true;
  } catch (error) {
    isConnected = false;
    lastDbError = error.message;
    console.warn(`[MySQL Database] Connection warning: ${error.message}`);
    return false;
  }
}

/**
 * Helper to run queries directly against MySQL pool
 */
export async function query(sql, params = []) {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  try {
    const [rows] = await pool.query(sql, params);
    isConnected = true;
    lastDbError = null;
    return rows;
  } catch (err) {
    if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ETIMEDOUT') {
      console.warn('[MySQL Database] Pool connection dropped (' + err.code + '), resetting pool and retrying query...');
      try {
        await pool.end().catch(() => { });
      } catch (e) { }
      pool = mysql.createPool(dbConfig);
      const [rows] = await pool.query(sql, params);
      isConnected = true;
      lastDbError = null;
      return rows;
    }
    throw err;
  }
}

export function isMySQLActive() {
  if (!pool && dbConfig.host && dbConfig.database) {
    try {
      pool = mysql.createPool(dbConfig);
    } catch (_) {}
  }
  return Boolean(dbConfig.host && dbConfig.database);
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
