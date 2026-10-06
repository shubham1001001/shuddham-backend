/**
 * Centralized MQTT Topic Definitions for Shuddham Water IoT
 */
export const MQTT_TOPICS = {
  // Main TDS telemetry topic
  TDS_TELEMETRY: 'Shudhham/tds/v1/data',
  
  // Standardized casing fallback
  TDS_TELEMETRY_ALT: 'Shuddham/tds/v1/data',

  // Wildcards for multi-device scalability
  ALL_TDS_DATA_WILDCARD: 'Shudhham/+/v1/data',
  ALL_TDS_DATA_WILDCARD_ALT: 'Shuddham/+/v1/data',

  // Downlink command topic pattern
  COMMAND_TOPIC: (deviceId) => `Shudhham/${deviceId}/v1/command`
};

export const SUBSCRIBED_TOPICS = [
  MQTT_TOPICS.TDS_TELEMETRY,
  MQTT_TOPICS.TDS_TELEMETRY_ALT,
  MQTT_TOPICS.ALL_TDS_DATA_WILDCARD,
  MQTT_TOPICS.ALL_TDS_DATA_WILDCARD_ALT,
];

export default MQTT_TOPICS;
