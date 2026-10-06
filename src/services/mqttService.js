import mqtt from 'mqtt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Search certificate paths
function getCertPath(filename) {
  const possiblePaths = [
    path.join(__dirname, '..', '..', 'certs', filename),
    path.join(__dirname, '..', '..', '..', 'SuddhamWaterCertificate', filename),
    path.join(process.cwd(), 'certs', filename),
    path.join(process.cwd(), '..', 'SuddhamWaterCertificate', filename),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

function readCertFile(filename, fallbackText = '') {
  const p = getCertPath(filename);
  if (p && fs.existsSync(p)) {
    return fs.readFileSync(p);
  }
  if (fallbackText) {
    return Buffer.from(fallbackText);
  }
  return null;
}

function readConfigFile(filename, defaultVal = '') {
  const p = getCertPath(filename);
  if (p && fs.existsSync(p)) {
    return fs.readFileSync(p, 'utf8').trim();
  }
  return defaultVal;
}

let mqttClient = null;
let isMqttConnected = false;
let lastMqttError = null;

const TOPICS = [
  'Shudhham/tds/v1/data',
  'Shuddham/tds/v1/data',
  'Shudhham/+/v1/data',
  'Shuddham/+/v1/data',
];

/**
 * Initialize AWS IoT MQTT Connection with Mutual TLS Certificates
 */
export function initMqttService() {
  try {
    const brokerHost = process.env.MQTT_BROKER || readConfigFile('brokeraddress', 'a3873y4hoikxuq-ats.iot.us-east-1.amazonaws.com');
    const port = Number(process.env.MQTT_PORT || readConfigFile('port', '8883')) || 8883;

    const caCert = readCertFile('CA.pem');
    const clientCert = readCertFile('certificate.pem.crt');
    const privateKey = readCertFile('private.pem.key');

    if (!caCert || !clientCert || !privateKey) {
      console.warn('[AWS IoT MQTT] Missing certificate files. Ensure CA.pem, certificate.pem.crt and private.pem.key exist in certs/ directory.');
      return null;
    }

    const clientId = process.env.MQTT_CLIENT_ID || `shuddham-backend-${Date.now()}`;

    const options = {
      host: brokerHost,
      port: port,
      protocol: 'mqtts',
      clientId: clientId,
      ca: caCert,
      cert: clientCert,
      key: privateKey,
      rejectUnauthorized: true,
      keepalive: 60,
      reconnectPeriod: 5000,
      connectTimeout: 30 * 1000,
      clean: true
    };

    console.log(`[AWS IoT MQTT] Connecting to mqtts://${brokerHost}:${port} (Client ID: ${clientId})...`);

    mqttClient = mqtt.connect(options);

    mqttClient.on('connect', () => {
      isMqttConnected = true;
      lastMqttError = null;
      console.log(`[AWS IoT MQTT] Connected successfully to ${brokerHost}:${port}`);

      // Subscribe to all Shuddham TDS telemetry topics
      TOPICS.forEach((topic) => {
        mqttClient.subscribe(topic, { qos: 1 }, (err) => {
          if (err) {
            console.error(`[AWS IoT MQTT] Failed to subscribe to ${topic}:`, err.message);
          } else {
            console.log(`[AWS IoT MQTT] Subscribed to topic: ${topic}`);
          }
        });
      });
    });

    mqttClient.on('message', async (topic, payload) => {
      try {
        const rawString = payload.toString();
        console.log(`[AWS IoT MQTT] Received message on [${topic}]:`, rawString);

        let data = {};
        try {
          data = JSON.parse(rawString);
        } catch (parseErr) {
          console.warn(`[AWS IoT MQTT] Non-JSON payload on ${topic}:`, rawString);
          return;
        }

        await processAndSaveTelemetry(topic, data, rawString);
      } catch (msgErr) {
        console.error('[AWS IoT MQTT] Error handling incoming telemetry:', msgErr.message);
      }
    });

    mqttClient.on('error', (err) => {
      isMqttConnected = false;
      lastMqttError = err.message;
      console.error('[AWS IoT MQTT] Connection error:', err.message);
    });

    mqttClient.on('offline', () => {
      isMqttConnected = false;
      console.warn('[AWS IoT MQTT] Client went offline, auto-reconnecting...');
    });

    mqttClient.on('reconnect', () => {
      console.log('[AWS IoT MQTT] Attempting reconnection...');
    });

    return mqttClient;
  } catch (err) {
    isMqttConnected = false;
    lastMqttError = err.message;
    console.error('[AWS IoT MQTT] Init error:', err.message);
    return null;
  }
}

/**
 * Process and store device telemetry into MySQL database
 */
export async function processAndSaveTelemetry(topic, data, rawPayload = '') {
  try {
    const devId = (data.dev_Id || data.dev_id || data.devId || data.deviceId || 'unknown').toString().trim();
    const ts = data.ts || new Date().toISOString();
    const status = (data.status || 'online').toString().toLowerCase();
    const temp = data.temp !== undefined && data.temp !== null ? Number(data.temp) : null;
    const tds1 = data.tds1 !== undefined && data.tds1 !== null ? parseInt(data.tds1, 10) : null;
    const tds2 = data.tds2 !== undefined && data.tds2 !== null ? parseInt(data.tds2, 10) : null;
    const mode = data.mode ? data.mode.toString() : null;
    const tdsRange = data.tds_range !== undefined && data.tds_range !== null ? parseInt(data.tds_range, 10) : null;
    const fan = data.fan ? data.fan.toString() : null;

    const payloadJson = rawPayload || JSON.stringify(data);

    // 1. Insert into historical telemetry table
    await query(
      `INSERT INTO device_telemetry 
        (dev_id, ts, status, temp, tds1, tds2, mode, tds_range, fan, topic, raw_payload) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [devId, ts, status, temp, tds1, tds2, mode, tdsRange, fan, topic, payloadJson]
    );

    // 2. Upsert into latest telemetry table for instant dashboard lookup
    await query(
      `INSERT INTO device_latest_telemetry 
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
        last_updated = CURRENT_TIMESTAMP`,
      [devId, ts, status, temp, tds1, tds2, mode, tdsRange, fan, topic, payloadJson]
    );

    console.log(`[AWS IoT MQTT] Saved telemetry for device: ${devId} (TDS1: ${tds1}, TDS2: ${tds2}, Temp: ${temp}°C, Mode: ${mode})`);
    return true;
  } catch (dbErr) {
    console.error('[AWS IoT MQTT] Database insert error:', dbErr.message);
    throw dbErr;
  }
}

/**
 * Publish message/command to an MQTT topic
 */
export function publishMessage(topic, message, qos = 1) {
  return new Promise((resolve, reject) => {
    if (!mqttClient || !isMqttConnected) {
      return reject(new Error('MQTT client is not connected to AWS IoT broker'));
    }

    const payload = typeof message === 'object' ? JSON.stringify(message) : message.toString();

    mqttClient.publish(topic, payload, { qos }, (err) => {
      if (err) {
        console.error(`[AWS IoT MQTT] Failed to publish to ${topic}:`, err.message);
        return reject(err);
      }
      console.log(`[AWS IoT MQTT] Successfully published to ${topic}:`, payload);
      resolve(true);
    });
  });
}

/**
 * Get MQTT Connection Status
 */
export function getMqttStatus() {
  return {
    connected: isMqttConnected,
    topics: TOPICS,
    error: lastMqttError
  };
}

export default {
  initMqttService,
  processAndSaveTelemetry,
  publishMessage,
  getMqttStatus
};
