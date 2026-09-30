-- ============================================================================
-- Shuddham Water Solutions - MySQL Database Schema
-- Database: shuddham_db
-- Tables: users, sessions
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `shuddham_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `shuddham_db`;

-- 1. Users Table (Admin, Super Admin, Staff)
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `phone` VARCHAR(20) DEFAULT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('Super Admin', 'Admin', 'Staff') NOT NULL DEFAULT 'Admin',
  `city` VARCHAR(100) DEFAULT 'Operations HQ',
  `token` VARCHAR(500) DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `last_login` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_email` (`email`),
  INDEX `idx_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Seed Default Accounts (Password: 123456)
INSERT INTO `users` (`id`, `full_name`, `email`, `phone`, `password`, `role`, `city`)
VALUES 
  ('usr-superadmin', 'Super Admin', 'superadmin@gmail.com', '9800011100', '123456', 'Super Admin', 'HQ Executive Office')
ON DUPLICATE KEY UPDATE 
  `password` = VALUES(`password`),
  `role` = VALUES(`role`);

-- 2.1 Device Categories Table
CREATE TABLE IF NOT EXISTS `device_categories` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `description` VARCHAR(255) DEFAULT NULL,
  `icon` VARCHAR(50) DEFAULT 'Box',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_cat_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2.2 Seed Initial Device Categories
INSERT INTO `device_categories` (`id`, `name`, `description`, `icon`)
VALUES
  ('cat-1', 'Smart IoT RO', 'Wi-Fi & Bluetooth connected smart purifiers with live TDS monitoring', 'Cpu'),
  ('cat-2', 'Alkaline & Mineral RO', 'Multi-stage purifiers with active Copper, Zinc & pH booster technology', 'Droplets'),
  ('cat-3', 'Under-Sink Compact RO', 'Space-saving concealed hydro-filtration units with dedicated faucets', 'Box'),
  ('cat-4', 'Commercial RO Plants', 'High LPH multi-membrane filtration systems for schools, cafes & offices', 'Building2'),
  ('cat-5', 'UV + UF Purifiers', 'Zero-wastage non-RO ultraviolet and ultrafiltration systems for low TDS water', 'ShieldCheck')
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `icon` = VALUES(`icon`);

-- 3. RO Devices Inventory Catalog Table
CREATE TABLE IF NOT EXISTS `inventory` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `sku` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(200) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `stock_quantity` INT NOT NULL DEFAULT 0,
  `min_threshold` INT NOT NULL DEFAULT 5,
  `unit` VARCHAR(20) DEFAULT 'Units',
  `cost_price` DECIMAL(10,2) DEFAULT 0.00,
  `selling_price` DECIMAL(10,2) DEFAULT 0.00,
  `location` VARCHAR(150) DEFAULT 'Depot Bay A - IoT Devices',
  `supplier` VARCHAR(150) DEFAULT 'Shuddham Manufacturing',
  `last_restocked` DATE DEFAULT (CURRENT_DATE),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_sku` (`sku`),
  INDEX `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Seed Initial RO Devices
INSERT INTO `inventory` (`id`, `sku`, `name`, `category`, `stock_quantity`, `min_threshold`, `unit`, `cost_price`, `selling_price`, `location`, `supplier`)
VALUES 
  ('inv-1', 'SHU-RO-PRO10', 'Shuddham Smart RO Pro (IoT Edition - 10L)', 'Smart IoT RO', 18, 5, 'Units', 8500.00, 15999.00, 'Depot Bay A - IoT Devices', 'Shuddham Manufacturing'),
  ('inv-2', 'SHU-RO-ALKA8', 'Shuddham Mineral Alkaline Copper+Zinc RO (8.5L)', 'Alkaline & Mineral RO', 24, 6, 'Units', 7200.00, 13499.00, 'Depot Bay B - Residential', 'Shuddham Manufacturing'),
  ('inv-3', 'SHU-RO-SINK03', 'Shuddham Under-Sink Hydro RO Compact (8L)', 'Under-Sink Compact RO', 12, 4, 'Units', 9500.00, 17999.00, 'Depot Bay C - Premium', 'Shuddham Manufacturing'),
  ('inv-4', 'SHU-RO-COM50', 'Shuddham Commercial RO Plant (50 LPH Heavy Duty)', 'Commercial RO Plants', 6, 2, 'Units', 22000.00, 38500.00, 'Commercial Floor D', 'Shuddham Industrial Works'),
  ('inv-5', 'SHU-RO-HOTCOLD', 'Shuddham Touch Hot & Cold Multi-Stage RO (10L)', 'Smart IoT RO', 8, 3, 'Units', 12500.00, 22999.00, 'Depot Bay A - IoT Devices', 'Shuddham Manufacturing'),
  ('inv-6', 'SHU-RO-ECO06', 'Shuddham EcoSaver Zero-Wastage RO Purifier (7L)', 'Alkaline & Mineral RO', 15, 5, 'Units', 6800.00, 12499.00, 'Depot Bay B - Residential', 'Shuddham Manufacturing'),
  ('inv-7', 'SHU-UV-UF07', 'Shuddham Smart UV+UF Pure Flow Purifier (Non-RO)', 'UV + UF Purifiers', 3, 5, 'Units', 4200.00, 7999.00, 'Depot Bay E - Gravity/UV', 'Shuddham Direct'),
  ('inv-8', 'SHU-RO-COM100', 'Shuddham Commercial 100 LPH Dual-Membrane RO Plant', 'Commercial RO Plants', 0, 2, 'Units', 38000.00, 62000.00, 'Commercial Floor D', 'Shuddham Industrial Works')
ON DUPLICATE KEY UPDATE 
  `name` = VALUES(`name`),
  `stock_quantity` = VALUES(`stock_quantity`),
  `selling_price` = VALUES(`selling_price`);


