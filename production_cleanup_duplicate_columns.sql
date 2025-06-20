-- Production Database Cleanup: Remove Duplicate Columns
-- This removes the duplicate camelCase columns that appear alongside snake_case versions

-- Remove duplicate columns if they exist
ALTER TABLE users DROP COLUMN IF EXISTS "isBlocked";
ALTER TABLE users DROP COLUMN IF EXISTS "isApproved";  
ALTER TABLE users DROP COLUMN IF EXISTS "isAdmin";

-- Verify cleanup by showing final users table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;