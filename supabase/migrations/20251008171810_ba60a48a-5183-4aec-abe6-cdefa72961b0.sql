-- Permettre aux candidats de voir les postes liés à leurs rendez-vous
CREATE POLICY "Candidats can view postes for their rdvs"
ON public.postes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM rdvs
    INNER JOIN candidats ON rdvs.candidat_id = candidats.id
    WHERE rdvs.poste_id = postes.id
    AND candidats.user_id = auth.uid()
  )
);