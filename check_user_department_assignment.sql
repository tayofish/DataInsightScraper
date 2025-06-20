-- Check specific user's department assignment after onboarding fix
SELECT 
    u.id,
    u.username,
    u.email,
    u.has_completed_onboarding,
    u.department_id as unit_id,
    d.name as unit_name,
    ud.department_id as primary_dept_id,
    c.name as primary_dept_name,
    c.color as dept_color,
    ud.is_primary,
    ud.assigned_at
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.is_primary = true
LEFT JOIN categories c ON ud.department_id = c.id
WHERE u.username = 'tayofisuyi@lagosstate.gov.ng'
ORDER BY u.id;

-- Also check all department assignments for this user
SELECT 
    u.username,
    ud.department_id,
    c.name as department_name,
    c.color,
    ud.is_primary,
    ud.assigned_at
FROM users u
JOIN user_departments ud ON u.id = ud.user_id
LEFT JOIN categories c ON ud.department_id = c.id
WHERE u.username = 'tayofisuyi@lagosstate.gov.ng'
ORDER BY ud.is_primary DESC, ud.assigned_at;