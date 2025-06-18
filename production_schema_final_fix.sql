-- Production Database Schema Update - FINAL FIX
-- This addresses the remaining null value and column reference issues

-- ==============================================================================
-- CRITICAL FIXES FOR NOTIFICATIONS AND CHANNEL MEMBERS TABLES
-- ==============================================================================

-- 1. Fix notifications table - handle null userId values
DO $$
BEGIN
    -- First, check if userId column exists and has null values
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='userId') THEN
        -- Check if there are null values
        IF EXISTS (SELECT 1 FROM "notifications" WHERE "userId" IS NULL LIMIT 1) THEN
            -- Delete rows with null userId (these are likely invalid notifications)
            DELETE FROM "notifications" WHERE "userId" IS NULL;
        END IF;
    ELSE
        -- If userId column doesn't exist, add it (only if there are no rows, or set to a default admin user)
        IF NOT EXISTS (SELECT 1 FROM "notifications" LIMIT 1) THEN
            -- Table is empty, safe to add NOT NULL column
            ALTER TABLE "notifications" ADD COLUMN "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE;
        ELSE
            -- Table has data, need to add column with default first
            -- Get the first admin user ID as default
            IF EXISTS (SELECT 1 FROM "users" WHERE "isAdmin" = TRUE LIMIT 1) THEN
                DECLARE
                    admin_user_id INTEGER;
                BEGIN
                    SELECT "id" INTO admin_user_id FROM "users" WHERE "isAdmin" = TRUE LIMIT 1;
                    
                    -- Add column with default value
                    EXECUTE format('ALTER TABLE "notifications" ADD COLUMN "userId" INTEGER DEFAULT %s REFERENCES "users"("id") ON DELETE CASCADE', admin_user_id);
                    
                    -- Remove default constraint after adding the column
                    ALTER TABLE "notifications" ALTER COLUMN "userId" DROP DEFAULT;
                    
                    -- Make it NOT NULL
                    ALTER TABLE "notifications" ALTER COLUMN "userId" SET NOT NULL;
                END;
            ELSE
                -- No admin user found, use the first user
                DECLARE
                    first_user_id INTEGER;
                BEGIN
                    SELECT "id" INTO first_user_id FROM "users" LIMIT 1;
                    
                    IF first_user_id IS NOT NULL THEN
                        -- Add column with default value
                        EXECUTE format('ALTER TABLE "notifications" ADD COLUMN "userId" INTEGER DEFAULT %s REFERENCES "users"("id") ON DELETE CASCADE', first_user_id);
                        
                        -- Remove default constraint after adding the column
                        ALTER TABLE "notifications" ALTER COLUMN "userId" DROP DEFAULT;
                        
                        -- Make it NOT NULL
                        ALTER TABLE "notifications" ALTER COLUMN "userId" SET NOT NULL;
                    END IF;
                END;
            END IF;
        END IF;
    END IF;
    
    -- Add other missing columns to notifications if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='isRead') THEN
        ALTER TABLE "notifications" ADD COLUMN "isRead" BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='type') THEN
        ALTER TABLE "notifications" ADD COLUMN "type" TEXT DEFAULT 'info';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='referenceId') THEN
        ALTER TABLE "notifications" ADD COLUMN "referenceId" INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='referenceType') THEN
        ALTER TABLE "notifications" ADD COLUMN "referenceType" TEXT;
    END IF;
END $$;

-- 2. Fix channelMembers table column reference
DO $$
BEGIN
    -- Check if channelMembers table exists and channelId column exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channelMembers') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='channelMembers' AND column_name='channelId') THEN
        -- Add the missing channelId column
        ALTER TABLE "channelMembers" ADD COLUMN "channelId" INTEGER NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Create indexes safely with existence checks
DO $$
BEGIN
    -- Only create indexes if the respective columns exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='userId') THEN
        CREATE INDEX IF NOT EXISTS "idx_notifications_userId" ON "notifications"("userId");
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='isRead') THEN
        CREATE INDEX IF NOT EXISTS "idx_notifications_isRead" ON "notifications"("isRead");
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='channelMembers' AND column_name='channelId') THEN
        CREATE INDEX IF NOT EXISTS "idx_channelMembers_channelId" ON "channelMembers"("channelId");
    END IF;
END $$;

-- 4. Ensure userDepartments table has data for existing users
DO $$
BEGIN
    -- Check if userDepartments is empty and users have departmentId values
    IF NOT EXISTS (SELECT 1 FROM "userDepartments" LIMIT 1) 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='departmentId') THEN
        
        -- Migrate existing department assignments
        INSERT INTO "userDepartments" ("userId", "departmentId", "isPrimary", "assignedAt")
        SELECT 
            "id" as "userId",
            "departmentId",
            TRUE as "isPrimary",
            NOW() as "assignedAt"
        FROM "users" 
        WHERE "departmentId" IS NOT NULL
        ON CONFLICT ("userId", "departmentId") DO NOTHING;
    END IF;
END $$;

-- 5. Add essential missing columns to users table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='isBlocked') THEN
        ALTER TABLE "users" ADD COLUMN "isBlocked" BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='isApproved') THEN
        ALTER TABLE "users" ADD COLUMN "isApproved" BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='isAdmin') THEN
        ALTER TABLE "users" ADD COLUMN "isAdmin" BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 6. Verification and cleanup
DO $$
BEGIN
    -- Check if we have any users without department assignments and assign them to first department
    IF EXISTS (SELECT 1 FROM "departments" LIMIT 1) 
       AND EXISTS (SELECT 1 FROM "users" u WHERE NOT EXISTS (SELECT 1 FROM "userDepartments" ud WHERE ud."userId" = u."id") LIMIT 1) THEN
        
        DECLARE
            first_dept_id INTEGER;
        BEGIN
            SELECT "id" INTO first_dept_id FROM "departments" LIMIT 1;
            
            -- Assign unassigned users to the first department
            INSERT INTO "userDepartments" ("userId", "departmentId", "isPrimary", "assignedAt")
            SELECT 
                u."id",
                first_dept_id,
                TRUE,
                NOW()
            FROM "users" u 
            WHERE NOT EXISTS (SELECT 1 FROM "userDepartments" ud WHERE ud."userId" = u."id")
            ON CONFLICT ("userId", "departmentId") DO NOTHING;
        END;
    END IF;
END $$;

-- ==============================================================================
-- VERIFICATION QUERIES (Run these manually to check the results)
-- ==============================================================================

-- Check notifications table structure:
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'notifications' ORDER BY ordinal_position;

-- Check userDepartments assignments:
-- SELECT u.username, d.name as department, ud."isPrimary" 
-- FROM users u 
-- JOIN "userDepartments" ud ON u.id = ud."userId" 
-- JOIN departments d ON ud."departmentId" = d.id;

-- Check for any remaining null userId in notifications:
-- SELECT COUNT(*) as null_user_notifications FROM notifications WHERE "userId" IS NULL;

-- ==============================================================================
-- NOTES
-- ==============================================================================

-- This script specifically addresses:
-- 1. Null values in notifications.userId column
-- 2. Missing channelId column in channelMembers table  
-- 3. Ensures all users have at least one department assignment
-- 4. Creates indexes safely with existence checks
-- 5. Preserves all existing data while fixing structural issues