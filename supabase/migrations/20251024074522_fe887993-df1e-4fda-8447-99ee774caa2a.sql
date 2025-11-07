-- Create function to get employees with their profile info
CREATE OR REPLACE FUNCTION get_company_employees(p_company_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  role role_company,
  department_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  company_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    m.user_id,
    COALESCE(p.email, '') as email,
    m.role,
    m.department_id,
    m.created_at,
    m.updated_at,
    m.company_id
  FROM memberships m
  LEFT JOIN profiles_v2 p ON p.user_id = m.user_id
  WHERE m.company_id = p_company_id
  ORDER BY m.created_at DESC;
$$;