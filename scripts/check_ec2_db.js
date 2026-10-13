import { execSync } from 'child_process';
import path from 'path';

const pem = path.join(process.env.USERPROFILE, 'Downloads', 'ShuddamWater.pem');

function runSql(sql) {
  const cmd = `ssh -i "${pem}" ubuntu@3.88.13.76 "sudo mysql -e \\"${sql}\\""`;
  return execSync(cmd).toString();
}

console.log('--- TABLES IN shuddham_db ---');
console.log(runSql('USE shuddham_db; SHOW TABLES;'));

console.log('--- GROUP BY DEV_ID IN device_telemetry ---');
console.log(runSql('USE shuddham_db; SELECT dev_id, count(*) as count, min(created_at) as first_seen, max(created_at) as last_seen FROM device_telemetry GROUP BY dev_id;'));

console.log('--- LATEST 10 IN device_telemetry ---');
console.log(runSql('USE shuddham_db; SELECT id, dev_id, ts, status, tds1, tds2, tds_range, fan, topic, created_at FROM device_telemetry ORDER BY id DESC LIMIT 10;'));
