-- Ajouter la colonne zone_activite dans la table factures
ALTER TABLE public.factures 
ADD COLUMN zone_activite character varying DEFAULT 'Prestation';

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN public.factures.zone_activite IS 'Zone d''activité de la facture, basée sur les types de mission';