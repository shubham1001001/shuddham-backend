import { TelemetryRepository } from '../repositories/telemetryRepository.js';
import { getMqttStatus, publish } from '../mqtt/index.js';
import { handleTdsTelemetry } from '../mqtt/handlers/tdsTelemetryHandler.js';

/**
 * GET /api/telemetry/latest
 * Get all latest device telemetry states
 */
export async function getLatestDevicesTelemetry(req, res) {
  try {
    const rows = await TelemetryRepository.getAllLatest();

    res.json({
      success: true,
      data: rows,
      mqtt: getMqttStatus(),
      count: rows.length
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
      data: deviceState
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
