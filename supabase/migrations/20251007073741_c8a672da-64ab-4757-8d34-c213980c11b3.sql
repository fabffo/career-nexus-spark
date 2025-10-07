-- Corriger la fonction user_has_role pour éviter les problèmes de coercion
CREATE OR REPLACE FUNCTION public.user_has_role(user_id uuid, allowed_roles user_role[])
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_text text;
  allowed_roles_text text[];
BEGIN
  -- Récupérer le rôle de l'utilisateur en tant que texte
  SELECT profiles.role::text INTO user_role_text
  FROM public.profiles
  WHERE profiles.id = user_id;
  
  -- Convertir le tableau d'enums en tableau de texte
  SELECT ARRAY(SELECT unnest(allowed_roles)::text) INTO allowed_roles_text;
  
  -- Vérifier si le rôle de l'utilisateur est dans la liste des rôles autorisés
  RETURN user_role_text = ANY(allowed_roles_text);
END;
$$;