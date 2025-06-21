# Promellon Production Deployment Guide

This guide provides step-by-step instructions for deploying Promellon Task Management System to a production server.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+ database server
- SSL certificate for HTTPS (recommended)
- SMTP server access for email notifications
- Domain name pointing to your server

## Deployment Steps

### 1. Server Setup

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install PM2 for process management
sudo npm install -g pm2

# Install nginx for reverse proxy
sudo apt install nginx -y
```

### 2. Database Setup

```bash
# Switch to postgres user
sudo su - postgres

# Create database and user
psql -c "CREATE DATABASE promellon_prod;"
psql -c "CREATE USER promellon_user WITH PASSWORD 'your_secure_password';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE promellon_prod TO promellon_user;"
psql -c "ALTER USER promellon_user CREATEDB;"

# Exit postgres user
exit
```

### 3. Application Deployment

```bash
# Create application directory
sudo mkdir -p /var/www/promellon
sudo chown $USER:$USER /var/www/promellon

# Clone or upload your application files to /var/www/promellon
cd /var/www/promellon

# Install dependencies
npm install --production

# Build the application
npm run build
```

### 4. Database Migration

```bash
# Navigate to application directory
cd /var/www/promellon

# Run the production schema migration
psql -h localhost -U promellon_user -d promellon_prod -f production_deployment_schema.sql
```

### 5. Environment Configuration

Create `/var/www/promellon/.env.production`:

```env
# Database Configuration
DATABASE_URL=postgresql://promellon_user:your_secure_password@localhost:5432/promellon_prod

# Application Settings
NODE_ENV=production
PORT=3000
SESSION_SECRET=your_very_long_random_session_secret_here

# Authentication (configure as needed)
AZURE_CLIENT_ID=your_azure_client_id
AZURE_CLIENT_SECRET=your_azure_client_secret
AZURE_TENANT_ID=your_azure_tenant_id

# Email Configuration (will be set via admin interface)
# SMTP_HOST=your.smtp.server.com
# SMTP_PORT=587
# SMTP_USER=your_smtp_username
# SMTP_PASS=your_smtp_password
# SMTP_FROM_EMAIL=noreply@yourdomain.com
# SMTP_FROM_NAME=Promellon Notifications

# Domain Configuration
DOMAIN=yourdomain.com
PROTOCOL=https
```

### 6. PM2 Process Configuration

Create `/var/www/promellon/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'promellon',
    script: 'server/production.js',
    cwd: '/var/www/promellon',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 'max',
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '1G',
    error_file: '/var/log/promellon/error.log',
    out_file: '/var/log/promellon/access.log',
    log_file: '/var/log/promellon/combined.log',
    time: true
  }]
};
```

### 7. Nginx Configuration

Create `/etc/nginx/sites-available/promellon`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /path/to/your/ssl/certificate.crt;
    ssl_certificate_key /path/to/your/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # File Upload Size
    client_max_body_size 100M;

    # WebSocket Support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Main Application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static file caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 8. Start Services

```bash
# Create log directory
sudo mkdir -p /var/log/promellon
sudo chown $USER:$USER /var/log/promellon

# Enable nginx site
sudo ln -s /etc/nginx/sites-available/promellon /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Start application with PM2
cd /var/www/promellon
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Follow the instructions from pm2 startup command
```

### 9. Create Admin User

```bash
# Navigate to application directory
cd /var/www/promellon

# Run the admin creation script
npm run create-admin
```

### 10. Configure Application Settings

After deployment, log in as admin and configure:

1. **SMTP Settings**: Go to Settings → Email Configuration
2. **Application Settings**: Configure app name, logo, favicon
3. **Authentication**: Enable/disable Microsoft Azure AD if needed
4. **Email Notifications**: Configure end-of-day notification settings
5. **Departments and Units**: Set up organizational structure
6. **User Management**: Create users and assign to departments

## Post-Deployment Configuration

### SSL Certificate Setup (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Backup Setup

Create `/etc/cron.daily/promellon-backup`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/promellon"
DATE=$(date +"%Y%m%d_%H%M%S")

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
pg_dump -h localhost -U promellon_user promellon_prod > $BACKUP_DIR/database_$DATE.sql

# Application files backup
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C /var/www/promellon uploads/

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

```bash
sudo chmod +x /etc/cron.daily/promellon-backup
```

### Monitoring Setup

```bash
# Install monitoring tools
sudo apt install htop iotop -y

# Check application status
pm2 status
pm2 logs promellon

# Check system resources
htop
df -h
```

## Security Considerations

1. **Database Security**:
   - Use strong passwords for database users
   - Restrict database access to localhost only
   - Regular security updates

2. **Application Security**:
   - Keep Node.js and dependencies updated
   - Use strong session secrets
   - Enable HTTPS only
   - Configure proper CORS settings

3. **Server Security**:
   - Configure firewall properly
   - Disable root login
   - Use SSH keys instead of passwords
   - Regular security updates

4. **File Permissions**:
   ```bash
   # Set proper file permissions
   sudo chown -R $USER:$USER /var/www/promellon
   sudo chmod -R 755 /var/www/promellon
   sudo chmod -R 777 /var/www/promellon/uploads
   ```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**:
   - Check DATABASE_URL in environment
   - Verify PostgreSQL is running: `sudo systemctl status postgresql`
   - Check database user permissions

2. **Email Not Working**:
   - Verify SMTP configuration in admin panel
   - Check server firewall allows SMTP ports
   - Test SMTP credentials

3. **File Upload Issues**:
   - Check nginx client_max_body_size
   - Verify uploads directory permissions
   - Check disk space: `df -h`

4. **WebSocket Issues**:
   - Verify nginx WebSocket configuration
   - Check firewall allows WebSocket connections
   - Test WebSocket endpoint directly

### Logs Location

- Application logs: `/var/log/promellon/`
- Nginx logs: `/var/log/nginx/`
- PostgreSQL logs: `/var/log/postgresql/`
- PM2 logs: `pm2 logs`

### Performance Optimization

1. **Database Optimization**:
   - Regular VACUUM and ANALYZE
   - Monitor slow queries
   - Add indexes for frequently queried columns

2. **Application Optimization**:
   - Enable Node.js clustering (already configured in PM2)
   - Configure proper caching headers
   - Monitor memory usage

3. **Nginx Optimization**:
   - Enable gzip compression
   - Configure proper caching
   - Optimize worker processes

## Maintenance

### Regular Tasks

1. **Weekly**:
   - Check application logs for errors
   - Monitor disk space
   - Review backup files

2. **Monthly**:
   - Update Node.js dependencies
   - Review database performance
   - Check SSL certificate expiry

3. **Quarterly**:
   - Full system security update
   - Database maintenance (VACUUM FULL)
   - Review and update backup strategy

### Updates

```bash
# Update application
cd /var/www/promellon
git pull origin main  # or upload new files
npm install --production
npm run build
pm2 restart promellon

# Update system
sudo apt update && sudo apt upgrade -y
```

## Support

For issues and support:
- Check application logs first
- Review this deployment guide
- Consult the application documentation
- Contact system administrator

---

**Important**: Always test deployments in a staging environment before applying to production.