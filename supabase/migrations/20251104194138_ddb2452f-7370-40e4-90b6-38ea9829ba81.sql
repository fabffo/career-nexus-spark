-- ============================================
-- Fix Role Architecture: Update user_has_role to use user_roles table
-- ============================================

-- Replace the user_has_role function without dropping it
-- This maintains all dependent RLS policies
CREATE OR REPLACE FUNCTION public.user_has_role(user_id uuid, allowed_roles public.user_role[])
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  role_exists boolean := false;
  allowed_role public.user_role;
BEGIN
  -- Check if user has any of the allowed roles using the secure has_role function
  FOREACH allowed_role IN ARRAY allowed_roles
  LOOP
    -- Convert user_role to app_role by casting to text first
    IF public.has_role(user_id, allowed_role::text::public.app_role) THEN
      RETURN true;
    END IF;
  END LOOP;
  
  RETURN false;
END;
$$;

-- Add comment explaining the architecture
COMMENT ON FUNCTION public.user_has_role(uuid, public.user_role[]) IS 
'Wrapper function for backward compatibility. Delegates to has_role() which queries user_roles table instead of profiles table. This prevents RLS recursion and follows security best practices.';