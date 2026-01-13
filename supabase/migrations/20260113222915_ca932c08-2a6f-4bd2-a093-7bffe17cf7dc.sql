-- Augmenter la taille de la colonne type_facture pour supporter les nouveaux types
ALTER TABLE factures ALTER COLUMN type_facture TYPE VARCHAR(50);

-- Mettre à jour les factures existantes de type ACHATS selon le type de fournisseur
-- Pour les fournisseurs de services
UPDATE factures f
SET type_facture = 'ACHATS_SERVICES'
WHERE f.type_facture = 'ACHATS'
  AND f.emetteur_type = 'fournisseur'
  AND EXISTS (
    SELECT 1 FROM fournisseurs_services fs 
    WHERE fs.id = f.emetteur_id
  );

-- Pour les fournisseurs généraux
UPDATE factures f
SET type_facture = 'ACHATS_GENERAUX'
WHERE f.type_facture = 'ACHATS'
  AND f.emetteur_type = 'fournisseur'
  AND EXISTS (
    SELECT 1 FROM fournisseurs_generaux fg 
    WHERE fg.id = f.emetteur_id
  );

-- Pour les fournisseurs État/Organismes
UPDATE factures f
SET type_facture = 'ACHATS_ETAT'
WHERE f.type_facture = 'ACHATS'
  AND f.emetteur_type = 'fournisseur'
  AND EXISTS (
    SELECT 1 FROM fournisseurs_etat_organismes feo 
    WHERE feo.id = f.emetteur_id
  );

-- Ajouter un commentaire sur la colonne pour documenter les valeurs possibles
COMMENT ON COLUMN factures.type_facture IS 'Types possibles: VENTES, ACHATS_SERVICES, ACHATS_GENERAUX, ACHATS_ETAT, ACHATS (legacy)';