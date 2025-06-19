-- Fix duplicate columns in production notifications table
-- Remove the duplicate camelCase columns that are causing mapping issues

DO $$
DECLARE
    result INTEGER;
BEGIN
    RAISE NOTICE 'Starting duplicate columns cleanup for notifications table...';
    
    -- Check if duplicate columns exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'userId'
    ) THEN
        RAISE NOTICE 'Found duplicate userId column, removing it...';
        
        -- Copy any data from the duplicate column to the correct one
        UPDATE notifications 
        SET user_id = COALESCE(user_id, "userId") 
        WHERE user_id IS NULL AND "userId" IS NOT NULL;
        
        -- Drop the duplicate column
        ALTER TABLE notifications DROP COLUMN IF EXISTS "userId";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'isRead'
    ) THEN
        RAISE NOTICE 'Found duplicate isRead column, removing it...';
        
        -- Copy any data from the duplicate column to the correct one
        UPDATE notifications 
        SET is_read = COALESCE(is_read, "isRead") 
        WHERE is_read IS NULL AND "isRead" IS NOT NULL;
        
        -- Drop the duplicate column
        ALTER TABLE notifications DROP COLUMN IF EXISTS "isRead";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'referenceId'
    ) THEN
        RAISE NOTICE 'Found duplicate referenceId column, removing it...';
        
        -- Copy any data from the duplicate column to the correct one
        UPDATE notifications 
        SET reference_id = COALESCE(reference_id, "referenceId") 
        WHERE reference_id IS NULL AND "referenceId" IS NOT NULL;
        
        -- Drop the duplicate column
        ALTER TABLE notifications DROP COLUMN IF EXISTS "referenceId";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'referenceType'
    ) THEN
        RAISE NOTICE 'Found duplicate referenceType column, removing it...';
        
        -- Copy any data from the duplicate column to the correct one
        UPDATE notifications 
        SET reference_type = COALESCE(reference_type, "referenceType") 
        WHERE reference_type IS NULL AND "referenceType" IS NOT NULL;
        
        -- Drop the duplicate column
        ALTER TABLE notifications DROP COLUMN IF EXISTS "referenceType";
    END IF;
    
    -- Ensure all required columns have NOT NULL constraint where needed
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
    
    RAISE NOTICE 'Duplicate columns cleanup completed successfully';
END$$;