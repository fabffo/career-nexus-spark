-- Ajouter une colonne pour le délai de paiement par défaut des clients (en jours)
ALTER TABLE public.clients 
ADD COLUMN delai_paiement_jours integer DEFAULT 30;