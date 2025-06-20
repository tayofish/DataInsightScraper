-- Fix production department assignments and ensure categories data exists

-- Check if categories table has data
SELECT COUNT(*) as category_count FROM categories;

-- If categories table is empty, populate it with department data
INSERT INTO categories (name, color, department_id)
SELECT 
    'App Development' as name, 
    '#3b82f6' as color,
    8 as department_id
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'App Development')
UNION ALL
SELECT 
    'Database Management' as name, 
    '#10b981' as color,
    2 as department_id
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Database Management')
UNION ALL
SELECT 
    'Network Operations' as name, 
    '#f59e0b' as color,
    13 as department_id
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Network Operations')
UNION ALL
SELECT 
    'Security Operations' as name, 
    '#ef4444' as color,
    3 as department_id
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Security Operations')
UNION ALL
SELECT 
    'Infrastructure Support' as name, 
    '#8b5cf6' as color,
    9 as department_id
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Infrastructure Support')
UNION ALL
SELECT 
    'Project Management' as name, 
    '#06b6d4' as color,
    17 as department_id
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Project Management')
UNION ALL
SELECT 
    'System Administration' as name, 
    '#84cc16' as color,
    12 as department_id
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'System Administration');

-- Check current user department assignments
SELECT 
    u.id,
    u.username,
    u.department_id as unit_id,
    d.name as unit_name,
    COUNT(ud.id) as department_assignments
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN user_departments ud ON u.id = ud.user_id
GROUP BY u.id, u.username, u.department_id, d.name
ORDER BY u.id;

-- For users without department assignments, create default assignments
INSERT INTO user_departments (user_id, department_id, is_primary)
SELECT 
    u.id as user_id,
    1 as department_id, -- Default to first category
    true as is_primary
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_departments ud 
    WHERE ud.user_id = u.id AND ud.is_primary = true
)
AND EXISTS (SELECT 1 FROM categories WHERE id = 1);

-- Final verification
SELECT 
    u.id,
    u.username,
    u.email,
    u.has_completed_onboarding,
    u.department_id as unit_id,
    d.name as unit_name,
    ud.department_id as primary_department_id,
    c.name as primary_department_name
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.is_primary = true
LEFT JOIN categories c ON ud.department_id = c.id
ORDER BY u.id;