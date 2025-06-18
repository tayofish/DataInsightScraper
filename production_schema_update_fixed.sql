-- Production Database Schema Update - FIXED VERSION
-- This file contains all the necessary changes to update your production database
-- Run these commands in order on your production server

-- ==============================================================================
-- SCHEMA UPDATES FOR MULTIPLE UNIT ASSIGNMENTS AND ENHANCED TASK MANAGEMENT
-- ==============================================================================

-- 1. Create userDepartments table for many-to-many relationship between users and units
CREATE TABLE IF NOT EXISTS "userDepartments" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "departmentId" INTEGER NOT NULL REFERENCES "departments"("id") ON DELETE CASCADE,
    "isPrimary" BOOLEAN DEFAULT FALSE,
    "assignedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE("userId", "departmentId")
);

-- 2. Create index for better performance on userDepartments queries
CREATE INDEX IF NOT EXISTS "idx_userDepartments_userId" ON "userDepartments"("userId");
CREATE INDEX IF NOT EXISTS "idx_userDepartments_departmentId" ON "userDepartments"("departmentId");
CREATE INDEX IF NOT EXISTS "idx_userDepartments_isPrimary" ON "userDepartments"("isPrimary");

-- 3. Migrate existing department assignments to new table (only if userDepartments is empty)
-- Check if the table exists and has the right structure first
DO $$ 
BEGIN
    -- Only migrate if userDepartments table is empty and users table has departmentId column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='departmentId') 
       AND NOT EXISTS (SELECT 1 FROM "userDepartments" LIMIT 1) THEN
        
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

-- 4. Add isBlocked column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='isBlocked') THEN
        ALTER TABLE "users" ADD COLUMN "isBlocked" BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 5. Add index on isBlocked for better performance
CREATE INDEX IF NOT EXISTS "idx_users_isBlocked" ON "users"("isBlocked");

-- 6. Ensure all necessary columns exist in users table
DO $$ 
BEGIN
    -- Add isApproved column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='isApproved') THEN
        ALTER TABLE "users" ADD COLUMN "isApproved" BOOLEAN DEFAULT TRUE;
    END IF;
    
    -- Add isAdmin column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='isAdmin') THEN
        ALTER TABLE "users" ADD COLUMN "isAdmin" BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add email column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='email') THEN
        ALTER TABLE "users" ADD COLUMN "email" TEXT;
    END IF;
    
    -- Add avatar column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='avatar') THEN
        ALTER TABLE "users" ADD COLUMN "avatar" TEXT;
    END IF;
END $$;

-- 7. Ensure tasks table has all necessary columns
DO $$ 
BEGIN
    -- Add departmentId column if it doesn't exist (should already exist but checking)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='tasks' AND column_name='departmentId') THEN
        ALTER TABLE "tasks" ADD COLUMN "departmentId" INTEGER REFERENCES "departments"("id");
    END IF;
    
    -- Add priority column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='tasks' AND column_name='priority') THEN
        ALTER TABLE "tasks" ADD COLUMN "priority" TEXT DEFAULT 'medium';
    END IF;
    
    -- Add status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='tasks' AND column_name='status') THEN
        ALTER TABLE "tasks" ADD COLUMN "status" TEXT DEFAULT 'pending';
    END IF;
    
    -- Add assigneeId column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='tasks' AND column_name='assigneeId') THEN
        ALTER TABLE "tasks" ADD COLUMN "assigneeId" INTEGER REFERENCES "users"("id");
    END IF;
    
    -- Add dueDate column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='tasks' AND column_name='dueDate') THEN
        ALTER TABLE "tasks" ADD COLUMN "dueDate" TIMESTAMP;
    END IF;
    
    -- Add categoryId column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='tasks' AND column_name='categoryId') THEN
        ALTER TABLE "tasks" ADD COLUMN "categoryId" INTEGER REFERENCES "categories"("id");
    END IF;
END $$;

