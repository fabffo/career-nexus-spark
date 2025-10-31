-- Update validate_salarie_invitation_token to check expiration
CREATE OR REPLACE FUNCTION public.validate_salarie_invitation_token(p_token text, p_role salarie_role DEFAULT NULL::salarie_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
    SELECT id, nom, prenom, email, role, user_id, invitation_expires_at
    INTO v_salarie
    FROM public.salaries
    WHERE invitation_token = p_token
      AND role = p_role
    LIMIT 1;
  ELSE
    -- Otherwise just check token
    SELECT id, nom, prenom, email, role, user_id, invitation_expires_at
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

  -- Check if token has expired
  IF v_salarie.invitation_expires_at IS NOT NULL AND v_salarie.invitation_expires_at < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Le lien d''invitation a expiré. Veuillez demander un nouveau lien.');
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