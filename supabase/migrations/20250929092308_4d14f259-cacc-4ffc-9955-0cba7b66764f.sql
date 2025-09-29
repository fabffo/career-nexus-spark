-- Fix security issue: Restrict public access to employee personal data in salaries table

-- First, drop the problematic public policy
DROP POLICY IF EXISTS "Public can check invitation tokens" ON public.salaries;

-- Create a security definer function to validate invitation tokens
-- This function will only return the minimal data needed for signup
CREATE OR REPLACE FUNCTION public.validate_salarie_invitation_token(p_token text, p_role salarie_role DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_salarie record;
  v_result jsonb;
BEGIN
  -- Validate that token is provided
  IF p_token IS NULL OR p_token = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Token invalide');
  END IF;

  -- Find the salarie with this token
  IF p_role IS NOT NULL THEN
    -- If role is specified, check both token and role
    SELECT id, nom, prenom, email, role, user_id
    INTO v_salarie
    FROM public.salaries
    WHERE invitation_token = p_token
      AND role = p_role
    LIMIT 1;
  ELSE
    -- Otherwise just check token
    SELECT id, nom, prenom, email, role, user_id
    INTO v_salarie
    FROM public.salaries
    WHERE invitation_token = p_token
    LIMIT 1;
  END IF;

  -- Check if salarie was found
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Token invalide ou expiré');
  END IF;

  -- Check if user already exists
  IF v_salarie.user_id IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Ce compte a déjà été activé');
  END IF;

  -- Return only the minimal data needed for signup
  v_result := jsonb_build_object(
    'valid', true,
    'id', v_salarie.id,
    'nom', v_salarie.nom,
    'prenom', v_salarie.prenom,
    'email', v_salarie.email,
    'role', v_salarie.role
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to anonymous users (for signup flow)
GRANT EXECUTE ON FUNCTION public.validate_salarie_invitation_token TO anon;

-- Now create more restrictive RLS policies for salaries table
-- Keep the existing policies but ensure no public access to data

-- Ensure the table has RLS enabled
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;

-- The existing policies should already handle authenticated access properly
-- Just make sure there's no public SELECT policy anymore