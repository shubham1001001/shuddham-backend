import mysql from 'mysql2/promise';

async function seedCloud() {
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

    // 1. Users table
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

    const users = [
      ['usr-superadmin', 'Super Admin', 'superadmin@gmail.com', '9800011100', '123456', 'Super Admin', 'HQ Executive Office'],
      ['usr-testadmin', 'Shubham Admin', 'testadmin@gmail.com', '9876543210', '123456', 'Admin', 'Operations']
    ];
    for (const u of users) {
      await conn.query(`
        INSERT INTO users (id, full_name, email, phone, password, role, city)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE password = VALUES(password), role = VALUES(role)
      `, u);
    }

    // 2. Categories table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS device_categories (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        prefix VARCHAR(20) NOT NULL UNIQUE,
        description TEXT DEFAULT NULL,
        price DECIMAL(10,2) DEFAULT 0.00,
        specifications TEXT DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_prefix (prefix)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const categories = [
      ['cat-1', 'Digital TDS Meters', 'TDS', 'Precision water quality tester measuring total dissolved solids in ppm.', 499.00, '0-9990 ppm range, ±2% accuracy', 1],
      ['cat-2', 'Smart pH Sensors', 'PH', 'Digital pH testing probe with automatic temperature compensation.', 899.00, '0.00-14.00 pH range, ±0.01 accuracy', 1],
      ['cat-3', 'Pressure Pumps', 'PMP', 'High-pressure booster pumps for residential and commercial filtration units.', 3499.00, '120 PSI, 1.2 LPM flow rate', 1],
      ['cat-4', 'UV Disinfection Lamps', 'UV', 'Germicidal ultraviolet lamp tubes for eliminating bacteria and viruses.', 650.00, '11W Philips tube, 9000 hours life', 1],
      ['cat-5', 'Sediment Cartridges', 'FLT', 'Multi-layer spun polypropylene sediment filters for pre-filtration.', 250.00, '5 Micron rating, 10-inch standard', 1]
    ];
    for (const c of categories) {
      await conn.query(`
        INSERT INTO device_categories (id, name, prefix, description, price, specifications, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price)
      `, c);
    }

    // 3. Inventory table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        device_id VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        category VARCHAR(100) NOT NULL,
        prefix VARCHAR(20) NOT NULL,
        serial_number VARCHAR(100) NOT NULL UNIQUE,
        mac_address VARCHAR(50) DEFAULT NULL,
        stock_quantity INT DEFAULT 1,
        min_stock_alert INT DEFAULT 5,
        unit_price DECIMAL(10,2) DEFAULT 0.00,
        total_value DECIMAL(12,2) DEFAULT 0.00,
        status ENUM('In Stock', 'Assigned', 'Installed', 'Under Maintenance', 'Retired') DEFAULT 'In Stock',
        location VARCHAR(100) DEFAULT 'Central Warehouse',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_device_id (device_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const inventory = [
      ['inv-1', 'TDS-001', 'Digital TDS Meter Pro v2', 'Digital TDS Meters', 'TDS', 'SN-TDS-8821', '00:1A:2B:3C:4D:5E', 25, 5, 499.00, 12475.00, 'In Stock', 'Central Warehouse - Shelf A1'],
      ['inv-2', 'PH-001', 'Smart pH Testing Sensor', 'Smart pH Sensors', 'PH', 'SN-PH-9912', '00:1A:2B:3C:4D:5F', 18, 5, 899.00, 16182.00, 'In Stock', 'Central Warehouse - Shelf A2'],
      ['inv-3', 'PMP-001', 'High-Pressure Booster Pump 120PSI', 'Pressure Pumps', 'PMP', 'SN-PMP-1044', '00:1A:2B:3C:4D:6A', 8, 3, 3499.00, 27992.00, 'In Stock', 'Equipment Hub - Bay 3'],
      ['inv-4', 'UV-001', 'UV Disinfection Lamp 11W', 'UV Disinfection Lamps', 'UV', 'SN-UV-4420', '00:1A:2B:3C:4D:6B', 30, 8, 650.00, 19500.00, 'In Stock', 'Central Warehouse - Shelf B1'],
      ['inv-5', 'FLT-001', 'Multi-Layer Sediment Filter 5 Micron', 'Sediment Cartridges', 'FLT', 'SN-FLT-7701', '00:1A:2B:3C:4D:6C', 45, 10, 250.00, 11250.00, 'In Stock', 'Central Warehouse - Shelf B2']
    ];
    for (const item of inventory) {
      await conn.query(`
        INSERT INTO inventory (id, device_id, name, category, prefix, serial_number, mac_address, stock_quantity, min_stock_alert, unit_price, total_value, status, location)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), stock_quantity = VALUES(stock_quantity)
      `, item);
    }

    console.log('✅ All tables and initial data successfully seeded into TiDB Cloud!');
    await conn.end();
  } catch(err) {
    console.error('Seed Error:', err);
  }
}

seedCloud();
