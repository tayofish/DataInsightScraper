-- Assign users to primary departments based on existing categories

-- First, check what categories exist
SELECT id, name FROM categories ORDER BY id;

-- Assign users to departments based on their unit assignments or default
INSERT INTO user_departments (user_id, department_id, is_primary)
SELECT 
    u.id as user_id,
    CASE 
        WHEN u.department_id = 9 THEN (SELECT id FROM categories WHERE name LIKE '%Infrastructure%' OR name LIKE '%System%' LIMIT 1)
        WHEN u.department_id = 5 THEN (SELECT id FROM categories WHERE name LIKE '%Management%' OR name LIKE '%Project%' LIMIT 1)
        WHEN u.department_id = 19 THEN (SELECT id FROM categories WHERE name LIKE '%Management%' OR name LIKE '%Project%' LIMIT 1)
        ELSE (SELECT MIN(id) FROM categories)
    END as department_id,
    true as is_primary
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_departments ud 
    WHERE ud.user_id = u.id AND ud.is_primary = true
)
AND EXISTS (SELECT 1 FROM categories LIMIT 1);

-- Verify the assignments
SELECT 
    u.id,
    u.username,
    u.email,
    u.department_id as unit_id,
    d.name as unit_name,
    ud.department_id as primary_dept_id,
    c.name as primary_dept_name,
    c.color as dept_color
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.is_primary = true
LEFT JOIN categories c ON ud.department_id = c.id
ORDER BY u.id;