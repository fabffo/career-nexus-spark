-- Ajouter les colonnes délai de paiement et écart pour les clients (écart seulement car delai existe déjà)
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS ecart_paiement_jours integer DEFAULT 5;

-- Ajouter les colonnes pour les prestataires
ALTER TABLE public.prestataires 
ADD COLUMN IF NOT EXISTS delai_paiement_jours integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS ecart_paiement_jours integer DEFAULT 5;

-- Ajouter les colonnes pour les fournisseurs généraux
ALTER TABLE public.fournisseurs_generaux 
ADD COLUMN IF NOT EXISTS delai_paiement_jours integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS ecart_paiement_jours integer DEFAULT 5;

-- Ajouter les colonnes pour les fournisseurs de services
ALTER TABLE public.fournisseurs_services 
ADD COLUMN IF NOT EXISTS delai_paiement_jours integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS ecart_paiement_jours integer DEFAULT 5;

-- Ajouter les colonnes pour les fournisseurs état/organismes
ALTER TABLE public.fournisseurs_etat_organismes 
ADD COLUMN IF NOT EXISTS delai_paiement_jours integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS ecart_paiement_jours integer DEFAULT 5;