-- Add missing isPrimary column to user_departments table
-- This fixes the schema mismatch between code and database

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
    
    -- Set existing assignments as primary if no primary exists for each user
    UPDATE "user_departments" 
    SET "is_primary" = TRUE 
    WHERE "id" IN (
        SELECT DISTINCT ON ("userId") "id"
        FROM "user_departments" 
        WHERE "userId" NOT IN (
            SELECT "userId" FROM "user_departments" WHERE "is_primary" = TRUE
        )
        ORDER BY "userId", "id"
    );
END $$;

-- Verify the changes
-- SELECT * FROM information_schema.columns WHERE table_name = 'user_departments';