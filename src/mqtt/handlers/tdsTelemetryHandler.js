import { TelemetryRepository } from '../../repositories/telemetryRepository.js';

/**
 * Handles incoming messages for topic 'Shudhham/tds/v1/data'
 * Payload structure:
 * {
 *   "dev_Id": "2805a520c400",
 *   "ts": "2026-10-06T08:02:17Z",
 *   "status": "online",
 *   "temp": 28.1,
 *   "tds1": 86,
 *   "tds2": 74,
 *   "mode": "NF",
 *   "tds_range": 90,
 *   "fan": "enable"
 * }
 */
export async function handleTdsTelemetry(topic, rawBuffer) {
  try {
    const rawString = rawBuffer.toString();
    console.log(`[MQTT Handler] Received message on [${topic}]:`, rawString);

    let data = {};
    try {
      data = JSON.parse(rawString);
    } catch (parseErr) {
      console.warn(`[MQTT Handler] Invalid JSON on topic ${topic}:`, rawString);
      return false;
    }

    const devId = (data.dev_Id || data.dev_id || data.devId || data.deviceId || 'unknown').toString().trim();
    const ts = data.ts || new Date().toISOString();
    const status = (data.status || 'online').toString().toLowerCase();
    const temp = data.temp !== undefined && data.temp !== null ? Number(data.temp) : null;
    const tds1 = data.tds1 !== undefined && data.tds1 !== null ? parseInt(data.tds1, 10) : null;
    const tds2 = data.tds2 !== undefined && data.tds2 !== null ? parseInt(data.tds2, 10) : null;
    const mode = data.mode ? data.mode.toString() : null;
    const tdsRange = data.tds_range !== undefined && data.tds_range !== null ? parseInt(data.tds_range, 10) : null;
    const fan = data.fan ? data.fan.toString() : null;

    const payloadRecord = {
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
      rawPayload: rawString
    };

    // 1. Insert into historical time-series logs
    await TelemetryRepository.insertHistoricalLog(payloadRecord);

    // 2. Update the real-time latest device snapshot
    await TelemetryRepository.upsertLatestDeviceState(payloadRecord);

    console.log(`[MQTT Handler] Saved device ${devId} telemetry | TDS1: ${tds1}, TDS2: ${tds2}, Temp: ${temp}°C, Mode: ${mode}`);
    return true;
  } catch (err) {
    console.error('[MQTT Handler] Failed to process telemetry:', err.message);
    throw err;
  }
}

export default handleTdsTelemetry;
