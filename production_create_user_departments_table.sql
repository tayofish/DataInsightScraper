-- Complete Production Fix - Create user_departments table and setup multiple unit assignments
-- This script creates the missing table and sets up the complete functionality

-- 1. Create the user_departments table if it doesn't exist
CREATE TABLE IF NOT EXISTS "user_departments" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "department_id" INTEGER NOT NULL REFERENCES "departments"("id") ON DELETE CASCADE,
    "is_primary" BOOLEAN DEFAULT FALSE,
    "assigned_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE("user_id", "department_id")
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_user_departments_user_id" ON "user_departments"("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_departments_department_id" ON "user_departments"("department_id");
CREATE INDEX IF NOT EXISTS "idx_user_departments_is_primary" ON "user_departments"("is_primary");

-- 3. Migrate existing user department assignments from users table
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

-- 4. Ensure each user has at least one primary department assignment
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

-- 5. Ensure users table has necessary columns for user management
DO $$
BEGIN
    -- Add isBlocked column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='is_blocked') THEN
        ALTER TABLE "users" ADD COLUMN "is_blocked" BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add isApproved column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='is_approved') THEN
        ALTER TABLE "users" ADD COLUMN "is_approved" BOOLEAN DEFAULT TRUE;
    END IF;
    
    -- Add isAdmin column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='is_admin') THEN
        ALTER TABLE "users" ADD COLUMN "is_admin" BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- ==============================================================================
-- VERIFICATION QUERIES (uncomment to run manually)
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

-- Check if any users are missing department assignments
-- SELECT u.id, u.username FROM users u 
-- WHERE NOT EXISTS (SELECT 1 FROM user_departments ud WHERE ud.user_id = u.id);

-- ==============================================================================
-- NOTES
-- ==============================================================================

-- This script:
-- 1. Creates the user_departments table with proper structure
-- 2. Migrates existing department assignments from users table
-- 3. Ensures each user has at least one primary department assignment
-- 4. Adds necessary user management columns to users table
-- 5. Creates performance indexes
-- 6. Is safe to run multiple times (idempotent)

-- After running this script:
-- - The admin interface will be able to assign users to multiple units
-- - Secondary unit checkboxes will persist after saving
-- - Users will see tasks from all their assigned units
-- - The /api/users/:id/departments endpoint will work correctly