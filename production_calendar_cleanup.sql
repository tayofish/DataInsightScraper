-- Clean up orphaned calendar data and fix foreign key constraints

-- =============================================================================
-- 1. CLEAN UP ORPHANED RECORDS
-- =============================================================================

-- Remove orphaned event_attendees records
DELETE FROM event_attendees 
WHERE event_id NOT IN (SELECT id FROM calendar_events);

-- Remove orphaned event_reminders records  
DELETE FROM event_reminders
WHERE event_id NOT IN (SELECT id FROM calendar_events);

-- =============================================================================
-- 2. ADD FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- Add foreign key constraint for event_attendees
ALTER TABLE event_attendees 
DROP CONSTRAINT IF EXISTS event_attendees_event_id_fkey,
ADD CONSTRAINT event_attendees_event_id_fkey 
FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE;

-- Add foreign key constraint for event_reminders
ALTER TABLE event_reminders
DROP CONSTRAINT IF EXISTS event_reminders_event_id_fkey,
ADD CONSTRAINT event_reminders_event_id_fkey
FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE;

-- =============================================================================
-- CLEANUP COMPLETE
-- =============================================================================

-- All orphaned records removed and foreign key constraints restored
-- Calendar feature is now ready for production use