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

      // Check for raw text commands like T,90 or F,1
      const rawTrim = rawString.trim();
      const isCmdTopic = topic.toLowerCase().includes('command') || topic.toLowerCase().includes('cmd');
      if (isCmdTopic || rawTrim.toUpperCase().startsWith('T,') || rawTrim.toUpperCase().startsWith('F,')) {
        let devId = '';
        const parts = topic.split('/');
        for (const p of parts) {
          if (p && p.length >= 6 && !['shuddham', 'shudhham', 'devices', 'status', 'telemetry', 'data', 'v1', 'tds', 'command', 'cmd'].includes(p.toLowerCase())) {
            devId = p;
            break;
          }
        }
        if (devId) {
          const tMatch = rawTrim.match(/^T\s*,\s*(\d+)/i);
          if (tMatch) {
            let tdsVal = parseInt(tMatch[1], 10);
            if (tdsVal > 990) {
              tdsVal = 1000;
            }
            console.log(`[MQTT Handler] Processed raw TDS command: ${rawTrim} (tds_range: ${tdsVal}) for ${devId}`);
            const existing = await TelemetryRepository.getLatestByDeviceId(devId);
            const updated = {
              devId,
              ts: new Date().toISOString(),
              status: 'online',
              temp: existing?.temp ? Number(existing.temp) : 25.0,
              tds1: existing?.tds1 !== null && existing?.tds1 !== undefined ? existing.tds1 : tdsVal,
              tds2: existing?.tds2 !== null && existing?.tds2 !== undefined ? existing.tds2 : 160,
              mode: existing?.mode || 'RO',
              tdsRange: tdsVal,
              fan: existing?.fan || 'enable',
              topic: 'Shudhham/tds/v1/data',
              rawPayload: JSON.stringify({ dev_Id: devId, command: rawTrim, tds_range: tdsVal })
            };
            await TelemetryRepository.upsertLatestDeviceState(updated);
            return true;
          }
        }
        console.log(`[MQTT Handler] Received command on [${topic}]: ${rawTrim}`);
        return true;
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
    let tdsRange = (data.tds_range !== undefined && data.tds_range !== null) 
      ? parseInt(data.tds_range, 10) 
      : (data.tdsRange !== undefined && data.tdsRange !== null ? parseInt(data.tdsRange, 10) : 90);
    
    // TDS Rule: 990 ke above jane par 1000 treat kiya jayega
    if (tdsRange > 990) {
      tdsRange = 1000;
    }
    
    // Fetch existing device state so partial config payloads (like SubConfig) don't overwrite sensor telemetry with null
    const existing = await TelemetryRepository.getLatestByDeviceId(devId);
    const finalTemp = temp !== null ? temp : (existing?.temp ? Number(existing.temp) : 25.0);
    const finalTds1 = tds1 !== null ? tds1 : (existing?.tds1 !== null && existing?.tds1 !== undefined ? existing.tds1 : 58);
    const finalTds2 = tds2 !== null ? tds2 : (existing?.tds2 !== null && existing?.tds2 !== undefined ? existing.tds2 : 52);
    const finalMode = data.mode ? data.mode.toString() : (existing?.mode || 'RO');

    // Check if this message is a SubConfig or explicit fan command
    const isCommandTopic = topic.toLowerCase().includes('cmd') || topic.toLowerCase().includes('command') || topic.toLowerCase().includes('subconfig');
    const cmdVal = (data.command || data.cmd || '').toString();
    if (isCommandTopic || cmdVal || data.fan) {
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
      temp: finalTemp,
      tds1: finalTds1,
      tds2: finalTds2,
      mode: finalMode,
      tdsRange,
      fan,
      topic,
      rawPayload: rawString
    };

    // 1. Insert into historical time-series logs
    await TelemetryRepository.insertHistoricalLog(payloadRecord);

    // 2. Update the real-time latest device snapshot
    await TelemetryRepository.upsertLatestDeviceState(payloadRecord);

    const isSubConfig = topic.toLowerCase().includes('subconfig');
    const nowKolkata = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
    console.log(`
╔══════════════════════════════════════════════════════════════════
║ 📥 [${isSubConfig ? 'MQTT SUBCONFIG INGESTED' : 'MQTT TELEMETRY RECEIVED'}] • ${nowKolkata}
║ 🎯 Device ID       : ${devId}
║ 📱 Received At     : ${nowKolkata} (Mobile/IoT Event)
║ ☁️ Backend Prev Ts : ${existing?.ts || 'No prior snapshot'}
║ ⏱️ Fresh Saved Ts  : ${ts}
║ 💧 TDS Range       : ${tdsRange} PPM ${tdsRange === 1000 ? '(Rule applied: > 990 -> 1000)' : ''}
║ 🌀 Fan State       : ${fan}
║ 💧 TDS1 / TDS2     : ${finalTds1} PPM / ${finalTds2} PPM
║ 🌡️ Temp            : ${finalTemp}°C | Mode: ${finalMode}
║ 📮 Topic           : ${topic}
╚══════════════════════════════════════════════════════════════════`);



    return true;
  } catch (err) {
    console.error('[MQTT Handler] Failed to process telemetry:', err.message);
    throw err;
  }
}

export default handleTdsTelemetry;
