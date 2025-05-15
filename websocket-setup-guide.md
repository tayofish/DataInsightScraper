# WebSocket Setup Guide for Promellon

This guide will help you set up and configure your WebSocket implementation for the Promellon task management application when using Nginx and PM2.

## Step 1: Update Database Schema

Run the `update_schema.sql` file on your PostgreSQL database to ensure it has all the required tables and columns for WebSocket functionality:

```bash
# Connect to your PostgreSQL database
psql -U your_database_user -d your_database_name -f update_schema.sql
```

This script will:
- Add any missing message-related tables
- Add a `mentions` column to the `messages` and `direct_messages` tables if they don't already have one
- Create necessary indexes for improved performance
- Add foreign key constraints if they're missing

## Step 2: Configure Nginx for WebSocket Support

Copy the contents of `nginx-websocket-config.conf` to your Nginx server configuration:

1. Edit your existing site configuration:
   ```bash
   sudo nano /etc/nginx/sites-available/your-site-config
   ```

2. Add the WebSocket configuration from `nginx-websocket-config.conf` to your server block.

3. Test and reload Nginx:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

## Step 3: Update PM2 Configuration

Replace your existing PM2 configuration with the optimized `pm2-websocket-config.json`:

```bash
# Stop existing instance
pm2 stop promellon

# Start with new configuration
pm2 start pm2-websocket-config.json

# Save the new configuration
pm2 save
```

## Step 4: Testing WebSocket Functionality

After completing the setup, test the WebSocket functionality:

1. Open the application in your web browser
2. Log in with your credentials
3. Navigate to Direct Messages or Channels
4. Type @ to see if the mention dropdown appears
5. Try sending messages with mentions to verify they work

## Troubleshooting

If you encounter issues:

### WebSocket Connection Errors

1. Check your browser console for connection errors
2. Verify Nginx is properly configured for WebSocket proxying
3. Ensure the WebSocket server is running (check PM2 logs)

```bash
pm2 logs promellon
```

### JSON Parsing Errors

If you see "Unexpected end of JSON input" errors:

1. Check your server logs for detailed error messages
2. Verify that database tables have the correct structure
3. Ensure all WebSocket messages have proper JSON format

### Database Issues

If the mention system doesn't work after database updates:

1. Verify the database schema was updated correctly:
   ```bash
   psql -U your_database_user -d your_database_name -c "\d messages"
   psql -U your_database_user -d your_database_name -c "\d direct_messages"
   ```
2. Check if the `mentions` column exists in both tables

## Technical Details

### WebSocket Path

The WebSocket server runs on the path `/ws` to avoid conflicts with Vite's HMR WebSocket.

### Client Code

The client code establishes a WebSocket connection using:

```javascript
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${window.location.host}/ws`;
socket = new WebSocket(wsUrl);
```

### Server Code

The server-side WebSocket implementation is in `server/routes.ts` and handles:
- Authentication of WebSocket connections
- Broadcasting messages to relevant clients
- Processing mentions in messages
- Sending notifications for mentions

## Additional Notes

- The WebSocket server automatically reconnects if the connection is lost
- Error handling has been improved to prevent JSON parsing issues
- Messages with mentions are properly stored with metadata in the database