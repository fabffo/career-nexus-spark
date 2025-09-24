-- Add pourvu_par column to postes table
ALTER TABLE public.postes 
ADD COLUMN pourvu_par text;

-- Add a comment to describe the column
COMMENT ON COLUMN public.postes.pourvu_par IS 'Nom et prénom du candidat qui a pourvu le poste ou "Candidat externe"';