-- 8. Add indexes for better task filtering performance (with existence checks)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='departmentId') THEN
        CREATE INDEX IF NOT EXISTS "idx_tasks_departmentId" ON "tasks"("departmentId");
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='assigneeId') THEN
        CREATE INDEX IF NOT EXISTS "idx_tasks_assigneeId" ON "tasks"("assigneeId");
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='status') THEN
        CREATE INDEX IF NOT EXISTS "idx_tasks_status" ON "tasks"("status");
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='priority') THEN
        CREATE INDEX IF NOT EXISTS "idx_tasks_priority" ON "tasks"("priority");
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='categoryId') THEN
        CREATE INDEX IF NOT EXISTS "idx_tasks_categoryId" ON "tasks"("categoryId");
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='dueDate') THEN
        CREATE INDEX IF NOT EXISTS "idx_tasks_dueDate" ON "tasks"("dueDate");
    END IF;
END $$;

-- 9. Ensure categories table exists with proper structure
CREATE TABLE IF NOT EXISTS "categories" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT DEFAULT '#3b82f6',
    "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 10. Ensure departments table exists with proper structure
CREATE TABLE IF NOT EXISTS "departments" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 11. Create or update projects table
CREATE TABLE IF NOT EXISTS "projects" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 12. Create project assignments table if it doesn't exist
CREATE TABLE IF NOT EXISTS "projectAssignments" (
    "id" SERIAL PRIMARY KEY,
    "projectId" INTEGER NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "role" TEXT DEFAULT 'Member',
    "assignedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE("projectId", "userId")
);

-- 13. Create task updates table for tracking changes
CREATE TABLE IF NOT EXISTS "taskUpdates" (
    "id" SERIAL PRIMARY KEY,
    "taskId" INTEGER NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
    "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "updateType" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 14. Create task collaborators table
CREATE TABLE IF NOT EXISTS "taskCollaborators" (
    "id" SERIAL PRIMARY KEY,
    "taskId" INTEGER NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
    "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "inviterId" INTEGER NOT NULL REFERENCES "users"("id"),
    "invitedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE("taskId", "userId")
);

-- 15. Create notifications table with conditional column additions
DO $$
BEGIN
    -- Create the table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        CREATE TABLE "notifications" (
            "id" SERIAL PRIMARY KEY,
            "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "title" TEXT NOT NULL,
            "message" TEXT NOT NULL,
            "type" TEXT DEFAULT 'info',
            "isRead" BOOLEAN DEFAULT FALSE,
            "referenceId" INTEGER,
            "referenceType" TEXT,
            "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
        );
    ELSE
        -- Add missing columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='userId') THEN
            ALTER TABLE "notifications" ADD COLUMN "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
        
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
    END IF;
END $$;

-- 16. Create app settings table
CREATE TABLE IF NOT EXISTS "appSettings" (
    "id" SERIAL PRIMARY KEY,
    "key" TEXT UNIQUE NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 17. Create reports table
CREATE TABLE IF NOT EXISTS "reports" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parameters" TEXT,
    "createdBy" INTEGER NOT NULL REFERENCES "users"("id"),
    "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 18. Create channels table with conditional column additions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channels') THEN
        CREATE TABLE "channels" (
            "id" SERIAL PRIMARY KEY,
            "name" TEXT NOT NULL,
            "description" TEXT,
            "type" TEXT DEFAULT 'public',
            "createdBy" INTEGER NOT NULL REFERENCES "users"("id"),
            "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
            "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
            "isArchived" BOOLEAN DEFAULT FALSE
        );
    END IF;
END $$;

-- 19. Create channel members table with conditional column additions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channelMembers') THEN
        CREATE TABLE "channelMembers" (
            "id" SERIAL PRIMARY KEY,
            "channelId" INTEGER NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
            "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "role" TEXT DEFAULT 'member',
            "joinedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
            "lastRead" TIMESTAMP DEFAULT NOW(),
            UNIQUE("channelId", "userId")
        );
    ELSE
        -- Add missing columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='channelMembers' AND column_name='channelId') THEN
            ALTER TABLE "channelMembers" ADD COLUMN "channelId" INTEGER NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 20. Create messages table with conditional column additions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
        CREATE TABLE "messages" (
            "id" SERIAL PRIMARY KEY,
            "channelId" INTEGER NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
            "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "content" TEXT NOT NULL,
            "type" TEXT DEFAULT 'text',
            "attachments" TEXT,
            "mentions" TEXT,
            "parentId" INTEGER REFERENCES "messages"("id"),
            "isEdited" BOOLEAN DEFAULT FALSE,
            "editedAt" TIMESTAMP,
            "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
        );
    END IF;
