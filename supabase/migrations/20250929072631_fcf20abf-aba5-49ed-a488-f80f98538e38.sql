-- Add role column to salaries table with enum type
CREATE TYPE salarie_role AS ENUM ('RECRUTEUR', 'PRESTATAIRE');

ALTER TABLE public.salaries 
ADD COLUMN role salarie_role DEFAULT 'RECRUTEUR';