-- Add HT, TVA, TTC columns to lignes_rapprochement table
ALTER TABLE public.lignes_rapprochement
ADD COLUMN IF NOT EXISTS total_ht numeric,
ADD COLUMN IF NOT EXISTS total_tva numeric,
ADD COLUMN IF NOT EXISTS total_ttc numeric;