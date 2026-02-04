-- Add activite column to fournisseurs_generaux table
ALTER TABLE public.fournisseurs_generaux
ADD COLUMN activite VARCHAR REFERENCES public.param_activite(code) ON UPDATE CASCADE;