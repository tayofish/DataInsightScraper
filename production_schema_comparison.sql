-- Production Schema Comparison for Onboarding
-- Run this command on your production database

SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name IN ('users', 'categories', 'departments', 'user_departments')
ORDER BY table_name, ordinal_position;