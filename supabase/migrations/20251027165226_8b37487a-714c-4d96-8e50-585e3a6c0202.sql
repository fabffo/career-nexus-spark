-- Ajouter la colonne declaration_charge_id à rapprochements_bancaires
ALTER TABLE rapprochements_bancaires
ADD COLUMN declaration_charge_id UUID REFERENCES declarations_charges_sociales(id) ON DELETE SET NULL;

-- Créer un index pour améliorer les performances
CREATE INDEX idx_rapprochements_bancaires_declaration_charge 
ON rapprochements_bancaires(declaration_charge_id);

-- Créer la table paiements_declarations_charges
CREATE TABLE paiements_declarations_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_charge_id UUID NOT NULL REFERENCES declarations_charges_sociales(id) ON DELETE CASCADE,
  rapprochement_id UUID REFERENCES rapprochements_bancaires(id) ON DELETE SET NULL,
  date_paiement DATE NOT NULL,
  montant NUMERIC NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activer RLS sur paiements_declarations_charges
ALTER TABLE paiements_declarations_charges ENABLE ROW LEVEL SECURITY;

-- Créer les politiques RLS pour paiements_declarations_charges
CREATE POLICY "Authorized roles can view paiements_declarations_charges"
ON paiements_declarations_charges
FOR SELECT
TO authenticated
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can create paiements_declarations_charges"
ON paiements_declarations_charges
FOR INSERT
TO authenticated
WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can update paiements_declarations_charges"
ON paiements_declarations_charges
FOR UPDATE
TO authenticated
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can delete paiements_declarations_charges"
ON paiements_declarations_charges
FOR DELETE
TO authenticated
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Créer un trigger pour mettre à jour updated_at
CREATE TRIGGER update_paiements_declarations_charges_updated_at
BEFORE UPDATE ON paiements_declarations_charges
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Créer des index pour améliorer les performances
CREATE INDEX idx_paiements_declarations_charges_declaration ON paiements_declarations_charges(declaration_charge_id);
CREATE INDEX idx_paiements_declarations_charges_rapprochement ON paiements_declarations_charges(rapprochement_id);
CREATE INDEX idx_paiements_declarations_charges_date ON paiements_declarations_charges(date_paiement);