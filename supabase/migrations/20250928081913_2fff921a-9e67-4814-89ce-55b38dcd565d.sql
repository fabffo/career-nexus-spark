-- Première migration : Ajouter les nouvelles valeurs aux enums
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CONTRAT';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'PRESTATAIRE';