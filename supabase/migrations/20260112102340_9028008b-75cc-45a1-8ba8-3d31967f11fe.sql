-- Ajouter les colonnes pour le partenaire dans abonnements_partenaires
ALTER TABLE public.abonnements_partenaires
ADD COLUMN partenaire_type TEXT,
ADD COLUMN partenaire_id UUID;

-- Ajouter un commentaire pour documenter les types de partenaires possibles
COMMENT ON COLUMN public.abonnements_partenaires.partenaire_type IS 'Type de partenaire: CLIENT, PRESTATAIRE, SALARIE, BANQUE, FOURNISSEUR_GENERAL, FOURNISSEUR_SERVICES, FOURNISSEUR_ETAT_ORGANISME';
COMMENT ON COLUMN public.abonnements_partenaires.partenaire_id IS 'ID de l entité partenaire selon le type';

-- Créer des index pour améliorer les performances
CREATE INDEX idx_abonnements_partenaires_type ON public.abonnements_partenaires(partenaire_type);
CREATE INDEX idx_abonnements_partenaires_id ON public.abonnements_partenaires(partenaire_id);