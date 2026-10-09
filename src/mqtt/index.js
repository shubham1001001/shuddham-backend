import { getMqttClient, isClientConnected, getClientLastError } from './client.js';
import { SUBSCRIBED_TOPICS, MQTT_TOPICS } from './topics.js';
import { handleTdsTelemetry } from './handlers/tdsTelemetryHandler.js';

/**
 * Initializes MQTT subscription and binds topic routers
 */
export function initMqtt() {
  const client = getMqttClient();
  if (!client) {
    return null;
  }

  // Subscribe to predefined topics on connect
  client.on('connect', () => {
    SUBSCRIBED_TOPICS.forEach((topic) => {
      client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`[MQTT Router] Failed to subscribe to topic [${topic}]:`, err.message);
        } else {
          console.log(`[MQTT Router] Subscribed to topic: ${topic}`);
        }
      });
    });
  });

  // Central message dispatcher / router
  client.on('message', async (topic, payload) => {
    try {
      const lowerTopic = topic.toLowerCase();
      console.log(`[MQTT Router] Received message on topic: [${topic}]`);
      if (
        lowerTopic.includes('tds') ||
        lowerTopic.includes('telemetry') ||
        lowerTopic.includes('data') ||
        lowerTopic.startsWith('shuddham/') ||
        lowerTopic.startsWith('shudhham/')
      ) {
        await handleTdsTelemetry(topic, payload);
      } else {
        console.log(`[MQTT Router] Unhandled topic: [${topic}]`);
      }
    } catch (err) {
      console.error(`[MQTT Router] Error processing topic [${topic}]:`, err.message);
    }
  });

  return client;
}

/**
 * Publishes a payload to an MQTT topic
 */
export function publish(topic, message, qos = 1) {
  return new Promise((resolve, reject) => {
    const client = getMqttClient();
    if (!client || !isClientConnected()) {
      return reject(new Error('MQTT client is not connected to AWS IoT Core broker'));
    }

    const payload = typeof message === 'object' ? JSON.stringify(message) : message.toString();

    client.publish(topic, payload, { qos }, (err) => {
      if (err) {
        console.error(`[MQTT Router] Publish failed to [${topic}]:`, err.message);
        return reject(err);
      }
      console.log(`[MQTT Router] Published to [${topic}]:`, payload);
      resolve(true);
    });
  });
}

/**
 * Returns the current MQTT status
 */
export function getMqttStatus() {
  return {
    connected: isClientConnected(),
    topics: SUBSCRIBED_TOPICS,
    error: getClientLastError()
  };
}

export default {
  initMqtt,
  publish,
  getMqttStatus
};
