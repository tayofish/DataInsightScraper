-- Production Database Fixes
-- Run this after the main production_deployment_schema.sql to fix column name differences

-- Fix direct messages indexes (production uses receiver_id instead of recipient_id)
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_id ON direct_messages(receiver_id);

-- Fix user activities indexes (production already has created_at column)
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at);

-- Verify all critical tables exist and have proper structure
DO $$ 
BEGIN
    -- Check if all critical tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE EXCEPTION 'Critical table users is missing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
        RAISE EXCEPTION 'Critical table tasks is missing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments') THEN
        RAISE EXCEPTION 'Critical table departments is missing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
        RAISE EXCEPTION 'Critical table categories is missing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        RAISE EXCEPTION 'Critical table notifications is missing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'smtp_config') THEN
        RAISE EXCEPTION 'Critical table smtp_config is missing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_settings') THEN
        RAISE EXCEPTION 'Critical table app_settings is missing';
    END IF;
    
    RAISE NOTICE 'All critical tables verified successfully';
END $$;

-- Ensure all required app settings exist for production
INSERT INTO app_settings (key, value, description) VALUES 
    ('app_name', 'Promellon', 'Application name displayed in the interface')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description) VALUES 
    ('end_of_day_user_notifications', 'true', 'Enable end-of-day email notifications for users')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description) VALUES 
    ('end_of_day_admin_notifications', 'true', 'Enable end-of-day email notifications for administrators')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description) VALUES 
    ('end_of_day_unit_head_notifications', 'true', 'Enable end-of-day email notifications for unit heads')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description) VALUES 
    ('end_of_day_department_head_notifications', 'true', 'Enable end-of-day email notifications for department heads')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description) VALUES 
    ('scheduler_enabled', 'true', 'Enable automatic end-of-day email scheduler')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description) VALUES 
    ('scheduler_time', '18:00', 'Time for automatic end-of-day notifications (24-hour format)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description) VALUES 
    ('scheduler_timezone', 'Europe/Paris', 'Timezone for automatic end-of-day notifications')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description) VALUES 
    ('local_auth', 'true', 'Enable local username/password authentication')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description) VALUES 
    ('microsoft_auth', 'false', 'Enable Microsoft Azure AD authentication')
ON CONFLICT (key) DO NOTHING;

-- Create a summary view of the database deployment status
SELECT 
    'Database deployment completed successfully' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as total_tables,
    (SELECT COUNT(*) FROM app_settings) as app_settings_count,
    (SELECT COUNT(*) FROM users WHERE is_admin = true) as admin_users,
    (SELECT COUNT(*) FROM smtp_config WHERE active = true) as active_smtp_configs;