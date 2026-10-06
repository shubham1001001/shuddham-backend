import mqtt from 'mqtt';
import { mqttConfig } from '../config/mqtt.config.js';

let clientInstance = null;
let isConnected = false;
let lastError = null;

/**
 * Creates and returns the singleton MQTT client instance connected to AWS IoT Core
 */
export function getMqttClient() {
  if (clientInstance) {
    return clientInstance;
  }

  if (!mqttConfig.ca || !mqttConfig.cert || !mqttConfig.key) {
    console.warn('[MQTT Client] Missing TLS certificates. Ensure CA.pem, certificate.pem.crt, and private.pem.key are present.');
    return null;
  }

  console.log(`[MQTT Client] Connecting to mqtts://${mqttConfig.host}:${mqttConfig.port} as ${mqttConfig.clientId}...`);

  clientInstance = mqtt.connect({
    host: mqttConfig.host,
    port: mqttConfig.port,
    protocol: mqttConfig.protocol,
    clientId: mqttConfig.clientId,
    ca: mqttConfig.ca,
    cert: mqttConfig.cert,
    key: mqttConfig.key,
    rejectUnauthorized: mqttConfig.rejectUnauthorized,
    keepalive: mqttConfig.keepalive,
    reconnectPeriod: mqttConfig.reconnectPeriod,
    connectTimeout: mqttConfig.connectTimeout,
    clean: mqttConfig.clean
  });

  clientInstance.on('connect', () => {
    isConnected = true;
    lastError = null;
    console.log(`[MQTT Client] Connected to AWS IoT Core broker (${mqttConfig.host}:${mqttConfig.port})`);
  });

  clientInstance.on('error', (err) => {
    isConnected = false;
    lastError = err.message;
    console.error('[MQTT Client] Connection error:', err.message);
  });

  clientInstance.on('offline', () => {
    isConnected = false;
    console.warn('[MQTT Client] Client is offline. Auto-reconnecting...');
  });

  clientInstance.on('reconnect', () => {
    console.log('[MQTT Client] Attempting reconnection to AWS IoT broker...');
  });

  clientInstance.on('close', () => {
    isConnected = false;
    console.log('[MQTT Client] Connection closed.');
  });

  return clientInstance;
}

export function isClientConnected() {
  return isConnected;
}

export function getClientLastError() {
  return lastError;
}

export default {
  getMqttClient,
  isClientConnected,
  getClientLastError
};
