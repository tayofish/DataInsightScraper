-- Production Database Schema Update: User Departments & Onboarding
-- This file contains the SQL commands to update the production database
-- with the new user_departments table and onboarding-related changes.

-- Run these commands in the production database to sync with development changes

-- 1. Create user_departments table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_departments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    assigned_at TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, department_id)
);

-- 2. Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_departments_user_id ON user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_primary ON user_departments(user_id, is_primary) WHERE is_primary = true;

-- 3. Ensure only one primary department per user
CREATE OR REPLACE FUNCTION ensure_single_primary_department()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting a department as primary, remove primary flag from other departments
    IF NEW.is_primary = true THEN
        UPDATE user_departments 
        SET is_primary = false 
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger to enforce single primary department
DROP TRIGGER IF EXISTS trigger_ensure_single_primary_department ON user_departments;
CREATE TRIGGER trigger_ensure_single_primary_department
    BEFORE INSERT OR UPDATE ON user_departments
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_primary_department();

-- 5. Migrate existing users to user_departments table
-- This creates user_departments entries for users who have a department_id but no user_departments entry
INSERT INTO user_departments (user_id, department_id, is_primary, assigned_at)
SELECT 
    u.id, 
    c.id, 
    true, 
    NOW()
FROM users u
CROSS JOIN categories c
WHERE u.department_id IS NOT NULL 
    AND c.department_id = u.department_id
    AND NOT EXISTS (
        SELECT 1 FROM user_departments ud 
        WHERE ud.user_id = u.id AND ud.is_primary = true
    )
ON CONFLICT (user_id, department_id) DO NOTHING;

-- 6. Verify the migration
-- This query should show all users and their department assignments
SELECT 
    u.id as user_id,
    u.username,
    u.name,
    u.department_id as unit_id,
    d.name as unit_name,
    ud.department_id as category_id,
    c.name as category_name,
    ud.is_primary
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.is_primary = true
LEFT JOIN categories c ON ud.department_id = c.id
ORDER BY u.id;

-- 7. Update any users who might not have proper department assignments
-- (This is a safety net for edge cases)
UPDATE user_departments 
SET is_primary = true 
WHERE id IN (
    SELECT DISTINCT ON (user_id) id 
    FROM user_departments 
    WHERE user_id NOT IN (
        SELECT user_id FROM user_departments WHERE is_primary = true
    )
    ORDER BY user_id, assigned_at ASC
);

-- 8. Onboarding-related schema updates
-- Ensure users table has necessary columns for onboarding flow

-- Add email column if it doesn't exist (for onboarding email validation)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;

-- Add onboarding completion tracking
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN DEFAULT FALSE;

-- Update existing users who have department assignments to mark onboarding as complete
UPDATE users 
SET has_completed_onboarding = true 
WHERE department_id IS NOT NULL 
   OR id IN (SELECT DISTINCT user_id FROM user_departments);

-- Create index for onboarding queries
CREATE INDEX IF NOT EXISTS idx_users_onboarding ON users(has_completed_onboarding);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- 9. Ensure proper foreign key relationships for onboarding
-- Verify categories table has proper department_id references
ALTER TABLE categories 
ADD CONSTRAINT IF NOT EXISTS fk_categories_department_id 
FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- 10. Create onboarding completion endpoint data validation
-- This ensures that the onboarding process properly validates department assignments
CREATE OR REPLACE FUNCTION validate_onboarding_completion(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_department BOOLEAN := FALSE;
    v_has_unit BOOLEAN := FALSE;
BEGIN
    -- Check if user has at least one department assignment
    SELECT EXISTS(
        SELECT 1 FROM user_departments 
        WHERE user_id = p_user_id AND is_primary = true
    ) INTO v_has_department;
    
    -- Check if user has a unit assignment
    SELECT EXISTS(
        SELECT 1 FROM users 
        WHERE id = p_user_id AND department_id IS NOT NULL
    ) INTO v_has_unit;
    
    RETURN v_has_department AND v_has_unit;
END;
$$ LANGUAGE plpgsql;

-- 11. Update onboarding completion status for all users
UPDATE users 
SET has_completed_onboarding = validate_onboarding_completion(id)
WHERE has_completed_onboarding = false;

-- 12. Add welcome notifications for users who completed onboarding
INSERT INTO notifications (user_id, title, message, type, created_at)
SELECT 
    u.id,
    'Welcome to the platform!',
    'Your account setup is complete. You can now access all features and collaborate with your team.',
    'welcome',
    NOW()
FROM users u
WHERE u.has_completed_onboarding = true
  AND NOT EXISTS (
    SELECT 1 FROM notifications n 
    WHERE n.user_id = u.id AND n.type = 'welcome'
  )
ON CONFLICT DO NOTHING;

-- 13. Final verification query for onboarding
-- This query helps verify that all users have proper onboarding status
SELECT 
    u.id,
    u.username,
    u.email,
    u.has_completed_onboarding,
    u.department_id as unit_id,
    d.name as unit_name,
    COUNT(ud.id) as department_count,
    CASE 
        WHEN COUNT(ud.id) > 0 AND u.department_id IS NOT NULL THEN 'Complete'
        WHEN COUNT(ud.id) = 0 AND u.department_id IS NULL THEN 'Needs Onboarding'
        ELSE 'Partial Setup'
    END as onboarding_status
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN user_departments ud ON u.id = ud.user_id
GROUP BY u.id, u.username, u.email, u.has_completed_onboarding, u.department_id, d.name
ORDER BY u.id;

-- End of schema update