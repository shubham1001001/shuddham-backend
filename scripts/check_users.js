import { execSync } from 'child_process';
import path from 'path';

const pem = path.join(process.env.USERPROFILE, 'Downloads', 'ShuddamWater.pem');

function runSql(sql) {
  const b64 = Buffer.from(sql).toString('base64');
  const cmd = `ssh -i "${pem}" ubuntu@3.88.13.76 "echo ${b64} | base64 -d | sudo mysql"`;
  return execSync(cmd).toString();
}

console.log(runSql("USE shuddham_db; SELECT id, full_name, phone, email, role FROM users LIMIT 10;"));
