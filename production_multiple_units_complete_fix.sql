-- Complete Production Fix for Multiple Unit Assignments
-- This script addresses all the issues preventing secondary unit assignments from persisting

-- 1. Ensure the user_departments table has the correct structure
DO $$
BEGIN
    -- Add is_primary column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='user_departments' AND column_name='is_primary') THEN
        ALTER TABLE "user_departments" ADD COLUMN "is_primary" BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add assigned_at column if it doesn't exist (rename from created_at if needed)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='user_departments' AND column_name='assigned_at') THEN
        -- Check if created_at exists, if so rename it
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='user_departments' AND column_name='created_at') THEN
            ALTER TABLE "user_departments" RENAME COLUMN "created_at" TO "assigned_at";
        ELSE
            -- Otherwise create the column
            ALTER TABLE "user_departments" ADD COLUMN "assigned_at" TIMESTAMP DEFAULT NOW() NOT NULL;
        END IF;
    END IF;
    
    -- Ensure we have a unique constraint on user_id, department_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name='user_departments' AND constraint_type='UNIQUE') THEN
        ALTER TABLE "user_departments" ADD CONSTRAINT "user_departments_user_id_department_id_unique" 
        UNIQUE ("user_id", "department_id");
    END IF;
END $$;

-- 2. Migrate existing user department assignments from users table if needed
DO $$
BEGIN
    -- Only migrate if user_departments is empty and users table has department_id column
    IF NOT EXISTS (SELECT 1 FROM "user_departments" LIMIT 1) 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='department_id') THEN
        
        INSERT INTO "user_departments" ("user_id", "department_id", "is_primary", "assigned_at")
        SELECT 
            "id" as "user_id",
            "department_id",
            TRUE as "is_primary",
            NOW() as "assigned_at"
        FROM "users" 
        WHERE "department_id" IS NOT NULL
        ON CONFLICT ("user_id", "department_id") DO NOTHING;
    END IF;
END $$;

-- 3. Set existing assignments as primary if no primary exists for each user
DO $$
BEGIN
    UPDATE "user_departments" 
    SET "is_primary" = TRUE 
    WHERE "id" IN (
        SELECT DISTINCT ON ("user_id") "id"
        FROM "user_departments" 
        WHERE "user_id" NOT IN (
            SELECT "user_id" FROM "user_departments" WHERE "is_primary" = TRUE
        )
        ORDER BY "user_id", "id"
    );
END $$;

-- 4. Add necessary indexes for performance
CREATE INDEX IF NOT EXISTS "idx_user_departments_user_id" ON "user_departments"("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_departments_department_id" ON "user_departments"("department_id");
CREATE INDEX IF NOT EXISTS "idx_user_departments_is_primary" ON "user_departments"("is_primary");

-- ==============================================================================
-- VERIFICATION QUERIES
-- ==============================================================================

-- Check the user_departments table structure
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns 
-- WHERE table_name = 'user_departments' ORDER BY ordinal_position;

-- Check current user department assignments
-- SELECT u.username, d.name as department, ud.is_primary 
-- FROM users u 
-- JOIN user_departments ud ON u.id = ud.user_id 
-- JOIN departments d ON ud.department_id = d.id
-- ORDER BY u.username, ud.is_primary DESC;

-- ==============================================================================
-- NOTES
-- ==============================================================================

-- This script:
-- 1. Adds the missing is_primary and assigned_at columns to user_departments table
-- 2. Migrates existing department assignments from users table if the user_departments table is empty
-- 3. Ensures each user has at least one primary department assignment
-- 4. Creates necessary indexes for optimal performance
-- 5. Is safe to run multiple times (idempotent)

-- After running this script:
-- - Users will be able to have multiple unit assignments
-- - Secondary unit checkboxes will persist after saving
-- - Users will see tasks from all their assigned units
-- - The admin interface will correctly load and save multiple unit assignments