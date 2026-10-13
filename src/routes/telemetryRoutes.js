import express from 'express';
import {
  getLatestDevicesTelemetry,
  getDeviceLatestTelemetry,
  getDeviceTelemetryHistory,
  ingestTelemetryHttp,
  publishMqttCommand,
  sendDeviceCommand,
  sendTdsCommand,
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

// POST /api/telemetry/command - Publish command (T,90, F,1) directly with deviceId
router.post('/command', sendDeviceCommand);

// POST /api/telemetry/tds - Dedicated API to send TDS value (e.g. T,90)
router.post('/tds', sendTdsCommand);
router.get('/tds', sendTdsCommand);
router.post('/set-tds', sendTdsCommand);

// POST /api/telemetry/subconfig - Dedicated SubConfig API
router.post('/subconfig', sendTdsCommand);
router.post('/SubConfig', sendTdsCommand);
router.post('/config', sendTdsCommand);

// POST /api/telemetry/:devId/tds - Dedicated API to send TDS value with deviceId param
router.post('/:devId/tds', sendTdsCommand);
router.post('/:devId/subconfig', sendTdsCommand);

// GET /api/telemetry/:devId/latest - Get latest telemetry for a device
router.get('/:devId/latest', getDeviceLatestTelemetry);

// GET /api/telemetry - Get historical telemetry logs (all devices or with ?devId query)
router.get('/', getDeviceTelemetryHistory);

// GET /api/telemetry/history - Explicit history endpoint
router.get('/history', getDeviceTelemetryHistory);

// GET /api/telemetry/:devId - Get historical telemetry logs for a specific device
router.get('/:devId', getDeviceTelemetryHistory);

export default router;
