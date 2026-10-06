import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function readCertFile(filename) {
  const p = getCertPath(filename);
  if (p && fs.existsSync(p)) {
    return fs.readFileSync(p);
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

export const mqttConfig = {
  host: process.env.MQTT_BROKER || readConfigFile('brokeraddress', 'a3873y4hoikxuq-ats.iot.us-east-1.amazonaws.com'),
  port: Number(process.env.MQTT_PORT || readConfigFile('port', '8883')) || 8883,
  protocol: 'mqtts',
  clientId: process.env.MQTT_CLIENT_ID || `shuddham-backend-${Date.now()}`,
  ca: readCertFile('CA.pem'),
  cert: readCertFile('certificate.pem.crt'),
  key: readCertFile('private.pem.key'),
  rejectUnauthorized: true,
  keepalive: 60,
  reconnectPeriod: 5000,
  connectTimeout: 30 * 1000,
  clean: true
};

export default mqttConfig;
