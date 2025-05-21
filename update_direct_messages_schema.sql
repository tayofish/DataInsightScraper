-- Update direct_messages table to support improved offline handling
DO $$
BEGIN
    -- Add sync_status column if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'direct_messages' AND column_name = 'sync_status') THEN
        ALTER TABLE "direct_messages" ADD COLUMN "sync_status" TEXT DEFAULT 'synced';
        RAISE NOTICE 'Added sync_status column to direct_messages table';
    END IF;
    
    -- Add client_id column for tracking locally created messages
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'direct_messages' AND column_name = 'client_id') THEN
        ALTER TABLE "direct_messages" ADD COLUMN "client_id" TEXT;
        RAISE NOTICE 'Added client_id column to direct_messages table';
    END IF;
    
    -- Add sync_attempts column to track retry attempts
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'direct_messages' AND column_name = 'sync_attempts') THEN
        ALTER TABLE "direct_messages" ADD COLUMN "sync_attempts" INTEGER DEFAULT 0;
        RAISE NOTICE 'Added sync_attempts column to direct_messages table';
    END IF;
    
    -- Add last_sync_attempt timestamp
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'direct_messages' AND column_name = 'last_sync_attempt') THEN
        ALTER TABLE "direct_messages" ADD COLUMN "last_sync_attempt" TIMESTAMP;
        RAISE NOTICE 'Added last_sync_attempt column to direct_messages table';
    END IF;
    
    -- Create index on client_id for faster lookups when syncing
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'direct_messages' AND indexname = 'idx_direct_messages_client_id') THEN
        CREATE INDEX idx_direct_messages_client_id ON direct_messages(client_id);
        RAISE NOTICE 'Created index on direct_messages(client_id)';
    END IF;
    
    -- Create index on sync_status for faster filtering of pending messages
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'direct_messages' AND indexname = 'idx_direct_messages_sync_status') THEN
        CREATE INDEX idx_direct_messages_sync_status ON direct_messages(sync_status);
        RAISE NOTICE 'Created index on direct_messages(sync_status)';
    END IF;
END$$;

-- Do the same for regular channel messages
DO $$
BEGIN
    -- Add sync_status column if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'sync_status') THEN
        ALTER TABLE "messages" ADD COLUMN "sync_status" TEXT DEFAULT 'synced';
        RAISE NOTICE 'Added sync_status column to messages table';
    END IF;
    
    -- Add client_id column for tracking locally created messages
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'client_id') THEN
        ALTER TABLE "messages" ADD COLUMN "client_id" TEXT;
        RAISE NOTICE 'Added client_id column to messages table';
    END IF;
    
    -- Add sync_attempts column to track retry attempts
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'sync_attempts') THEN
        ALTER TABLE "messages" ADD COLUMN "sync_attempts" INTEGER DEFAULT 0;
        RAISE NOTICE 'Added sync_attempts column to messages table';
    END IF;
    
    -- Add last_sync_attempt timestamp
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'last_sync_attempt') THEN
        ALTER TABLE "messages" ADD COLUMN "last_sync_attempt" TIMESTAMP;
        RAISE NOTICE 'Added last_sync_attempt column to messages table';
    END IF;
    
    -- Create index on client_id for faster lookups when syncing
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'messages' AND indexname = 'idx_messages_client_id') THEN
        CREATE INDEX idx_messages_client_id ON messages(client_id);
        RAISE NOTICE 'Created index on messages(client_id)';
    END IF;
    
    -- Create index on sync_status for faster filtering of pending messages
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'messages' AND indexname = 'idx_messages_sync_status') THEN
        CREATE INDEX idx_messages_sync_status ON messages(sync_status);
        RAISE NOTICE 'Created index on messages(sync_status)';
    END IF;
END$$;

-- Create table to track database connection status if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'connection_status') THEN
        CREATE TABLE "connection_status" (
            "id" SERIAL PRIMARY KEY,
            "status" TEXT NOT NULL,
            "last_updated" TIMESTAMP NOT NULL DEFAULT now(),
            "details" TEXT,
            "reconnect_attempts" INTEGER DEFAULT 0
        );
        -- Insert initial record
        INSERT INTO connection_status (status) VALUES ('online');
        RAISE NOTICE 'Created connection_status table';
    END IF;
END$$;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE 'Database schema update for offline messaging support completed successfully!';
END $$;