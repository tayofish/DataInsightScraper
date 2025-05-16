-- Update schema for Promellon Task Management Application
-- This script should be run against an existing database
-- It adds and updates tables needed for proper WebSocket functionality

-- Ensure we have the necessary enum types
DO $$
BEGIN
    -- Check if the 'priority' enum type exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority') THEN
        CREATE TYPE priority AS ENUM ('low', 'medium', 'high');
    END IF;

    -- Check if the 'status' enum type exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status') THEN
        CREATE TYPE status AS ENUM ('todo', 'in_progress', 'completed');
    END IF;

    -- Check if the 'channel_type' enum type exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_type') THEN
        CREATE TYPE channel_type AS ENUM ('public', 'private', 'direct');
    END IF;

    -- Check if the 'message_type' enum type exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type') THEN
        CREATE TYPE message_type AS ENUM ('text', 'file', 'system', 'image');
    ELSE
        -- ALTER TYPE to add 'image' if it doesn't already exist
        BEGIN
            ALTER TYPE message_type ADD VALUE 'image' IF NOT EXISTS;
        EXCEPTION
            WHEN duplicate_object THEN
                NULL; -- Type value already exists, do nothing
        END;
    END IF;
END$$;

-- Update 'messages' table if it exists - add mentions column if not present
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'messages') THEN
        -- Add mentions column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'messages' AND column_name = 'mentions') THEN
            ALTER TABLE "messages" ADD COLUMN "mentions" TEXT;
            RAISE NOTICE 'Added mentions column to messages table';
        END IF;
        
        -- Add file_url column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'messages' AND column_name = 'file_url') THEN
            ALTER TABLE "messages" ADD COLUMN "file_url" TEXT;
            RAISE NOTICE 'Added file_url column to messages table';
        END IF;
        
        -- Add file_name column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'messages' AND column_name = 'file_name') THEN
            ALTER TABLE "messages" ADD COLUMN "file_name" TEXT;
            RAISE NOTICE 'Added file_name column to messages table';
        END IF;
    ELSE
        -- Create messages table if it doesn't exist
        CREATE TABLE "messages" (
            "id" SERIAL PRIMARY KEY,
            "channel_id" INTEGER NOT NULL,
            "user_id" INTEGER NOT NULL,
            "parent_id" INTEGER,
            "content" TEXT NOT NULL,
            "type" message_type DEFAULT 'text',
            "attachments" TEXT,
            "file_url" TEXT,
            "file_name" TEXT,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP,
            "is_edited" BOOLEAN DEFAULT false,
            "reactions" TEXT,
            "mentions" TEXT
        );
        RAISE NOTICE 'Created messages table';
    END IF;
END$$;

-- Update 'direct_messages' table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'direct_messages') THEN
        -- Add mentions column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'direct_messages' AND column_name = 'mentions') THEN
            ALTER TABLE "direct_messages" ADD COLUMN "mentions" TEXT;
            RAISE NOTICE 'Added mentions column to direct_messages table';
        END IF;
        
        -- Add file_url column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'direct_messages' AND column_name = 'file_url') THEN
            ALTER TABLE "direct_messages" ADD COLUMN "file_url" TEXT;
            RAISE NOTICE 'Added file_url column to direct_messages table';
        END IF;
        
        -- Add file_name column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'direct_messages' AND column_name = 'file_name') THEN
            ALTER TABLE "direct_messages" ADD COLUMN "file_name" TEXT;
            RAISE NOTICE 'Added file_name column to direct_messages table';
        END IF;
    ELSE
        -- Create direct_messages table if it doesn't exist
        CREATE TABLE "direct_messages" (
            "id" SERIAL PRIMARY KEY,
            "sender_id" INTEGER NOT NULL,
            "receiver_id" INTEGER NOT NULL,
            "content" TEXT NOT NULL,
            "type" message_type DEFAULT 'text',
            "attachments" TEXT,
            "file_url" TEXT,
            "file_name" TEXT,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "is_read" BOOLEAN DEFAULT false,
            "is_edited" BOOLEAN DEFAULT false,
            "mentions" TEXT
        );
        RAISE NOTICE 'Created direct_messages table';
    END IF;
END$$;

-- Create or update channels table
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'channels') THEN
        CREATE TABLE "channels" (
            "id" SERIAL PRIMARY KEY,
            "name" TEXT NOT NULL,
            "description" TEXT,
            "type" channel_type DEFAULT 'public',
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP,
            "created_by" INTEGER,
            "is_archived" BOOLEAN DEFAULT false
        );
        RAISE NOTICE 'Created channels table';
    END IF;
