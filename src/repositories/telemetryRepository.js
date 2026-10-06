import { query } from '../config/db.js';

export class TelemetryRepository {
  /**
   * Save historical telemetry log
   */
  static async insertHistoricalLog({
    devId,
    ts,
    status = 'online',
    temp = null,
    tds1 = null,
    tds2 = null,
    mode = null,
    tdsRange = null,
    fan = null,
    topic = 'Shudhham/tds/v1/data',
    rawPayload = ''
  }) {
    const sql = `
      INSERT INTO device_telemetry 
        (dev_id, ts, status, temp, tds1, tds2, mode, tds_range, fan, topic, raw_payload) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    return query(sql, [
      devId,
      ts,
      status,
      temp,
      tds1,
      tds2,
      mode,
      tdsRange,
      fan,
      topic,
      rawPayload
    ]);
  }

  /**
   * Upsert the latest real-time snapshot of the device
   */
  static async upsertLatestDeviceState({
    devId,
    ts,
    status = 'online',
    temp = null,
    tds1 = null,
    tds2 = null,
    mode = null,
    tdsRange = null,
    fan = null,
    topic = 'Shudhham/tds/v1/data',
    rawPayload = ''
  }) {
    const sql = `
      INSERT INTO device_latest_telemetry 
        (dev_id, ts, status, temp, tds1, tds2, mode, tds_range, fan, last_topic, raw_payload) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        ts = VALUES(ts),
        status = VALUES(status),
        temp = VALUES(temp),
        tds1 = VALUES(tds1),
        tds2 = VALUES(tds2),
        mode = VALUES(mode),
        tds_range = VALUES(tds_range),
        fan = VALUES(fan),
        last_topic = VALUES(last_topic),
        raw_payload = VALUES(raw_payload),
        last_updated = CURRENT_TIMESTAMP
    `;
    return query(sql, [
      devId,
      ts,
      status,
      temp,
      tds1,
      tds2,
      mode,
      tdsRange,
      fan,
      topic,
      rawPayload
    ]);
  }

  /**
   * Get all latest devices telemetry states
   */
  static async getAllLatest() {
    return query(`SELECT * FROM device_latest_telemetry ORDER BY last_updated DESC`);
  }

  /**
   * Get latest telemetry for a specific device
   */
  static async getLatestByDeviceId(devId) {
    const rows = await query(
      `SELECT * FROM device_latest_telemetry WHERE dev_id = ? LIMIT 1`,
      [devId]
    );
    return rows[0] || null;
  }

  /**
   * Get historical telemetry logs for a specific device with pagination
   */
  static async getHistoryByDeviceId(devId, limit = 100, offset = 0) {
    const rows = await query(
      `SELECT * FROM device_telemetry WHERE dev_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [devId, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*) as total FROM device_telemetry WHERE dev_id = ?`,
      [devId]
    );

    return {
      rows,
      total: countRes[0]?.total || 0
    };
  }
}

export default TelemetryRepository;
