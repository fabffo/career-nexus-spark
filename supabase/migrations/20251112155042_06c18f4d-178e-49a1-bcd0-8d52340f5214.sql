-- Permettre aux RECRUTEUR de créer et modifier des CRA
DROP POLICY IF EXISTS "Authorized roles can manage CRA" ON public.cra;

CREATE POLICY "Authorized roles can manage CRA"
ON public.cra
FOR ALL
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]))
WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));