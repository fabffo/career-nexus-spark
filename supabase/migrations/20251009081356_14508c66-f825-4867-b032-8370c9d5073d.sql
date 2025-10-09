-- Ajouter une policy pour permettre aux candidats non connectés de voir leurs propres données via le token d'invitation
CREATE POLICY "Public can view candidat with valid invitation token"
ON public.candidats
FOR SELECT
TO public
USING (
  invitation_token IS NOT NULL 
  AND user_id IS NULL
);