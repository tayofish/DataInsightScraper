-- Production Deployment Schema for Promellon Task Management System
-- This file contains all database migrations and updates for production deployment
-- Execute in order on production database

-- =============================================================================
-- 1. CREATE ENUMS (if they don't exist)
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE priority AS ENUM ('low', 'medium', 'high');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE status AS ENUM ('todo', 'in_progress', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE channel_type AS ENUM ('public', 'private', 'direct');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE message_type AS ENUM ('text', 'file', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 2. CREATE CORE TABLES
-- =============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    avatar TEXT,
    is_admin BOOLEAN DEFAULT false,
    is_approved BOOLEAN DEFAULT true,
    is_blocked BOOLEAN DEFAULT false,
    has_completed_onboarding BOOLEAN DEFAULT false,
    department_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Categories table (used as departments in UI)
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6b7280',
    department_id INTEGER,
    department_head_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Departments table (used as units in UI)
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    department_head_id INTEGER REFERENCES users(id),
    department_id INTEGER REFERENCES categories(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Units table (proper units structure)
CREATE TABLE IF NOT EXISTS units (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    unit_head_id INTEGER REFERENCES users(id),
    department_id INTEGER REFERENCES departments(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMP,
    due_date TIMESTAMP,
    priority priority DEFAULT 'medium',
    status status DEFAULT 'todo',
    project_id INTEGER REFERENCES projects(id),
    assignee_id INTEGER REFERENCES users(id),
    category_id INTEGER REFERENCES categories(id),
    department_id INTEGER REFERENCES departments(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Project assignments table
CREATE TABLE IF NOT EXISTS project_assignments (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) NOT NULL,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- User departments table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS user_departments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    department_id INTEGER REFERENCES departments(id) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    assigned_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Task updates table
CREATE TABLE IF NOT EXISTS task_updates (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) NOT NULL,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    update_type TEXT NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Task collaborators table
CREATE TABLE IF NOT EXISTS task_collaborators (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) NOT NULL,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    role TEXT DEFAULT 'viewer',
    invited_by INTEGER REFERENCES users(id) NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    parameters TEXT,
    created_by INTEGER REFERENCES users(id) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    last_run_at TIMESTAMP
);

-- SMTP configuration table
CREATE TABLE IF NOT EXISTS smtp_config (
    id SERIAL PRIMARY KEY,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    from_email TEXT NOT NULL,
    from_name TEXT NOT NULL,
    enable_tls BOOLEAN DEFAULT true NOT NULL,
    active BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    reference_id INTEGER,
    reference_type TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Application settings table
CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP
);

-- =============================================================================
-- 3. COLLABORATION FEATURES TABLES
-- =============================================================================

-- Channels table
CREATE TABLE IF NOT EXISTS channels (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    type channel_type DEFAULT 'public' NOT NULL,
    created_by INTEGER REFERENCES users(id) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Channel members table
CREATE TABLE IF NOT EXISTS channel_members (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    channel_id INTEGER REFERENCES channels(id) NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
    last_read TIMESTAMP DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER REFERENCES channels(id) NOT NULL,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    content TEXT NOT NULL,
    type message_type DEFAULT 'text' NOT NULL,
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    reply_to INTEGER REFERENCES messages(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Direct messages table
CREATE TABLE IF NOT EXISTS direct_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) NOT NULL,
    recipient_id INTEGER REFERENCES users(id) NOT NULL,
    content TEXT NOT NULL,
    type message_type DEFAULT 'text' NOT NULL,
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- User activities table
CREATE TABLE IF NOT EXISTS user_activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    reference_id INTEGER,
    reference_type TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- 4. ADD MISSING COLUMNS (for existing databases)
-- =============================================================================

-- Add columns that might be missing in existing installations
DO $$ BEGIN
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6b7280';
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS department_head_id INTEGER REFERENCES users(id);
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE departments ADD COLUMN IF NOT EXISTS department_head_id INTEGER REFERENCES users(id);
    ALTER TABLE departments ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES categories(id);
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- =============================================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Core indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users(is_blocked);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_department_id ON tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_task_updates_task_id ON task_updates(task_id);
CREATE INDEX IF NOT EXISTS idx_task_updates_user_id ON task_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_task_updates_created_at ON task_updates(created_at);

CREATE INDEX IF NOT EXISTS idx_project_assignments_project_id ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_user_id ON project_assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_user_departments_user_id ON user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_department_id ON user_departments(department_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_is_primary ON user_departments(is_primary);

-- Collaboration indexes
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_id ON direct_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_is_read ON direct_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON direct_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON channel_members(channel_id);

CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at);

-- App settings index
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- =============================================================================
-- 6. INSERT DEFAULT APPLICATION SETTINGS
-- =============================================================================

-- Insert default app settings if they don't exist
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

-- =============================================================================
-- 7. CREATE DEFAULT CHANNELS FOR COLLABORATION
-- =============================================================================

-- Create default channels if they don't exist
INSERT INTO channels (name, description, type, created_by) 
SELECT 'general', 'General discussion channel', 'public', 1
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE name = 'general')
AND EXISTS (SELECT 1 FROM users WHERE id = 1);

INSERT INTO channels (name, description, type, created_by) 
SELECT 'announcements', 'Company announcements and updates', 'public', 1
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE name = 'announcements')
AND EXISTS (SELECT 1 FROM users WHERE id = 1);

-- =============================================================================
-- 8. DATA MIGRATION AND CLEANUP
-- =============================================================================

-- Update existing users to have default values for new columns
UPDATE users SET 
    is_approved = COALESCE(is_approved, true),
    is_blocked = COALESCE(is_blocked, false),
    has_completed_onboarding = COALESCE(has_completed_onboarding, false)
WHERE is_approved IS NULL OR is_blocked IS NULL OR has_completed_onboarding IS NULL;

-- Ensure all categories have a color
UPDATE categories SET color = '#6b7280' WHERE color IS NULL OR color = '';

-- =============================================================================
-- 9. FOREIGN KEY CONSTRAINTS (if not already exist)
-- =============================================================================

-- Add foreign key constraints that might be missing
DO $$ BEGIN
    ALTER TABLE departments ADD CONSTRAINT fk_departments_department_head 
        FOREIGN KEY (department_head_id) REFERENCES users(id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE departments ADD CONSTRAINT fk_departments_category 
        FOREIGN KEY (department_id) REFERENCES categories(id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE categories ADD CONSTRAINT fk_categories_department_head 
        FOREIGN KEY (department_head_id) REFERENCES users(id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT fk_users_department 
        FOREIGN KEY (department_id) REFERENCES departments(id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 10. FINAL VERIFICATION QUERIES
-- =============================================================================

-- These queries can be run to verify the database setup
-- (Comment these out for actual deployment, they're for verification only)

/*
-- Verify table creation
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verify enum types
SELECT enumname, enumlabel 
FROM pg_enum e 
JOIN pg_type t ON e.enumtypid = t.oid 
ORDER BY enumname, enumlabel;

-- Verify indexes
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- Verify app settings
SELECT key, value, description 
FROM app_settings 
ORDER BY key;

-- Verify foreign key constraints
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
*/

-- =============================================================================
-- DEPLOYMENT COMPLETE
-- =============================================================================

-- The database schema is now ready for production deployment
-- Make sure to configure SMTP settings and create admin user after deployment