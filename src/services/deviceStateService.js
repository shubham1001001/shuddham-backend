import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, '../../device_fan_states.json');

class DeviceStateService {
  constructor() {
    this.states = {};
    this.loadStates();
  }

  loadStates() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        this.states = { ...this.states, ...data };
      }
    } catch (e) {
      console.warn('[DeviceStateService] Error loading states:', e.message);
    }
  }

  saveStates() {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.states, null, 2), 'utf8');
    } catch (e) {
      console.warn('[DeviceStateService] Error saving states:', e.message);
    }
  }

  getFanState(devId) {
    if (!devId || devId === 'unknown') return 'enable';
    const cleanId = devId.toLowerCase().trim();
    return this.states[cleanId] || 'enable';
  }

  setFanState(devId, state) {
    if (!devId || devId === 'unknown') return;
    const cleanId = devId.toLowerCase().trim();
    const cleanState = (state || 'enable').toLowerCase().trim();
    this.states[cleanId] = cleanState;
    this.saveStates();
    console.log(`[DeviceStateService] Set fan state for ${cleanId} -> ${cleanState}`);
  }
}

export const deviceStateService = new DeviceStateService();
export default deviceStateService;
