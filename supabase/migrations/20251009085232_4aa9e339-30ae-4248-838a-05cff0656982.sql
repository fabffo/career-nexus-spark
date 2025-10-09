-- Ajouter une colonne pour stocker les emails supplémentaires pour les invitations
ALTER TABLE public.rdvs 
ADD COLUMN additional_emails TEXT;