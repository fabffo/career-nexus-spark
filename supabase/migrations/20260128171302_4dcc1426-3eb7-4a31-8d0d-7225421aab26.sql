-- Ajouter une colonne pour lier un contrat fournisseur à un client (optionnel)
ALTER TABLE public.contrats 
ADD COLUMN IF NOT EXISTS client_lie_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Ajouter un commentaire pour clarifier l'usage
COMMENT ON COLUMN public.contrats.client_lie_id IS 'Client lié au contrat fournisseur (optionnel). Permet de faire la jointure avec un client pour les contrats prestataires et fournisseurs.';