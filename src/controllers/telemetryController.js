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
    const { devId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    const offset = Number(req.query.offset) || 0;

    const { rows, total } = await TelemetryRepository.getHistoryByDeviceId(devId, limit, offset);

    res.json({
      success: true,
      data: rows,
      total,
      limit,
      offset
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

    await publish(topic, message);

    // If this was a fan enable command or payload, update database and broadcast full telemetry to AWS IoT
    const msgStr = typeof message === 'object' ? JSON.stringify(message) : String(message);
    const isFanEnable = msgStr.includes('F,1') || msgStr.toLowerCase().includes('"fan":"enable"') || msgStr.toLowerCase().includes('"fan": "enable"');
    const isFanDisable = msgStr.includes('F,0') || msgStr.toLowerCase().includes('"fan":"disable"') || msgStr.toLowerCase().includes('"fan": "disable"');

    if (isFanEnable || isFanDisable) {
      const fanState = isFanEnable ? 'enable' : 'disable';
      let devId = 'unknown';
      if (typeof message === 'object' && (message.dev_Id || message.dev_id || message.devId)) {
        devId = (message.dev_Id || message.dev_id || message.devId).toString().trim();
      } else if (topic) {
        const parts = topic.split('/');
        for (const p of parts) {
          if (p && p.length >= 6 && !['shuddham', 'shudhham', 'devices', 'telemetry', 'data', 'v1', 'tds', 'cmd', 'command'].includes(p.toLowerCase())) {
            devId = p;
            break;
          }
        }
      }

      deviceStateService.setFanState(devId, fanState);

      const existing = await TelemetryRepository.getLatestByDeviceId(devId);
      const temp = existing?.temp ? Number(existing.temp) : 31.2;
      const tds1 = existing?.tds1 !== null && existing?.tds1 !== undefined ? existing.tds1 : 58;
      const tds2 = existing?.tds2 !== null && existing?.tds2 !== undefined ? existing.tds2 : 52;
      const mode = existing?.mode || 'NF';
      const tdsRange = existing?.tds_range || 90;

      const d = new Date();
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
      const ts = `${getP('day')}/${getP('month')}/${getP('year')} ${getP('hour')}:${getP('minute')}:${getP('second')}`;

      const updatedRecord = {
        devId,
        ts,
        status: 'online',
        temp,
        tds1,
        tds2,
        mode,
        tdsRange,
        fan: fanState,
        topic: 'Shudhham/tds/v1/data',
        rawPayload: JSON.stringify({
          dev_Id: devId,
          ts: new Date().toISOString(),
          status: 'online',
          temp,
          tds1,
          tds2,
          mode,
          tds_range: tdsRange,
          fan: fanState
        })
      };

      await TelemetryRepository.upsertLatestDeviceState(updatedRecord);
      await TelemetryRepository.insertHistoricalLog(updatedRecord);
    }

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
 * GET /api/telemetry/status
 * Get MQTT connection status and topic info
 */
export async function getMqttServiceStatus(req, res) {
  res.json({
    success: true,
    data: getMqttStatus()
  });
}
