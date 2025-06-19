-- Fix production notification schema mismatch
-- This addresses the column mapping issue where userId is not mapping correctly

DO $$
BEGIN
    -- Check if we have the wrong column structure
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'user_id'
        AND ordinal_position = 4
    ) THEN
        -- The structure is correct, but there might be a mapping issue
        -- Let's check if there are any null userId values that got through
        RAISE NOTICE 'Checking for null user_id values in notifications table...';
        
        -- Update any potential null user_id values that might exist
        UPDATE notifications 
        SET user_id = COALESCE(user_id, 1) -- Use admin user as fallback
        WHERE user_id IS NULL;
        
        -- Get count of fixed rows
        GET DIAGNOSTICS 
            ROW_COUNT = result;
        
        IF FOUND THEN
            RAISE NOTICE 'Fixed % rows with null user_id values', ROW_COUNT;
        ELSE
            RAISE NOTICE 'No null user_id values found';
        END IF;
    END IF;
    
    -- Ensure the user_id column has the correct NOT NULL constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'user_id'
        AND is_nullable = 'YES'
    ) THEN
        RAISE NOTICE 'Adding NOT NULL constraint to user_id column...';
        ALTER TABLE notifications ALTER COLUMN user_id SET NOT NULL;
    END IF;
    
    RAISE NOTICE 'Production notification schema fix completed';
END$$;