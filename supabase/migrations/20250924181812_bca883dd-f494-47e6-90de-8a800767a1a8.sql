-- Supprimer les contraintes de clé étrangère existantes
ALTER TABLE analyse_poste_candidat 
DROP CONSTRAINT IF EXISTS analyse_poste_candidat_candidat_id_fkey,
DROP CONSTRAINT IF EXISTS analyse_poste_candidat_poste_id_fkey;

-- Ajouter des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_analyse_poste_candidat_candidat_id ON analyse_poste_candidat(candidat_id);
CREATE INDEX IF NOT EXISTS idx_analyse_poste_candidat_poste_id ON analyse_poste_candidat(poste_id);
CREATE INDEX IF NOT EXISTS idx_analyse_poste_candidat_created_at ON analyse_poste_candidat(created_at DESC);