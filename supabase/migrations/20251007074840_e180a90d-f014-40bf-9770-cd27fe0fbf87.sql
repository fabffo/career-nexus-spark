-- Modifier la politique pour permettre aux rôles autorisés à créer des factures de lire la société interne
DROP POLICY IF EXISTS "Only admins can view societe_interne" ON public.societe_interne;

CREATE POLICY "Authorized roles can view societe_interne"
ON public.societe_interne
FOR SELECT
TO public
USING (
  user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
);