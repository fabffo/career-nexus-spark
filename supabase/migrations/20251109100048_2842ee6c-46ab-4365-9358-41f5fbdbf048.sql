-- Renommer la colonne zone_activite en activite
ALTER TABLE public.factures 
RENAME COLUMN zone_activite TO activite;