END $$;

-- 21. Create direct messages table
CREATE TABLE IF NOT EXISTS "directMessages" (
    "id" SERIAL PRIMARY KEY,
    "senderId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "receiverId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "content" TEXT NOT NULL,
    "type" TEXT DEFAULT 'text',
    "attachments" TEXT,
    "isRead" BOOLEAN DEFAULT FALSE,
    "readAt" TIMESTAMP,
    "isEdited" BOOLEAN DEFAULT FALSE,
    "editedAt" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 22. Add necessary indexes for performance (with conditional checks)
CREATE INDEX IF NOT EXISTS "idx_taskUpdates_taskId" ON "taskUpdates"("taskId");
CREATE INDEX IF NOT EXISTS "idx_taskCollaborators_taskId" ON "taskCollaborators"("taskId");

-- Create indexes only if the columns exist
DO $$ 
BEGIN
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

CREATE INDEX IF NOT EXISTS "idx_messages_channelId" ON "messages"("channelId");
CREATE INDEX IF NOT EXISTS "idx_directMessages_senderId" ON "directMessages"("senderId");
CREATE INDEX IF NOT EXISTS "idx_directMessages_receiverId" ON "directMessages"("receiverId");

-- 23. Insert default app settings if they don't exist
INSERT INTO "appSettings" ("key", "value", "description") VALUES
    ('app_name', 'Promellon', 'Application name')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "appSettings" ("key", "value", "description") VALUES
    ('local_auth', 'true', 'Enable local authentication')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "appSettings" ("key", "value", "description") VALUES
    ('microsoft_auth', 'true', 'Enable Microsoft authentication')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "appSettings" ("key", "value", "description") VALUES
    ('allow_registration', 'false', 'Allow user registration')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "appSettings" ("key", "value", "description") VALUES
    ('microsoft_approval_required', 'true', 'Require approval for Microsoft users')
ON CONFLICT ("key") DO NOTHING;

-- 24. Create a function to get user departments (used by the application)
CREATE OR REPLACE FUNCTION get_user_departments(user_id INTEGER)
RETURNS TABLE(department_id INTEGER, is_primary BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    SELECT ud."departmentId", ud."isPrimary"
    FROM "userDepartments" ud
    WHERE ud."userId" = user_id;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- VERIFICATION QUERIES
-- ==============================================================================

-- Run these queries to verify the schema update was successful:

-- Check userDepartments table structure
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'userDepartments';

-- Check user department assignments
-- SELECT u.username, d.name as department, ud."isPrimary" FROM users u 
-- JOIN "userDepartments" ud ON u.id = ud."userId" 
-- JOIN departments d ON ud."departmentId" = d.id;

-- Check all tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- ==============================================================================
-- NOTES
-- ==============================================================================

-- 1. This script is designed to be idempotent - you can run it multiple times safely
-- 2. All existing data is preserved during the migration
-- 3. The userDepartments table allows users to be assigned to multiple units
-- 4. The isPrimary flag indicates which department is the user's primary unit
-- 5. All necessary indexes are created for optimal performance
-- 6. Foreign key constraints ensure data integrity
-- 7. Column existence checks prevent errors on tables with different schemas