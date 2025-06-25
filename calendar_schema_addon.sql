-- Calendar Feature Addition for Production Database
-- Run this script on your production database to add calendar functionality

-- =============================================================================
-- 1. CREATE CALENDAR ENUMS
-- =============================================================================

-- Calendar event types enum
DO $$ BEGIN
    CREATE TYPE event_type AS ENUM ('meeting', 'reminder', 'deadline', 'appointment', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Calendar event status enum
DO $$ BEGIN
    CREATE TYPE event_status AS ENUM ('scheduled', 'cancelled', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 2. CREATE CALENDAR TABLES
-- =============================================================================

-- Calendar events table
CREATE TABLE IF NOT EXISTS calendar_events (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    all_day BOOLEAN DEFAULT false,
    location TEXT,
    event_type event_type DEFAULT 'other',
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

-- Event attendees table
CREATE TABLE IF NOT EXISTS event_attendees (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES calendar_events(id) ON DELETE CASCADE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'pending',
    invited_by INTEGER REFERENCES users(id) NOT NULL,
    invited_at TIMESTAMP DEFAULT NOW(),
    responded_at TIMESTAMP,
    UNIQUE(event_id, user_id)
);

-- Event reminders table
CREATE TABLE IF NOT EXISTS event_reminders (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES calendar_events(id) ON DELETE CASCADE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    reminder_time TIMESTAMP NOT NULL,
    minutes_before INTEGER NOT NULL,
    is_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_events_department ON calendar_events(department_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_category ON calendar_events(category_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id ON event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_event_reminders_event_id ON event_reminders(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reminders_user_id ON event_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_event_reminders_time ON event_reminders(reminder_time);

-- =============================================================================
-- 4. FIX MISSING COLUMNS FROM PREVIOUS DEPLOYMENT
-- =============================================================================

-- Fix direct_messages table to add missing recipient_id column if it doesn't exist
DO $$ BEGIN
    ALTER TABLE direct_messages ADD COLUMN recipient_id INTEGER REFERENCES users(id);
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Fix user_activities table to add missing created_at column if it doesn't exist
DO $$ BEGIN
    ALTER TABLE user_activities ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Create the missing indexes after fixing columns
CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_id ON direct_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at);

-- =============================================================================
-- 5. UPDATE SEQUENCES
-- =============================================================================

SELECT setval('calendar_events_id_seq', COALESCE((SELECT MAX(id) FROM calendar_events), 1));
SELECT setval('event_attendees_id_seq', COALESCE((SELECT MAX(id) FROM event_attendees), 1));
SELECT setval('event_reminders_id_seq', COALESCE((SELECT MAX(id) FROM event_reminders), 1));

-- Calendar feature deployment complete!
-- Your production database now supports:
-- ✓ Calendar events with attendees
-- ✓ Email notifications for invitations
-- ✓ Event reminders
-- ✓ Department and category integration