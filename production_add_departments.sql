-- Add proper departments (categories) to production database
-- These will show up in the department selection during onboarding

-- First, let's see what we currently have
SELECT 'Current Categories (Departments in UI):' as info;
SELECT id, name, color, department_id FROM categories ORDER BY name;

SELECT 'Current Departments (Units in UI):' as info;
SELECT id, name, description FROM departments ORDER BY name;

-- Add common departments if they don't exist
INSERT INTO categories (name, description, color, department_id) 
VALUES 
    ('Human Resources', 'HR and personnel management', '#10b981', NULL),
    ('Finance', 'Financial operations and accounting', '#f59e0b', NULL),
    ('IT Support', 'Information technology support', '#3b82f6', NULL),
    ('Operations', 'Daily operations and logistics', '#8b5cf6', NULL),
    ('Marketing', 'Marketing and communications', '#ef4444', NULL),
    ('Sales', 'Sales and customer relations', '#06b6d4', NULL)
ON CONFLICT (name) DO NOTHING;

-- Show the updated list
SELECT 'Updated Categories (Departments in UI):' as info;
SELECT id, name, color, department_id FROM categories ORDER BY name;