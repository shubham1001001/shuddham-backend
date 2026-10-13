import { execSync } from 'child_process';
import path from 'path';

const pem = path.join(process.env.USERPROFILE, 'Downloads', 'ShuddamWater.pem');

function runSsh(cmd) {
  const full = `ssh -i "${pem}" -o StrictHostKeyChecking=no ubuntu@3.88.13.76 "${cmd}"`;
  console.log(`[Deploy Admin] Running: ${cmd}`);
  const out = execSync(full).toString();
  console.log(out);
  return out;
}

console.log('--- DEPLOYING ADMIN PANEL TO EC2 ---');
runSsh('cd /home/ubuntu/shuddham-admin-panel && git fetch origin && git reset --hard origin/main && npm run build && pm2 restart shuddham-frontend');
console.log('--- ADMIN PANEL DEPLOYED SUCCESSFULLY ---');
