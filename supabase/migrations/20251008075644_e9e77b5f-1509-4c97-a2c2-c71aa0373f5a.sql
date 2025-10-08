-- Modifier la politique d'insertion pour permettre aux RECRUTEUR de créer des factures d'achats
DROP POLICY IF EXISTS "Authorized roles can create factures" ON public.factures;

CREATE POLICY "Authorized roles can create factures"
ON public.factures
FOR INSERT
TO public
WITH CHECK (
  user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
);