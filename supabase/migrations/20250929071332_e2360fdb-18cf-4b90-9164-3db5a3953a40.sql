-- Add metier and fonction columns to salaries table
ALTER TABLE public.salaries 
ADD COLUMN metier VARCHAR,
ADD COLUMN fonction VARCHAR;