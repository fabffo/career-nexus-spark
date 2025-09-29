-- Créer ou remplacer la fonction pour éviter la récursion
CREATE OR REPLACE FUNCTION public.user_has_role(user_id uuid, allowed_roles user_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = user_id
    AND profiles.role = ANY(allowed_roles)
  )
$$;

-- Supprimer les politiques problématiques sur profiles
DROP POLICY IF EXISTS "Admins and recruiters can view all profiles" ON public.profiles;

-- Recréer la politique en utilisant directement la fonction
CREATE POLICY "Admins and recruiters can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = id OR
  public.user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
);