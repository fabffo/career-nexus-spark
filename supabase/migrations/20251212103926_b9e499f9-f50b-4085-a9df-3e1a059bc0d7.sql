-- Supprimer la policy ALL qui cause le conflit
DROP POLICY IF EXISTS "Authorized roles can manage facture_lignes" ON public.facture_lignes;

-- Supprimer et recréer les policies avec user_has_role
DROP POLICY IF EXISTS "Authorized roles can create facture_lignes" ON public.facture_lignes;
DROP POLICY IF EXISTS "Authorized roles can update facture_lignes" ON public.facture_lignes;
DROP POLICY IF EXISTS "Authorized roles can delete facture_lignes" ON public.facture_lignes;
DROP POLICY IF EXISTS "Authorized roles can view facture_lignes" ON public.facture_lignes;

-- Recréer les policies avec user_has_role
CREATE POLICY "Authorized roles can create facture_lignes" 
ON public.facture_lignes 
FOR INSERT 
WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can update facture_lignes" 
ON public.facture_lignes 
FOR UPDATE 
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can delete facture_lignes" 
ON public.facture_lignes 
FOR DELETE 
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can view facture_lignes" 
ON public.facture_lignes 
FOR SELECT 
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));