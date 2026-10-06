import { initMqtt, publish } from '../mqtt/index.js';
import { initDatabase } from '../config/db.js';
import { TelemetryRepository } from '../repositories/telemetryRepository.js';

async function testCleanArchitecture() {
  await initDatabase();
  const client = initMqtt();

  client.on('connect', async () => {
    console.log('Connected! Testing clean architecture pipeline in 2s...');
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
      await publish(topic, payload);

      setTimeout(async () => {
        const latest = await TelemetryRepository.getLatestByDeviceId('2805a520c400');
        console.log('Latest State via TelemetryRepository:');
        console.log(JSON.stringify(latest, null, 2));

        const history = await TelemetryRepository.getHistoryByDeviceId('2805a520c400', 1);
        console.log('History Log via TelemetryRepository:');
        console.log(JSON.stringify(history, null, 2));

        process.exit(0);
      }, 2500);
    }, 2000);
  });
}

testCleanArchitecture();
