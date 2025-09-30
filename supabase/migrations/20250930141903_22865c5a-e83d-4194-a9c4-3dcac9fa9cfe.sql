-- Augmenter les limites de taille pour les champs de societe_interne
ALTER TABLE public.societe_interne 
  ALTER COLUMN siren TYPE character varying(14),
  ALTER COLUMN telephone TYPE character varying(20),
  ALTER COLUMN email TYPE character varying(255),
  ALTER COLUMN iban TYPE character varying(34),
  ALTER COLUMN bic TYPE character varying(11),
  ALTER COLUMN tva TYPE character varying(20);