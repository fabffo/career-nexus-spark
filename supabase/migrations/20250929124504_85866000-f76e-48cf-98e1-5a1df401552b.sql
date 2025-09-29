-- Correction de la politique de mise à jour des salariés
-- Supprimer la politique existante qui pose problème
DROP POLICY IF EXISTS "Authorized users can update salaries" ON public.salaries;

-- Créer une nouvelle politique plus simple pour la mise à jour
CREATE POLICY "Admins can update salaries" 
ON public.salaries 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'::user_role
  )
);

-- Ajouter aussi une politique pour que les salariés puissent mettre à jour leur propre profil
CREATE POLICY "Salaries can update own profile" 
ON public.salaries 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());