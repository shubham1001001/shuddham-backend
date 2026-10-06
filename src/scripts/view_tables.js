import { initDatabase, query } from '../config/db.js';

async function viewTables() {
  await initDatabase();

  console.log('\n===============================================================');
  console.log('               📊 SHUDDHAM MYSQL DATABASE TABLES               ');
  console.log('===============================================================\n');

  // 1. List all tables
  const tables = await query('SHOW TABLES;');
  console.log('📁 Available Tables in database:');
  console.table(tables);

  // 2. View `device_latest_telemetry` table
  console.log('\n---------------------------------------------------------------');
  console.log('📌 1. Table: device_latest_telemetry (Latest Status of Devices)');
  console.log('---------------------------------------------------------------');
  const latestRows = await query('SELECT dev_id, status, temp, tds1, tds2, mode, tds_range, fan, last_updated FROM device_latest_telemetry LIMIT 10;');
  console.table(latestRows);

  // 3. View `device_telemetry` table
  console.log('\n---------------------------------------------------------------');
  console.log('📌 2. Table: device_telemetry (Historical Telemetry Logs)');
  console.log('---------------------------------------------------------------');
  const historyRows = await query('SELECT id, dev_id, ts, status, temp, tds1, tds2, mode, tds_range, fan, created_at FROM device_telemetry ORDER BY id DESC LIMIT 10;');
  console.table(historyRows);

  process.exit(0);
}

viewTables();
