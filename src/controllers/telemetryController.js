import { TelemetryRepository } from '../repositories/telemetryRepository.js';
import { getMqttStatus, publish } from '../mqtt/index.js';
import { handleTdsTelemetry } from '../mqtt/handlers/tdsTelemetryHandler.js';
import { deviceStateService } from '../services/deviceStateService.js';

function formatToDayMonthYear(raw) {
  if (!raw) return raw;
  try {
    const str = String(raw).trim();
    if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) return str;

    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}${match[4]}`;
    }

    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const parts = new Intl.DateTimeFormat('en-GB', {
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
      return `${getP('day')}/${getP('month')}/${getP('year')} ${getP('hour')}:${getP('minute')}:${getP('second')}`;
    }
    return str;
  } catch {
    return String(raw);
  }
}

/**
 * Normalizes device MAC address:
 * - Strips colons, spaces, dashes
 * - Lowercases
 * - Maps ESP32 BLE SoftAP MAC ending in '02' to STA Wi-Fi MAC ending in '00'
 */
export function normalizeHardwareDevId(rawId) {
  if (!rawId) return '2805a520c400';
  let clean = String(rawId).replace(/[^a-fA-F0-9]/g, '').toLowerCase();
  if (clean.length === 12 && clean.endsWith('02')) {
    clean = clean.substring(0, 10) + '00';
  }
  return clean || '2805a520c400';
}

/**
 * Normalizes fan state strictly to 'enable' or 'disable'
 */
export function normalizeFanState(raw) {
  if (raw === undefined || raw === null) return 'enable';
  const str = String(raw).trim().toLowerCase();
  if (str === 'disable' || str === 'disabled' || str === '0' || str === 'off' || str === 'false') {
    return 'disable';
  }
  return 'enable';
}

/**
 * Normalizes TDS range strictly to an integer between 50 and 1000
 * Clamps > 990 to 1000
 */
export function normalizeTdsRange(raw) {
  let val = parseInt(raw, 10);
  if (isNaN(val) || val < 50) val = 90;
  if (val > 990) val = 1000;
  return val;
}

/**
 * GET /api/telemetry/latest
 * Get all latest device telemetry states
 */
export async function getLatestDevicesTelemetry(req, res) {
  try {
    const rows = await TelemetryRepository.getAllLatest();
    const formatted = rows.map((r) => ({
      ...r,
      ts: formatToDayMonthYear(r.ts)
    }));

    // Quiet logging for regular polling to keep PM2 terminal clean
    // console.log(`[Poll] ${clientIp} -> ${formatted.length} devices`);

    res.json({
      success: true,
      data: formatted,
      mqtt: getMqttStatus(),
      count: formatted.length
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch latest device telemetry',
      error: err.message
    });
  }
}

/**
 * GET /api/telemetry/:devId/latest
 * Get latest telemetry for a specific device
 */
export async function getDeviceLatestTelemetry(req, res) {
  try {
    const { devId } = req.params;
    const deviceState = await TelemetryRepository.getLatestByDeviceId(devId);

    if (!deviceState) {
      return res.status(404).json({
        success: false,
        message: `No telemetry found for device ID: ${devId}`
      });
    }

    res.json({
      success: true,
      data: {
        ...deviceState,
        ts: formatToDayMonthYear(deviceState.ts)
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device telemetry',
      error: err.message
    });
  }
}

/**
 * GET /api/telemetry/:devId
 * Get historical telemetry logs for a specific device
 */
export async function getDeviceTelemetryHistory(req, res) {
  try {
    let rawDevId = req.params.devId || req.query.devId || req.query.deviceId || req.query.dev_id || '';
    let devId = rawDevId.trim();

    if (devId.toLowerCase() === 'history' || devId.toLowerCase() === 'all' || !devId) {
      devId = '';
    } else {
      devId = normalizeHardwareDevId(devId);
    }

    let limit = Number(req.query.limit);
    if (req.query.limit === 'all' || req.query.all === 'true') {
      limit = 50000;
    } else if (isNaN(limit) || limit <= 0) {
      limit = 100;
    } else {
      limit = Math.min(limit, 50000);
    }

    const offset = Math.max(0, Number(req.query.offset) || 0);

    const { rows, total } = await TelemetryRepository.getHistoryByDeviceId(devId, limit, offset);

    const formattedRows = rows.map((r) => ({
      ...r,
      ts: formatToDayMonthYear(r.ts)
    }));

    res.json({
      success: true,
      data: formattedRows,
      total,
      limit,
      offset,
      deviceId: devId || 'all'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device telemetry history',
      error: err.message
    });
  }
}

/**
 * POST /api/telemetry/ingest
 * Manually ingest or test telemetry over HTTP (passes through MQTT handler)
 */
export async function ingestTelemetryHttp(req, res) {
  try {
    const payload = req.body;
    const topic = req.body.topic || 'Shudhham/tds/v1/data';

    if (!payload.dev_Id && !payload.dev_id && !payload.devId) {
      return res.status(400).json({
        success: false,
        message: 'Missing dev_Id in telemetry payload'
      });
    }

    await handleTdsTelemetry(topic, Buffer.from(JSON.stringify(payload)));

    res.json({
      success: true,
      message: 'Telemetry processed and stored successfully',
      data: payload
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to ingest telemetry',
      error: err.message
    });
  }
}

/**
 * POST /api/telemetry/publish
 * Publish command or test message to MQTT topic
 */
export async function publishMqttCommand(req, res) {
  try {
    const { topic, message } = req.body;
    if (!topic || !message) {
      return res.status(400).json({
        success: false,
        message: 'Topic and message are required'
      });
    }

    let finalMessage = message;
    const msgStr = typeof message === 'object' ? JSON.stringify(message) : String(message);
    const preTMatch = msgStr.match(/T\s*,\s*(\d+)/i);
    if (preTMatch) {
      let tVal = parseInt(preTMatch[1], 10);
      if (tVal > 990) {
        tVal = 1000;
        finalMessage = typeof message === 'object'
          ? { ...message, command: `T,${tVal}`, tds: tVal, tds_range: tVal }
          : `T,${tVal}`;
      }
    }

    await publish(topic, finalMessage);

    // If this is a SubConfig payload or fan command, update database and broadcast full telemetry to AWS IoT
    const isSubConfig = topic.toLowerCase().includes('subconfig');
    let subDevId = 'unknown';
    if (typeof message === 'object' && (message.dev_Id || message.dev_id || message.devId || message.deviceId)) {
      subDevId = (message.dev_Id || message.dev_id || message.devId || message.deviceId).toString().trim();
    } else if (topic) {
      const parts = topic.split('/');
      for (const p of parts) {
        if (p && p.length >= 6 && !['shuddham', 'shudhham', 'devices', 'telemetry', 'data', 'v1', 'tds', 'cmd', 'command', 'subconfig'].includes(p.toLowerCase())) {
          subDevId = p;
          break;
        }
      }
    }

    const rawTdsFromMsg = typeof message === 'object' ? (message.tds_range ?? message.tdsRange ?? message.tds) : null;
    let dynamicTdsRange = rawTdsFromMsg !== null && rawTdsFromMsg !== undefined ? Number(rawTdsFromMsg) : null;
    if (dynamicTdsRange !== null && dynamicTdsRange > 990) {
      dynamicTdsRange = 1000;
    }

    const isFanEnable = msgStr.includes('F,1') || msgStr.toLowerCase().includes('"fan":"enable"') || msgStr.toLowerCase().includes('"fan": "enable"') || (typeof message === 'object' && message.fan === 'enable');
    const isFanDisable = msgStr.includes('F,0') || msgStr.toLowerCase().includes('"fan":"disable"') || msgStr.toLowerCase().includes('"fan": "disable"') || (typeof message === 'object' && message.fan === 'disable');

    // Command published to MQTT broker.
    // Database is NOT updated here — DB is only updated when hardware sends actual telemetry response back!
    const nowKolkata = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
    console.log(`
