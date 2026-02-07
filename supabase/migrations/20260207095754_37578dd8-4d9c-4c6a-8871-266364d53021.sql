
-- Convert reference_client from text to jsonb
-- Format: [{"reference": "BDC PO150827 B SIRA Accompagnement RH", "montant": 720}, ...]

-- First convert existing text values to jsonb array format
ALTER TABLE public.contrats 
ALTER COLUMN reference_client TYPE jsonb 
USING CASE 
  WHEN reference_client IS NULL THEN NULL
  WHEN reference_client = '' THEN NULL
  ELSE jsonb_build_array(jsonb_build_object('reference', reference_client, 'montant', COALESCE(montant, 0)))
END;
