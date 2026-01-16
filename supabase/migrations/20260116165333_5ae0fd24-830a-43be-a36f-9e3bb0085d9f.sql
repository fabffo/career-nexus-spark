-- Ajouter la colonne montant_facture à lignes_rapprochement
ALTER TABLE public.lignes_rapprochement 
ADD COLUMN IF NOT EXISTS montant_facture numeric DEFAULT NULL;