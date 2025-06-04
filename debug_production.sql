-- Debug script to check production database schema for block/unblock functionality
-- Run this on your production database to identify the issue

-- Check if users table exists and get its structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Check if is_blocked column exists specifically
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'is_blocked'
) AS is_blocked_exists;

-- Check if is_approved column exists specifically  
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'is_approved'
) AS is_approved_exists;

-- Show current users data to verify column values
SELECT id, username, name, is_admin, is_blocked, is_approved 
FROM users 
LIMIT 5;

-- Check for any recent errors in PostgreSQL logs related to users table
-- This helps identify if there are constraint violations or other issues