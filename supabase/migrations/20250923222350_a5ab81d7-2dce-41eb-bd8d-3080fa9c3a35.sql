-- Supprimer l'ancienne contrainte si elle existe
ALTER TABLE public.rdvs DROP CONSTRAINT IF EXISTS rdvs_statut_check;

-- Créer un type enum pour le statut des RDV
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rdv_statut') THEN
        CREATE TYPE public.rdv_statut AS ENUM ('ENCOURS', 'REALISE', 'TERMINE', 'ANNULE');
    END IF;
END $$;

-- Modifier la colonne statut pour utiliser le type enum
ALTER TABLE public.rdvs 
ALTER COLUMN statut TYPE rdv_statut 
USING statut::rdv_statut;