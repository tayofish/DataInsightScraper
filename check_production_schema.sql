-- Check production database schema for onboarding components

-- 1. Check what tables exist for departments/categories
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('departments', 'categories', 'user_departments')
ORDER BY table_name;

-- 2. Check structure of categories table (should be departments in UI)
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'categories'
ORDER BY ordinal_position;

-- 3. Check structure of departments table (should be units in UI) 
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'departments'
ORDER BY ordinal_position;

-- 4. Check data in categories table (these should be "departments" in UI)
SELECT id, name, description, color, department_id 
FROM categories 
ORDER BY name;

-- 5. Check data in departments table (these should be "units" in UI)
SELECT id, name, description 
FROM departments 
ORDER BY name;

-- 6. Check user_departments table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_departments'
ORDER BY ordinal_position;