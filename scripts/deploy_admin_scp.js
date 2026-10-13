import { execSync } from 'child_process';
import path from 'path';

const pem = path.join(process.env.USERPROFILE, 'Downloads', 'ShuddamWater.pem');
const localBuild = path.join('d:', 'Tulsi Inurum Projects', 'Shuddham Water Solutions', 'shuddham-admin-panel', 'build');

console.log('--- 1. UPLOADING LOCAL BUILD TO EC2 ---');
// Upload contents of local build folder to /home/ubuntu/shuddham-admin-panel/build
const scpCmd = `scp -i "${pem}" -o StrictHostKeyChecking=no -r "${localBuild}"/* ubuntu@3.88.13.76:/home/ubuntu/shuddham-admin-panel/build/`;
execSync(scpCmd, { stdio: 'inherit' });

console.log('--- 2. RESTARTING PM2 shuddham-frontend ---');
const restartCmd = `ssh -i "${pem}" -o StrictHostKeyChecking=no ubuntu@3.88.13.76 "pm2 restart shuddham-frontend"`;
execSync(restartCmd, { stdio: 'inherit' });

console.log('--- ADMIN PANEL DEPLOYED LIVE SUCCESSFULLY! ---');
