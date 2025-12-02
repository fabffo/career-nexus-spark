-- Activer RLS sur facture_lignes si pas déjà fait
ALTER TABLE facture_lignes ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Authorized roles can view facture_lignes" ON facture_lignes;
DROP POLICY IF EXISTS "Authorized roles can create facture_lignes" ON facture_lignes;
DROP POLICY IF EXISTS "Authorized roles can update facture_lignes" ON facture_lignes;
DROP POLICY IF EXISTS "Authorized roles can delete facture_lignes" ON facture_lignes;

-- Créer les nouvelles politiques RLS pour facture_lignes
CREATE POLICY "Authorized roles can view facture_lignes"
ON facture_lignes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('ADMIN', 'CONTRAT', 'RECRUTEUR')
  )
);

CREATE POLICY "Authorized roles can create facture_lignes"
ON facture_lignes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('ADMIN', 'CONTRAT')
  )
);

CREATE POLICY "Authorized roles can update facture_lignes"
ON facture_lignes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('ADMIN', 'CONTRAT')
  )
);

CREATE POLICY "Authorized roles can delete facture_lignes"
ON facture_lignes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('ADMIN', 'CONTRAT')
  )
);