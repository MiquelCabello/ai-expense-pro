-- Fix function search path for security
-- This migration fixes functions that don't have a proper search_path set

-- Fix is_master_user function with _email parameter
-- Convert to SECURITY DEFINER with proper search_path
CREATE OR REPLACE FUNCTION public.is_master_user(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _email = 'info@miquelcabello.com';
$$;

-- Fix set_safe_search_path function
-- Convert to SECURITY DEFINER with proper search_path
CREATE OR REPLACE FUNCTION public.set_safe_search_path()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT set_config('search_path', 'public', true);
$$;