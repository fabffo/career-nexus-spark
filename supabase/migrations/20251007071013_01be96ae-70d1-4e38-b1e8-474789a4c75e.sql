-- Permettre aux RECRUTEURS et CONTRAT de supprimer les factures d'achat
DROP POLICY IF EXISTS "Only admins can delete factures" ON public.factures;

CREATE POLICY "Authorized roles can delete factures"
ON public.factures
FOR DELETE
USING (
  user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
);