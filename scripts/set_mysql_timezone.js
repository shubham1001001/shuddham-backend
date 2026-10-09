import { execSync } from 'child_process';
import path from 'path';

const pem = path.join(process.env.USERPROFILE, 'Downloads', 'ShuddamWater.pem');
function run(remoteCmd) {
  console.log('>>>', remoteCmd);
  const out = execSync(`ssh -i "${pem}" ubuntu@3.88.13.76 '${remoteCmd}'`).toString();
  console.log(out);
  return out;
}

// 1. Add default-time-zone = '+05:30' to /etc/mysql/conf.d/timezone.cnf
run(`echo "[mysqld]" | sudo tee /etc/mysql/conf.d/timezone.cnf`);
run(`echo "default-time-zone = '+05:30'" | sudo tee -a /etc/mysql/conf.d/timezone.cnf`);
run(`sudo systemctl restart mysql`);

// 2. Verify NOW()
run(`sudo mysql -e "SELECT @@global.time_zone, NOW();"`);