END$$;

-- Create or update channel_members table
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'channel_members') THEN
        CREATE TABLE "channel_members" (
            "id" SERIAL PRIMARY KEY,
            "user_id" INTEGER NOT NULL,
            "channel_id" INTEGER NOT NULL,
            "role" TEXT DEFAULT 'member',
            "joined_at" TIMESTAMP NOT NULL DEFAULT now(),
            "last_read" TIMESTAMP
        );
        RAISE NOTICE 'Created channel_members table';
    END IF;
END$$;

-- Create or update notifications table with WebSocket-specific columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'notifications') THEN
        CREATE TABLE "notifications" (
            "id" SERIAL PRIMARY KEY,
            "user_id" INTEGER NOT NULL,
            "title" TEXT NOT NULL,
            "message" TEXT NOT NULL,
            "type" TEXT NOT NULL,
            "reference_id" INTEGER,
            "reference_type" TEXT,
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "is_read" BOOLEAN DEFAULT false
        );
        RAISE NOTICE 'Created notifications table';
    END IF;
END$$;

-- Create indexes to improve WebSocket query performance
DO $$
BEGIN
    -- Indexes for channel_members table
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'channel_members' AND indexname = 'idx_channel_members_user_id') THEN
        CREATE INDEX idx_channel_members_user_id ON channel_members(user_id);
        RAISE NOTICE 'Created index on channel_members(user_id)';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'channel_members' AND indexname = 'idx_channel_members_channel_id') THEN
        CREATE INDEX idx_channel_members_channel_id ON channel_members(channel_id);
        RAISE NOTICE 'Created index on channel_members(channel_id)';
    END IF;
    
    -- Indexes for messages table
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'messages' AND indexname = 'idx_messages_channel_id') THEN
        CREATE INDEX idx_messages_channel_id ON messages(channel_id);
        RAISE NOTICE 'Created index on messages(channel_id)';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'messages' AND indexname = 'idx_messages_user_id') THEN
        CREATE INDEX idx_messages_user_id ON messages(user_id);
        RAISE NOTICE 'Created index on messages(user_id)';
    END IF;
    
    -- Indexes for direct_messages table
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'direct_messages' AND indexname = 'idx_direct_messages_sender_id') THEN
        CREATE INDEX idx_direct_messages_sender_id ON direct_messages(sender_id);
        RAISE NOTICE 'Created index on direct_messages(sender_id)';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'direct_messages' AND indexname = 'idx_direct_messages_receiver_id') THEN
        CREATE INDEX idx_direct_messages_receiver_id ON direct_messages(receiver_id);
        RAISE NOTICE 'Created index on direct_messages(receiver_id)';
    END IF;
    
    -- Composite index for faster conversation queries
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'direct_messages' AND indexname = 'idx_direct_messages_conversation') THEN
        CREATE INDEX idx_direct_messages_conversation ON direct_messages(sender_id, receiver_id);
        RAISE NOTICE 'Created composite index on direct_messages(sender_id, receiver_id)';
    END IF;
    
    -- Indexes for notifications table
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'notifications' AND indexname = 'idx_notifications_user_id') THEN
        CREATE INDEX idx_notifications_user_id ON notifications(user_id);
        RAISE NOTICE 'Created index on notifications(user_id)';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'notifications' AND indexname = 'idx_notifications_user_id_is_read') THEN
        CREATE INDEX idx_notifications_user_id_is_read ON notifications(user_id, is_read);
        RAISE NOTICE 'Created composite index on notifications(user_id, is_read)';
    END IF;
END$$;

-- Add foreign key constraints if not already present
DO $$
BEGIN
    -- Messages foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                  WHERE constraint_name = 'messages_channel_id_fkey' 
                  AND table_name = 'messages') THEN
        ALTER TABLE messages 
        ADD CONSTRAINT messages_channel_id_fkey 
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint for messages.channel_id';
    END IF;
    
    -- Direct messages foreign keys (assuming users table exists)
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'users') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = 'direct_messages_sender_id_fkey' 
                      AND table_name = 'direct_messages') THEN
            ALTER TABLE direct_messages 
            ADD CONSTRAINT direct_messages_sender_id_fkey 
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint for direct_messages.sender_id';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                      WHERE constraint_name = 'direct_messages_receiver_id_fkey' 
                      AND table_name = 'direct_messages') THEN
            ALTER TABLE direct_messages 
            ADD CONSTRAINT direct_messages_receiver_id_fkey 
            FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint for direct_messages.receiver_id';
        END IF;
    END IF;
END$$;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE 'Database schema update completed successfully!';
END $$;