import express from 'express';
import {
  getLatestDevicesTelemetry,
  getDeviceLatestTelemetry,
  getDeviceTelemetryHistory,
  ingestTelemetryHttp,
  publishMqttCommand,
  getMqttServiceStatus
} from '../controllers/telemetryController.js';

const router = express.Router();

// GET /api/telemetry/latest - Get latest status of all devices
router.get('/latest', getLatestDevicesTelemetry);

// GET /api/telemetry/status - Get MQTT connection status
router.get('/status', getMqttServiceStatus);

// POST /api/telemetry/ingest - HTTP Ingestion fallback / test
router.post('/ingest', ingestTelemetryHttp);

// POST /api/telemetry/publish - Publish message to MQTT topic
router.post('/publish', publishMqttCommand);

// GET /api/telemetry/:devId/latest - Get latest telemetry for a device
router.get('/:devId/latest', getDeviceLatestTelemetry);

// GET /api/telemetry/:devId - Get historical telemetry logs
router.get('/:devId', getDeviceTelemetryHistory);

export default router;