╔══════════════════════════════════════════════════════════════════
║ 📤 [DYNAMIC API MQTT DISPATCH] • ${nowKolkata}
║ 🎯 Target Dev   : ${subDevId}
║ 📮 Target Topic : ${topic}
║ 📦 JSON Payload : ${JSON.stringify(message)}
║ ⏳ DB Status    : Awaiting hardware telemetry response (No premature DB update)
╚══════════════════════════════════════════════════════════════════`);

    res.json({
      success: true,
      message: `Message published to topic: ${topic}`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to publish MQTT message',
      error: err.message
    });
  }
}

/**
 * POST /api/telemetry/command
 * Dedicated API to publish commands like T,90 or T,1000 or F,1 to device
 */
export async function sendDeviceCommand(req, res) {
  try {
    let { deviceId, command } = req.body;
    if (!deviceId || !command) {
      return res.status(400).json({
        success: false,
        message: 'deviceId and command are required'
      });
    }

    const cleanDevId = normalizeHardwareDevId(deviceId);
    let cmdStr = String(command).trim();
    const tMatch = cmdStr.match(/^T\s*,\s*(\d+)/i);
    let targetTds = null;
    if (tMatch) {
      targetTds = normalizeTdsRange(tMatch[1]);
      cmdStr = `T,${targetTds}`;
      command = cmdStr;
    }

    const existing = await TelemetryRepository.getLatestByDeviceId(cleanDevId);
    let fanState = existing?.fan || 'enable';
    if (cmdStr.includes('F,1')) fanState = 'enable';
    if (cmdStr.includes('F,0')) fanState = 'disable';
    deviceStateService.setFanState(cleanDevId, fanState);

    const topic = `Shudhham/${cleanDevId}/v1/command`;
    await publish(topic, command);

    // Also dispatch SubConfig to Shudhham/tds/v1/SubConfig
    const effectiveTds = targetTds !== null ? targetTds : (existing?.tds_range || 200);
    const subConfigPayload = {
      dev_Id: cleanDevId,
      tds_range: effectiveTds,
      fan: fanState
    };
    try {
      await publish('Shudhham/tds/v1/SubConfig', subConfigPayload);
    } catch (_) {}

    // Command published to MQTT broker.
    // Database is NOT updated here — DB is only updated when hardware sends actual telemetry response back!

    console.log(`
