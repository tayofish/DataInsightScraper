# Production Deployment Guide

## Overview
This guide covers the deployment of the task management application to production, including database schema updates and environment configuration.

## Pre-Deployment Checklist

### 1. Database Schema Updates
Run the following SQL file on your production database:
```bash
psql -h your-db-host -U your-db-user -d your-db-name -f production_user_departments_schema.sql
```

### 2. Environment Variables
Ensure these environment variables are set in production:

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Strong random secret for session encryption
- `NODE_ENV=production`

**Email Configuration (Choose one):**
- Zeptomail: `ZEPTOMAIL_API_KEY`, `ZEPTOMAIL_DOMAIN`
- SendGrid: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

**Microsoft Authentication (Optional):**
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`

**Slack Integration (Optional):**
- `SLACK_BOT_TOKEN`
- `SLACK_CHANNEL_ID`

### 3. Build and Start Commands
```bash
# Install dependencies
npm install

# Build the application
npm run build

# Start production server
npm start
```

## Database Migration Steps

### Step 1: Backup Current Database
```bash
pg_dump -h your-db-host -U your-db-user your-db-name > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Apply Schema Updates
```bash
psql -h your-db-host -U your-db-user -d your-db-name -f production_user_departments_schema.sql
```

### Step 3: Verify Migration
The migration script includes comprehensive verification. Check the output of the final query to ensure:
- All users have proper onboarding status
- Department assignments are correct
- Email addresses are properly set
- Welcome notifications were created for completed users

The verification query in the migration script will show each user's onboarding status as:
- `Complete`: User has both unit and department assignments
- `Needs Onboarding`: User requires onboarding setup
- `Partial Setup`: User has incomplete assignments

## Production Configuration

### Security Considerations
1. **HTTPS**: Ensure SSL/TLS is enabled
2. **Session Security**: Use strong SESSION_SECRET
3. **Database**: Enable SSL for database connections
4. **File Uploads**: Configure proper file size limits and security headers

### Performance Optimizations
1. **Database Indexes**: All necessary indexes are included in the schema
2. **Connection Pooling**: PostgreSQL connection pooling is configured
3. **Static Assets**: Consider using a CDN for uploaded files
4. **Rate Limiting**: API rate limiting is implemented (2 requests per 2 seconds)

## Post-Deployment Verification

### 1. Health Check
Visit `/api/health` to verify the application is running and database is connected.

### 2. Authentication Test
- Test local authentication (if enabled)
- Test Microsoft authentication (if configured)

### 3. User Department Assignment
- Login as existing users
- Verify department information displays correctly in Settings page
- Test onboarding flow for new users

### 4. Core Functionality
- Create/edit tasks
- Send notifications
- File uploads
- Real-time WebSocket updates

## Rollback Plan

If issues occur during deployment:

1. **Database Rollback:**
   ```bash
   psql -h your-db-host -U your-db-user -d your-db-name < backup_YYYYMMDD_HHMMSS.sql
   ```

2. **Application Rollback:**
   - Deploy previous version
   - Restart application services

## Monitoring and Logs

### Application Logs
Monitor these log patterns:
- `Database connection restored/lost`
- `Authentication errors`
- `Email service status`
- `WebSocket connection issues`

### Database Monitoring
- Monitor connection pool usage
- Check for slow queries
- Verify user_departments table performance

## Support and Maintenance

### Regular Maintenance Tasks
1. **Database**: Regular VACUUM and ANALYZE operations
2. **File Cleanup**: Monitor uploaded file storage
3. **Session Cleanup**: Automatic session cleanup is configured
4. **Log Rotation**: Configure log rotation for application logs

### Emergency Contacts
- Database issues: Check connection strings and pool limits
- Authentication issues: Verify environment variables
- Email issues: Check email service configuration and API keys

## Version Information
- **Schema Version**: user_departments_v1 + email_notifications_v2
- **Deployment Date**: $(date)
- **Major Changes**: 
  - Added user_departments table with is_primary flag
  - Enhanced settings page with department display
  - Fixed department assignment logic
  - Improved API data structure for user departments
  - Implemented comprehensive end-of-day email notification system
  - Added built-in scheduler service with node-cron
  - Created admin dashboard with email notification controls
  - Enhanced email templates with proper user name display
  - Added configurable time and timezone settings
  - Implemented real-time scheduler status monitoring