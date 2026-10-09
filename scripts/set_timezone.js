import { execSync } from 'child_process';
import path from 'path';

const pem = path.join(process.env.USERPROFILE, 'Downloads', 'ShuddamWater.pem');
const cmd = `ssh -i "${pem}" ubuntu@3.88.13.76 "sudo mysql -e \\"SET GLOBAL time_zone = '+05:30'; SELECT NOW();\\""`;
console.log('Running:', cmd);
const out = execSync(cmd).toString();
console.log('Result:\n', out);