╔══════════════════════════════════════════════════════════════════
║ 🚀 [DEVICE COMMAND DISPATCH] • ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
║ 🎯 Device ID    : ${deviceId}
║ 💬 Command      : "${command}" ${targetTds !== null ? `(Target TDS: ${targetTds} PPM${targetTds === 1000 ? ' - Snapped because > 990' : ''})` : ''}
║ 📮 Target Topic : ${topic}
╚══════════════════════════════════════════════════════════════════`);

    res.json({
      success: true,
      message: `Command "${command}" published to ${topic}`,
      topic,
      command
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to send device command',
      error: err.message
    });
  }
}

/**
 * POST /api/telemetry/tds
 * POST /api/telemetry/set-tds
 * POST /api/telemetry/:devId/tds
 * Dedicated API to send TDS value command (e.g. T,90) to purifier device via MQTT and update database
 */
export async function sendTdsCommand(req, res) {
  try {
    let devId = req.params?.devId || req.body?.deviceId || req.body?.devId || req.body?.dev_id || req.query?.deviceId || req.query?.devId;
    
    // Extract TDS value from different common payload formats
    let rawTds = req.body?.tds !== undefined 
      ? req.body.tds 
      : (req.query?.tds !== undefined 
          ? req.query.tds 
          : (req.body?.value !== undefined 
              ? req.body.value 
              : (req.query?.value !== undefined 
                  ? req.query.value 
                  : (req.body?.tdsValue !== undefined 
                      ? req.body.tdsValue 
                      : req.body?.tds_range))));

    // Also parse if direct command string like "T,90" was passed
    const cmdStr = req.body?.command || req.query?.command;
    if (cmdStr) {
      const match = String(cmdStr).match(/T\s*,\s*(\d+)/i);
      if (match) {
        rawTds = match[1];
      }
    }

    // Default to 90 if not provided or empty
    let tdsValue = 90;
    if (rawTds !== undefined && rawTds !== null && rawTds !== '' && !isNaN(Number(rawTds))) {
      tdsValue = parseInt(rawTds, 10);
    }

    // TDS Rule: 990 ke above jane par value automatically 1000 ho jayegi MQTT server ke liye
    if (tdsValue > 990) {
      tdsValue = 1000;
    }

    // Auto-detect deviceId from DB if omitted
    if (!devId) {
      try {
        const latest = await TelemetryRepository.getAllLatest();
        if (latest && latest.length > 0 && latest[0].dev_id) {
          devId = latest[0].dev_id;
        }
      } catch (err) {
        console.warn('[Telemetry API] Could not auto-detect latest device:', err.message);
      }
    }

    devId = normalizeHardwareDevId(devId);
    tdsValue = normalizeTdsRange(rawTds);
    const command = `T,${tdsValue}`;

    // Get current fan state or use requested fan state
    const existing = await TelemetryRepository.getLatestByDeviceId(devId);
    const fanState = normalizeFanState(req.body?.fan ?? req.query?.fan ?? existing?.fan);
    deviceStateService.setFanState(devId, fanState);

    // Construct SubConfig JSON payload: {"dev_Id":"2805a520c400","tds_range":200,"fan":"disable"}
    const subConfigPayload = {
      dev_Id: devId,
      tds_range: tdsValue,
      fan: fanState
    };

    const subConfigTopic = 'Shudhham/tds/v1/SubConfig';
    const subConfigTopicAlt = 'Shuddham/tds/v1/SubConfig';
    const primaryTopic = `Shudhham/${devId}/v1/command`;
    const altTopic = `Shuddham/${devId}/v1/command`;

    let mqttPublished = false;
    let mqttError = null;

    // Publish to AWS IoT MQTT broker:
    // Only single command: Shudhham/tds/v1/SubConfig (JSON payload)
    try {
      await publish(subConfigTopic, subConfigPayload);
      mqttPublished = true;
      try { await publish(subConfigTopicAlt, subConfigPayload); } catch (_) {}
    } catch (pubErr) {
      console.warn(`[Telemetry API] MQTT publish error for topic ${subConfigTopic}:`, pubErr.message);
      mqttError = pubErr.message;
    }

    // Command published to MQTT broker.
    // Database is NOT updated here — DB is only updated when hardware sends actual telemetry response back!
    let dbUpdated = false;

    console.log(`
