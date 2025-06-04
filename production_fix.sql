-- Production database fix for block/unblock functionality
-- This script safely adds the is_blocked column and fixes constraint issues

-- Step 1: Add is_blocked column if it doesn't exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'users') THEN
        -- Add is_blocked column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'users' AND column_name = 'is_blocked') THEN
            ALTER TABLE "users" ADD COLUMN "is_blocked" BOOLEAN DEFAULT false;
            RAISE NOTICE 'Added is_blocked column to users table';
        ELSE
            RAISE NOTICE 'is_blocked column already exists in users table';
        END IF;
        
        -- Add is_approved column if it doesn't exist (for Microsoft auth)
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'users' AND column_name = 'is_approved') THEN
            ALTER TABLE "users" ADD COLUMN "is_approved" BOOLEAN DEFAULT true;
            RAISE NOTICE 'Added is_approved column to users table';
        ELSE
            RAISE NOTICE 'is_approved column already exists in users table';
        END IF;
    ELSE
        RAISE NOTICE 'users table does not exist - skipping user columns addition';
    END IF;
END$$;

-- Step 2: Fix any orphaned task_updates records that might be causing constraint violations
DO $$
BEGIN
    -- Check if task_updates table exists
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'task_updates') THEN
        -- Delete orphaned task_updates that reference non-existent tasks
        DELETE FROM task_updates 
        WHERE task_id NOT IN (SELECT id FROM tasks WHERE id IS NOT NULL);
        
        -- Delete orphaned task_updates that reference non-existent users
        DELETE FROM task_updates 
        WHERE user_id NOT IN (SELECT id FROM users WHERE id IS NOT NULL);
        
        RAISE NOTICE 'Cleaned up orphaned task_updates records';
    END IF;
END$$;

-- Step 3: Add Microsoft approval requirement setting to app_settings table
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'app_settings') THEN
        -- Check if the setting already exists
        IF NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'microsoft_approval_required') THEN
            INSERT INTO app_settings (key, value, description) 
            VALUES ('microsoft_approval_required', 'false', 'Require admin approval for Microsoft authentication users');
            RAISE NOTICE 'Added microsoft_approval_required setting';
        ELSE
            RAISE NOTICE 'microsoft_approval_required setting already exists';
        END IF;
    END IF;
END$$;

-- Step 4: Create indexes for better performance on new columns
DO $$
BEGIN
    -- Index on is_blocked for faster user queries
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_is_blocked') THEN
        CREATE INDEX idx_users_is_blocked ON users(is_blocked) WHERE is_blocked = true;
        RAISE NOTICE 'Created index on is_blocked column';
    END IF;
    
    -- Index on is_approved for faster pending user queries
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_is_approved') THEN
        CREATE INDEX idx_users_is_approved ON users(is_approved) WHERE is_approved = false;
        RAISE NOTICE 'Created index on is_approved column';
    END IF;
END$$;

-- Step 5: Update any existing admin users to ensure they are not blocked
UPDATE users SET is_blocked = false WHERE is_admin = true;

DO $$
BEGIN
    RAISE NOTICE 'Production database update completed successfully';
END$$;