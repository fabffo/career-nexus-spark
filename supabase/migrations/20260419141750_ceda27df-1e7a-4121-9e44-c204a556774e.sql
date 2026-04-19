-- Rendre les colonnes fichier optionnelles pour permettre les marqueurs d'exemption sans fichier
ALTER TABLE public.paiements_abonnements_justificatifs
  ALTER COLUMN document_url DROP NOT NULL,
  ALTER COLUMN nom_fichier DROP NOT NULL;

-- Mettre à jour la contrainte de portée pour accepter EXEMPTE
ALTER TABLE public.paiements_abonnements_justificatifs
  DROP CONSTRAINT IF EXISTS paiements_abonnements_justificatifs_portee_check;

ALTER TABLE public.paiements_abonnements_justificatifs
  ADD CONSTRAINT paiements_abonnements_justificatifs_portee_check
  CHECK (portee IN ('GLOBAL', 'ANNUEL', 'MENSUEL', 'EXEMPTE'));