import { initMqttService, publishMessage } from '../services/mqttService.js';
import { initDatabase, query } from '../config/db.js';

async function test() {
  await initDatabase();
  const client = initMqttService();

  client.on('connect', async () => {
    console.log('Connected! Waiting 2 seconds then publishing test payload...');
    setTimeout(async () => {
      const topic = 'Shudhham/tds/v1/data';
      const payload = {
        dev_Id: '2805a520c400',
        ts: '2026-10-06T08:02:17Z',
        status: 'online',
        temp: 28.1,
        tds1: 86,
        tds2: 74,
        mode: 'NF',
        tds_range: 90,
        fan: 'enable'
      };

      console.log('Publishing message:', payload);
      await publishMessage(topic, payload);

      setTimeout(async () => {
        const rows = await query('SELECT * FROM device_latest_telemetry WHERE dev_id = ?', ['2805a520c400']);
        console.log('Database Result from device_latest_telemetry:');
        console.log(JSON.stringify(rows, null, 2));

        const history = await query('SELECT * FROM device_telemetry WHERE dev_id = ? ORDER BY created_at DESC LIMIT 1', ['2805a520c400']);
        console.log('Database Result from device_telemetry:');
        console.log(JSON.stringify(history, null, 2));

        process.exit(0);
      }, 3000);
    }, 2000);
  });
}

test();
