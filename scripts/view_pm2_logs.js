import { execSync } from 'child_process';
import path from 'path';

const pem = path.join(process.env.USERPROFILE, 'Downloads', 'ShuddamWater.pem');

function runSsh(cmd) {
  const full = `ssh -i "${pem}" ubuntu@3.88.13.76 "${cmd}"`;
  return execSync(full).toString();
}

console.log('--- PM2 LOGS ---');
console.log(runSsh('pm2 logs shuddham-backend --lines 60 --nostream'));
