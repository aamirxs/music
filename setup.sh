#!/bin/bash

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Error handling
set -e
trap 'echo -e "${RED}Error: Command failed at line $LINENO${NC}"; exit 1' ERR

# Logger function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}"
   exit 1
fi

# Configuration
APP_NAME="music-player"
APP_DIR="/opt/$APP_NAME"
BACKUP_DIR="/var/backups/$APP_NAME"
LOG_DIR="/var/log/$APP_NAME"
NODE_VERSION="20.x"
MONGODB_VERSION="7.0"

# Create necessary directories
log "Creating application directories..."
mkdir -p $APP_DIR $BACKUP_DIR $LOG_DIR
chown -R $SUDO_USER:$SUDO_USER $APP_DIR $BACKUP_DIR $LOG_DIR

# System updates and essential packages
log "Updating system packages..."
apt update && apt upgrade -y
apt install -y curl git build-essential nginx certbot python3-certbot-nginx ufw fail2ban

# Install Node.js
log "Installing Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION} | bash -
apt install -y nodejs
npm install -g npm@latest

# Install MongoDB
log "Installing MongoDB $MONGODB_VERSION..."
curl -fsSL https://pgp.mongodb.com/server-${MONGODB_VERSION}.asc | gpg -o /usr/share/keyrings/mongodb-server-${MONGODB_VERSION}.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-${MONGODB_VERSION}.gpg ] http://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/${MONGODB_VERSION} multiverse" | tee /etc/apt/sources.list.d/mongodb-org-${MONGODB_VERSION}.list
apt update
apt install -y mongodb-org

# Configure MongoDB
log "Configuring MongoDB..."
systemctl start mongod
systemctl enable mongod

# Create MongoDB backup script
cat > /usr/local/bin/backup-mongodb.sh << 'EOL'
#!/bin/bash
BACKUP_DIR="/var/backups/music-player/mongodb"
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --out "$BACKUP_DIR/backup_$DATE"
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} +
EOL
chmod +x /usr/local/bin/backup-mongodb.sh

# Setup daily MongoDB backups
echo "0 0 * * * root /usr/local/bin/backup-mongodb.sh" > /etc/cron.d/mongodb-backup

# Install PM2 and other global packages
log "Installing global npm packages..."
npm install -g pm2 npm-check-updates

# Configure firewall
log "Configuring firewall..."
ufw allow ssh
ufw allow http
ufw allow https
ufw allow 3000
ufw --force enable

# Configure fail2ban
log "Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << EOL
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
EOL
systemctl restart fail2ban

# Setup application
log "Setting up application..."
cd $APP_DIR
cp -r /home/$SUDO_USER/music/* .
chown -R $SUDO_USER:$SUDO_USER .

# Install dependencies
log "Installing application dependencies..."
su - $SUDO_USER -c "cd $APP_DIR && npm install"

# Setup environment variables
log "Configuring environment variables..."
cat > $APP_DIR/.env << EOL
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://localhost:27017/$APP_NAME
JWT_SECRET=$(openssl rand -base64 64)
BACKUP_DIR=$BACKUP_DIR
LOG_DIR=$LOG_DIR
EOL

# Configure Nginx as reverse proxy
log "Configuring Nginx..."
cat > /etc/nginx/sites-available/$APP_NAME << EOL
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOL
ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Setup PM2 with app ecosystem
log "Configuring PM2..."
cat > $APP_DIR/ecosystem.config.js << EOL
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '$LOG_DIR/err.log',
    out_file: '$LOG_DIR/out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
EOL

# Start application
log "Starting application..."
su - $SUDO_USER -c "cd $APP_DIR && pm2 start ecosystem.config.js"
su - $SUDO_USER -c "pm2 save"
pm2 startup ubuntu -u $SUDO_USER --hp /home/$SUDO_USER
systemctl enable pm2-$SUDO_USER

# Setup log rotation
cat > /etc/logrotate.d/$APP_NAME << EOL
$LOG_DIR/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    missingok
    create 0640 $SUDO_USER $SUDO_USER
}
EOL

# Create monitoring script
cat > /usr/local/bin/monitor-app.sh << 'EOL'
#!/bin/bash
CHECK_URL="http://localhost:3000"
if ! curl -s --head $CHECK_URL | grep "200 OK" > /dev/null; then
    pm2 restart music-player
    echo "Application restarted due to health check failure at $(date)" >> /var/log/music-player/monitoring.log
fi
EOL
chmod +x /usr/local/bin/monitor-app.sh

# Add monitoring cron job
echo "*/5 * * * * root /usr/local/bin/monitor-app.sh" > /etc/cron.d/app-monitor

log "Setup complete! Your application is running at http://YOUR_SERVER_IP"
log "Monitor logs using: pm2 logs"
log "Monitor application using: pm2 monit"