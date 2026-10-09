#!/bin/bash
set -e
echo "[mysqld]" | sudo tee /etc/mysql/conf.d/timezone.cnf
echo "default-time-zone = '+05:30'" | sudo tee -a /etc/mysql/conf.d/timezone.cnf
sudo systemctl restart mysql
sudo mysql -e "SELECT @@global.time_zone, @@session.time_zone, NOW();"
