-- Corriger les politiques RLS pour la table profiles
-- D'abord supprimer toutes les politiques existantes sur profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins recruiters can view all profiles" ON public.profiles;

-- Créer des nouvelles politiques plus simples et fonctionnelles
-- Politique pour que chaque utilisateur puisse voir son propre profil
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Politique pour que les admins et recruteurs puissent voir tous les profils
CREATE POLICY "Admins and recruiters can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
    AND p.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);

-- Politique pour l'insertion de profil (lors de l'inscription)
CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Politique pour la mise à jour du profil
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Politique pour la suppression (optionnel)
CREATE POLICY "Users can delete own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = id);