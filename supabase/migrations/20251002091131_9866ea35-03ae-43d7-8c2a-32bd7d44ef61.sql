-- Ajouter le type de prestataire et le lien vers fournisseur de services
ALTER TABLE prestataires 
  ADD COLUMN type_prestataire VARCHAR(20) DEFAULT 'INDEPENDANT' CHECK (type_prestataire IN ('INDEPENDANT', 'SOCIETE')),
  ADD COLUMN fournisseur_services_id UUID REFERENCES fournisseurs_services(id) ON DELETE SET NULL;

-- Créer un index pour améliorer les performances
CREATE INDEX idx_prestataires_fournisseur_services ON prestataires(fournisseur_services_id);

-- Commentaires pour documentation
COMMENT ON COLUMN prestataires.type_prestataire IS 'Type de prestataire: INDEPENDANT ou SOCIETE';
COMMENT ON COLUMN prestataires.fournisseur_services_id IS 'Référence vers le fournisseur de services si type_prestataire = SOCIETE';