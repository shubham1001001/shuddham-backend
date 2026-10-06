import { query } from '../config/db.js';
import { getMqttStatus, publishMessage, processAndSaveTelemetry } from '../services/mqttService.js';

/**
 * Get all latest device telemetry states
 */
export async function getLatestDevicesTelemetry(req, res) {
  try {
    const rows = await query(
      `SELECT * FROM device_latest_telemetry ORDER BY last_updated DESC`
    );

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
 * Get latest telemetry for a specific device
 */
export async function getDeviceLatestTelemetry(req, res) {
  try {
    const { devId } = req.params;
    const rows = await query(
      `SELECT * FROM device_latest_telemetry WHERE dev_id = ? LIMIT 1`,
      [devId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No telemetry found for device ID: ${devId}`
      });
    }

    res.json({
      success: true,
      data: rows[0]
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
 * Get historical telemetry logs for a specific device
 */
export async function getDeviceTelemetryHistory(req, res) {
  try {
    const { devId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    const offset = Number(req.query.offset) || 0;

    const rows = await query(
      `SELECT * FROM device_telemetry WHERE dev_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [devId, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*) as total FROM device_telemetry WHERE dev_id = ?`,
      [devId]
    );

    res.json({
      success: true,
      data: rows,
      total: countRes[0]?.total || 0,
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
 * Manually ingest or test telemetry over HTTP (matches MQTT processing)
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

    await processAndSaveTelemetry(topic, payload, JSON.stringify(payload));

    res.json({
      success: true,
      message: 'Telemetry ingested and stored successfully',
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

    await publishMessage(topic, message);

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
 * Get MQTT connection status and topic info
 */
export async function getMqttServiceStatus(req, res) {
  res.json({
    success: true,
    data: getMqttStatus()
  });
}
