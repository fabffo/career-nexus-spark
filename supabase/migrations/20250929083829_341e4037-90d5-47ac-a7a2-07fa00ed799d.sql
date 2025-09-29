-- Corriger la fonction generate_invitation_token
CREATE OR REPLACE FUNCTION public.generate_invitation_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Utiliser md5 avec gen_random_uuid() pour générer un token aléatoire
  RETURN md5(gen_random_uuid()::text || now()::text);
END;
$$;