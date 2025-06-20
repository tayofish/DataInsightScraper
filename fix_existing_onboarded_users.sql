-- Fix for users who completed onboarding before the department assignment bug was fixed
-- This assigns a default primary department to users who have completed onboarding but lack department assignments

-- First, check which users completed onboarding but have no primary department assigned
SELECT 
    u.id,
    u.username,
    u.has_completed_onboarding,
    u.department_id as unit_id,
    COUNT(ud.id) as department_assignments
FROM users u
LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.is_primary = true
WHERE u.has_completed_onboarding = true
GROUP BY u.id, u.username, u.has_completed_onboarding, u.department_id
HAVING COUNT(ud.id) = 0
ORDER BY u.id;

-- Assign primary department to users who completed onboarding but lack department assignments
-- We'll assign them to the first available category/department
INSERT INTO user_departments (user_id, department_id, is_primary, assigned_at)
SELECT 
    u.id as user_id,
    (SELECT MIN(id) FROM categories LIMIT 1) as department_id,
    true as is_primary,
    NOW() as assigned_at
FROM users u
WHERE u.has_completed_onboarding = true
  AND NOT EXISTS (
    SELECT 1 FROM user_departments ud 
    WHERE ud.user_id = u.id AND ud.is_primary = true
  )
  AND EXISTS (SELECT 1 FROM categories LIMIT 1);

-- Verify the fix worked
SELECT 
    u.id,
    u.username,
    u.email,
    u.has_completed_onboarding,
    u.department_id as unit_id,
    d.name as unit_name,
    ud.department_id as primary_dept_id,
    c.name as primary_dept_name,
    ud.assigned_at
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.is_primary = true
LEFT JOIN categories c ON ud.department_id = c.id
WHERE u.has_completed_onboarding = true
ORDER BY u.id;