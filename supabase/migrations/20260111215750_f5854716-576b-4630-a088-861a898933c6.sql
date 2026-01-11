-- Ajouter un champ mots_cles_rapprochement aux tables partenaires

-- Clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS mots_cles_rapprochement text;

-- Fournisseurs généraux
ALTER TABLE public.fournisseurs_generaux 
ADD COLUMN IF NOT EXISTS mots_cles_rapprochement text;

-- Fournisseurs services
ALTER TABLE public.fournisseurs_services 
ADD COLUMN IF NOT EXISTS mots_cles_rapprochement text;

-- Fournisseurs état/organismes
ALTER TABLE public.fournisseurs_etat_organismes 
ADD COLUMN IF NOT EXISTS mots_cles_rapprochement text;

-- Prestataires
ALTER TABLE public.prestataires 
ADD COLUMN IF NOT EXISTS mots_cles_rapprochement text;

-- Abonnements partenaires
ALTER TABLE public.abonnements_partenaires 
ADD COLUMN IF NOT EXISTS mots_cles_rapprochement text;

-- Déclarations charges sociales
ALTER TABLE public.declarations_charges_sociales 
ADD COLUMN IF NOT EXISTS mots_cles_rapprochement text;

-- Salariés
ALTER TABLE public.salaries 
ADD COLUMN IF NOT EXISTS mots_cles_rapprochement text;

-- Banques
ALTER TABLE public.banques 
ADD COLUMN IF NOT EXISTS mots_cles_rapprochement text;

-- Ajouter des commentaires pour la documentation
COMMENT ON COLUMN public.clients.mots_cles_rapprochement IS 'Mots-clés pour la recherche de rapprochement bancaire (syntaxe: espace=ET, virgule=OU)';
COMMENT ON COLUMN public.fournisseurs_generaux.mots_cles_rapprochement IS 'Mots-clés pour la recherche de rapprochement bancaire';
COMMENT ON COLUMN public.fournisseurs_services.mots_cles_rapprochement IS 'Mots-clés pour la recherche de rapprochement bancaire';
COMMENT ON COLUMN public.fournisseurs_etat_organismes.mots_cles_rapprochement IS 'Mots-clés pour la recherche de rapprochement bancaire';
COMMENT ON COLUMN public.prestataires.mots_cles_rapprochement IS 'Mots-clés pour la recherche de rapprochement bancaire';
COMMENT ON COLUMN public.abonnements_partenaires.mots_cles_rapprochement IS 'Mots-clés pour la recherche de rapprochement bancaire';
COMMENT ON COLUMN public.declarations_charges_sociales.mots_cles_rapprochement IS 'Mots-clés pour la recherche de rapprochement bancaire';
COMMENT ON COLUMN public.salaries.mots_cles_rapprochement IS 'Mots-clés pour la recherche de rapprochement bancaire';
COMMENT ON COLUMN public.banques.mots_cles_rapprochement IS 'Mots-clés pour la recherche de rapprochement bancaire';