-- Supprimer l'ancienne contrainte CHECK qui limite les valeurs de type_facture
ALTER TABLE public.factures DROP CONSTRAINT IF EXISTS factures_type_facture_check;

-- Créer une nouvelle contrainte CHECK avec toutes les valeurs possibles
ALTER TABLE public.factures ADD CONSTRAINT factures_type_facture_check 
  CHECK (type_facture IN ('VENTES', 'ACHATS', 'ACHATS_SERVICES', 'ACHATS_GENERAUX', 'ACHATS_ETAT'));