-- Fix Calendar Schema for Production Database
-- This script adds missing columns and fixes schema mismatches

-- =============================================================================
-- 1. ADD MISSING REMINDER TYPE ENUM
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE reminder_type AS ENUM ('email', 'notification', 'both');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 2. FIX EVENT_REMINDERS TABLE SCHEMA
-- =============================================================================

-- Add missing columns to event_reminders table
ALTER TABLE event_reminders 
ADD COLUMN IF NOT EXISTS reminder_type reminder_type DEFAULT 'both',
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;

-- Drop the reminder_time column if it exists (not used in our schema)
ALTER TABLE event_reminders DROP COLUMN IF EXISTS reminder_time;

-- =============================================================================
-- 3. FIX EVENT TYPE ENUMS
-- =============================================================================

-- Update event_type enum to match development schema
DROP TYPE IF EXISTS event_type CASCADE;
CREATE TYPE event_type AS ENUM ('meeting', 'deadline', 'reminder', 'task', 'personal', 'holiday');

-- Update event_status enum to match development schema  
DROP TYPE IF EXISTS event_status CASCADE;
CREATE TYPE event_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

-- Recreate calendar_events table with correct enum types
-- First backup any existing data
CREATE TABLE IF NOT EXISTS calendar_events_backup AS SELECT * FROM calendar_events;

-- Drop and recreate the table with correct enums
DROP TABLE IF EXISTS calendar_events CASCADE;

CREATE TABLE calendar_events (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    all_day BOOLEAN DEFAULT false,
    location TEXT,
    event_type event_type DEFAULT 'meeting',
    status event_status DEFAULT 'scheduled',
    color TEXT DEFAULT '#3b82f6',
    created_by INTEGER REFERENCES users(id) NOT NULL,
    department_id INTEGER REFERENCES departments(id),
    category_id INTEGER REFERENCES categories(id),
    task_id INTEGER REFERENCES tasks(id),
    project_id INTEGER REFERENCES projects(id),
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Restore any backed up data
INSERT INTO calendar_events SELECT * FROM calendar_events_backup WHERE EXISTS (SELECT 1 FROM calendar_events_backup);

-- Drop backup table
DROP TABLE IF EXISTS calendar_events_backup;

-- =============================================================================
-- 3. UPDATE CALENDAR EVENTS TABLE
-- =============================================================================

-- Ensure all calendar events columns are properly set
-- (These should already exist from the previous deployment)

-- =============================================================================
-- 4. UPDATE INDEXES
-- =============================================================================

-- Drop the old reminder_time index if it exists
DROP INDEX IF EXISTS idx_event_reminders_time;

-- Create new indexes for the updated schema
CREATE INDEX IF NOT EXISTS idx_event_reminders_reminder_type ON event_reminders(reminder_type);
CREATE INDEX IF NOT EXISTS idx_event_reminders_is_sent ON event_reminders(is_sent);

-- =============================================================================
-- SCHEMA FIX COMPLETE
-- =============================================================================

-- The event_reminders table now matches the development schema:
-- - reminder_type enum column
-- - sent_at timestamp column  
-- - removed reminder_time column
-- - proper indexes for performance