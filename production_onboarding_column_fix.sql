-- Production Fix: Add missing onboarding column
-- This adds the has_completed_onboarding column that was missing from the previous migration

-- Add the missing onboarding completion tracking column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN DEFAULT FALSE;

-- Add email column if it doesn't exist (for onboarding email validation)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;

-- Update existing users who have department assignments to mark onboarding as complete
UPDATE users 
SET has_completed_onboarding = true 
WHERE department_id IS NOT NULL 
   OR id IN (SELECT DISTINCT user_id FROM user_departments);

-- Create index for onboarding queries
CREATE INDEX IF NOT EXISTS idx_users_onboarding ON users(has_completed_onboarding);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Verify the column was added successfully
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name IN ('has_completed_onboarding', 'email');