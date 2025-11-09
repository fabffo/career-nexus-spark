-- Ajouter les colonnes pour rattacher les factures d'achat de type "frais de mission" aux salariés ou fournisseurs
ALTER TABLE public.factures 
ADD COLUMN IF NOT EXISTS type_frais VARCHAR,
ADD COLUMN IF NOT EXISTS salarie_id UUID REFERENCES public.salaries(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS fournisseur_id UUID REFERENCES public.fournisseurs_services(id) ON DELETE SET NULL;