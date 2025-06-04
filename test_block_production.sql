-- Simple test to verify block/unblock functionality works in production
-- This will help identify if the issue is with the database operations

-- Test 1: Try to update is_blocked directly with SQL
UPDATE users SET is_blocked = true WHERE id = 21;

-- Verify the update worked
SELECT id, username, name, is_blocked FROM users WHERE id = 21;

-- Test 2: Undo the update
UPDATE users SET is_blocked = false WHERE id = 21;

-- Verify the undo worked
SELECT id, username, name, is_blocked FROM users WHERE id = 21;