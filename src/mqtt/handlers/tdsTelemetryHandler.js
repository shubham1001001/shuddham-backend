import { TelemetryRepository } from '../../repositories/telemetryRepository.js';
import { getMqttClient, isClientConnected } from '../client.js';
import { deviceStateService } from '../../services/deviceStateService.js';

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
      const trimmed = rawString.trim().toLowerCase();
      if (trimmed === 'offline' || trimmed === 'online') {
        let devId = '';
        const parts = topic.split('/');
        for (const p of parts) {
          if (p && p.length >= 6 && !['shuddham', 'shudhham', 'devices', 'status', 'telemetry', 'data', 'v1', 'tds'].includes(p.toLowerCase())) {
            devId = p;
            break;
          }
        }
        if (!devId) {
          const all = await TelemetryRepository.getAllLatest();
          if (all.length > 0) devId = all[0].dev_id;
        }
        if (devId) {
          await TelemetryRepository.updateDeviceStatus(devId, trimmed);
          console.log(`[MQTT Handler] Updated status for device ${devId} -> ${trimmed}`);
          return true;
        }
      }
      console.warn(`[MQTT Handler] Invalid JSON on topic ${topic}:`, rawString);
      return false;
    }

    let devId = (data.dev_Id || data.dev_id || data.devId || data.deviceId || data.id || data.device_id || '').toString().trim();
    if (!devId || devId === 'unknown') {
      const parts = topic.split('/');
      for (const p of parts) {
        if (p && p.length >= 6 && !['shuddham', 'shudhham', 'devices', 'telemetry', 'data', 'v1', 'tds', 'cmd', 'command'].includes(p.toLowerCase())) {
          devId = p;
          break;
        }
      }
    }
    if (!devId) devId = 'unknown';

    const rawTs = data.ts || data.timestamp || new Date();
    let ts;
    try {
      const d = new Date(rawTs);
      if (isNaN(d.getTime())) {
        ts = String(rawTs);
      } else {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).formatToParts(d);
        const getP = (type) => parts.find(p => p.type === type)?.value;
        ts = `${getP('day')}/${getP('month')}/${getP('year')} ${getP('hour')}:${getP('minute')}:${getP('second')}`;
      }
    } catch {
      ts = String(rawTs);
    }
    const status = (data.status || 'online').toString().toLowerCase();
    const temp = data.temp !== undefined && data.temp !== null 
      ? Number(data.temp) 
      : (data.temperature !== undefined && data.temperature !== null ? Number(data.temperature) : null);

    let tds1 = data.tds1 !== undefined && data.tds1 !== null ? parseInt(data.tds1, 10) : null;
    let tds2 = data.tds2 !== undefined && data.tds2 !== null ? parseInt(data.tds2, 10) : null;
    if (tds1 === null && (data.tds !== undefined || data.pure !== undefined || data.purified !== undefined)) {
      tds1 = parseInt(data.tds ?? data.pure ?? data.purified, 10);
    }
    if (tds2 === null && (data.tdsIn !== undefined || data.tds_in !== undefined || data.raw !== undefined || data.inlet !== undefined)) {
      tds2 = parseInt(data.tdsIn ?? data.tds_in ?? data.raw ?? data.inlet, 10);
    }

    const mode = data.mode ? data.mode.toString() : 'NF';
    const tdsRange = (data.tds_range !== undefined && data.tds_range !== null) 
      ? parseInt(data.tds_range, 10) 
      : (data.tdsRange !== undefined && data.tdsRange !== null ? parseInt(data.tdsRange, 10) : 90);
    
    // Check if this message is an explicit fan command
    const isCommandTopic = topic.toLowerCase().includes('cmd') || topic.toLowerCase().includes('command');
    const cmdVal = (data.command || data.cmd || '').toString();
    if (isCommandTopic || cmdVal) {
      if (cmdVal.includes('F,1') || data.fan === 'enable') {
        deviceStateService.setFanState(devId, 'enable');
      } else if (cmdVal.includes('F,0') || data.fan === 'disable') {
        deviceStateService.setFanState(devId, 'disable');
      }
    }

    // Get authoritative fan state for this device
    const targetFanState = deviceStateService.getFanState(devId);
    let fan = targetFanState;

    // Check if we need to auto-republish to AWS IoT Core (when incoming hardware says 'disable' but target is 'enable')
    const shouldRepublishEnableToAws = (targetFanState === 'enable' && data.fan === 'disable');

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

    console.log(`[MQTT Handler] Saved device ${devId} telemetry | TDS1: ${tds1}, TDS2: ${tds2}, Temp: ${temp}°C, Fan: ${fan}, Mode: ${mode}`);

    // 3. If incoming hardware reported 'disable', immediately publish corrected packet with 'enable'
    // back to AWS IoT Core broker so AWS Console subscribers immediately see 'fan': 'enable'!
    if (shouldRepublishEnableToAws) {
      try {
        const client = getMqttClient();
        if (client && isClientConnected()) {
          const awsPayload = JSON.stringify({
            dev_Id: devId,
            ts: new Date().toISOString(),
            status: status || 'online',
            temp: temp,
            tds1: tds1,
            tds2: tds2,
            mode: mode,
            tds_range: tdsRange,
            fan: 'enable'
          });
          client.publish('Shudhham/tds/v1/data', awsPayload, { qos: 1 }, (pubErr) => {
            if (pubErr) {
              console.error('[MQTT Handler] AWS IoT republish error:', pubErr.message);
            } else {
              console.log(`[MQTT Handler] Auto-broadcasted fan:enable to AWS IoT Core topic [Shudhham/tds/v1/data]`);
            }
          });
        }
      } catch (err) {
        console.warn('[MQTT Handler] Failed to broadcast fan enable to AWS IoT:', err.message);
      }
    }

    return true;
  } catch (err) {
    console.error('[MQTT Handler] Failed to process telemetry:', err.message);
    throw err;
  }
}

export default handleTdsTelemetry;
