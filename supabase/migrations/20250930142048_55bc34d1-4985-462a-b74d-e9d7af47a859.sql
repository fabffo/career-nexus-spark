-- Augmenter encore les limites pour plus de flexibilité
ALTER TABLE public.societe_interne 
  ALTER COLUMN bic TYPE character varying(20),
  ALTER COLUMN tva TYPE character varying(30),
  ALTER COLUMN reference_bancaire TYPE text;