╔══════════════════════════════════════════════════════════════════
║ 📤 [COMMAND DISPATCHED TO PURIFIER] • ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
║ 🎯 Target Device   : ${devId}
║ 💧 Target TDS Limit : ${tdsValue} PPM
║ 🌀 Cooling Fan State: ${fanState.toUpperCase()}
║ 💬 Raw Command     : "${command}"
║ 📮 MQTT Topic      : ${subConfigTopic}
║ 📡 AWS MQTT Broker : ${mqttPublished ? '✅ Published Successfully' : '⚠️ Publish Failed: ' + mqttError}
║ ℹ️ DB Update Policy: Awaiting hardware confirmation packet before DB save
╚══════════════════════════════════════════════════════════════════`);

    return res.json({
      success: true,
      message: `SubConfig published successfully to ${subConfigTopic}`,
      data: {
        topic: subConfigTopic,
        payload: subConfigPayload,
        command,
        mqttPublished,
        mqttError: mqttPublished ? null : mqttError,
        dbUpdated
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to send TDS command',
      error: err.message
    });
  }
}

/**
 * GET /api/telemetry/status
 * Get MQTT connection status and topic info
 */
export async function getMqttServiceStatus(req, res) {
  res.json({
    success: true,
    data: getMqttStatus()
  });
}

