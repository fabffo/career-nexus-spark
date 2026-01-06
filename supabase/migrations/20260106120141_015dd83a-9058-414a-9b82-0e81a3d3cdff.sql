-- Ajouter la colonne type à abonnements_partenaires
ALTER TABLE public.abonnements_partenaires 
ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'CHARGE' NOT NULL;

-- Ajouter une contrainte check pour les valeurs autorisées
ALTER TABLE public.abonnements_partenaires 
ADD CONSTRAINT abonnements_partenaires_type_check 
CHECK (type IN ('CHARGE', 'AUTRE'));