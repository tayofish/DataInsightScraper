-- Complete production notification fix
-- Addresses schema mismatch and ensures robust notification creation

DO $$
DECLARE
    result INTEGER;
BEGIN
    RAISE NOTICE 'Starting comprehensive notification table fix...';
    
    -- First, check current table structure
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'notifications'
    ) THEN
        RAISE NOTICE 'Notifications table exists, checking structure...';
        
        -- Ensure all required columns exist with correct data types
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'notifications' AND column_name = 'user_id'
        ) THEN
            RAISE NOTICE 'Adding missing user_id column...';
            ALTER TABLE notifications ADD COLUMN user_id INTEGER NOT NULL REFERENCES users(id);
        END IF;
        
        -- Ensure user_id column is NOT NULL
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'notifications' 
            AND column_name = 'user_id' 
            AND is_nullable = 'YES'
        ) THEN
            RAISE NOTICE 'Setting user_id column to NOT NULL...';
            -- Update any NULL values first
            UPDATE notifications SET user_id = 1 WHERE user_id IS NULL;
            -- Then add NOT NULL constraint
            ALTER TABLE notifications ALTER COLUMN user_id SET NOT NULL;
        END IF;
        
        -- Clean up any orphaned notifications without valid user references
        DELETE FROM notifications 
        WHERE user_id NOT IN (SELECT id FROM users);
        
        GET DIAGNOSTICS result = ROW_COUNT;
        IF result > 0 THEN
            RAISE NOTICE 'Cleaned up % orphaned notification records', result;
        END IF;
        
        -- Verify foreign key constraint exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'notifications' 
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'user_id'
        ) THEN
            RAISE NOTICE 'Adding foreign key constraint for user_id...';
            ALTER TABLE notifications 
            ADD CONSTRAINT notifications_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
        
        RAISE NOTICE 'Notification table structure verified and fixed';
    ELSE
        RAISE NOTICE 'Notifications table does not exist, creating it...';
        CREATE TABLE notifications (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type TEXT NOT NULL DEFAULT 'info',
            is_read BOOLEAN DEFAULT FALSE,
            reference_id INTEGER,
            reference_type TEXT,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
        RAISE NOTICE 'Notifications table created successfully';
    END IF;
    
    RAISE NOTICE 'Production notification fix completed successfully';
END$$;