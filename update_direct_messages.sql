-- Add file_url and file_name columns to direct_messages table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'direct_messages' AND column_name = 'file_url') THEN
        ALTER TABLE direct_messages ADD COLUMN file_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'direct_messages' AND column_name = 'file_name') THEN
        ALTER TABLE direct_messages ADD COLUMN file_name TEXT;
    END IF;
END
$$;