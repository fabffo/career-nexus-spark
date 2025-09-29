-- Mettre à jour les politiques RLS pour les contrats afin d'inclure les RECRUTEUR
-- Les recruteurs doivent pouvoir au moins voir les contrats

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Users with CONTRAT or ADMIN role can view contrats" ON public.contrats;
DROP POLICY IF EXISTS "Users with CONTRAT or ADMIN role can insert contrats" ON public.contrats;
DROP POLICY IF EXISTS "Users with CONTRAT or ADMIN role can update contrats" ON public.contrats;
DROP POLICY IF EXISTS "Users with CONTRAT or ADMIN role can delete contrats" ON public.contrats;

-- Créer de nouvelles politiques incluant RECRUTEUR
-- RECRUTEUR peut voir les contrats
CREATE POLICY "Authorized roles can view contrats"
ON public.contrats
FOR SELECT
USING (
  public.user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
);

-- Seuls CONTRAT et ADMIN peuvent créer des contrats
CREATE POLICY "CONTRAT and ADMIN can create contrats"
ON public.contrats
FOR INSERT
WITH CHECK (
  public.user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role])
);

-- Seuls CONTRAT et ADMIN peuvent modifier des contrats
CREATE POLICY "CONTRAT and ADMIN can update contrats"
ON public.contrats
FOR UPDATE
USING (
  public.user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role])
);

-- Seuls CONTRAT et ADMIN peuvent supprimer des contrats
CREATE POLICY "CONTRAT and ADMIN can delete contrats"
ON public.contrats
FOR DELETE
USING (
  public.user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role])
);

-- Corriger aussi les politiques pour fournisseurs_generaux et fournisseurs_services
DROP POLICY IF EXISTS "Authorized roles can view fournisseurs_generaux" ON public.fournisseurs_generaux;
CREATE POLICY "Authorized roles can view fournisseurs_generaux"
ON public.fournisseurs_generaux
FOR SELECT
USING (
  public.user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
);

DROP POLICY IF EXISTS "Authorized roles can view fournisseurs_services" ON public.fournisseurs_services;
CREATE POLICY "Authorized roles can view fournisseurs_services"
ON public.fournisseurs_services
FOR SELECT
USING (
  public.user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
);