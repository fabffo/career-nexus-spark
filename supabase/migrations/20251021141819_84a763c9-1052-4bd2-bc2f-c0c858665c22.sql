-- Créer la table fournisseurs_etat_organismes
CREATE TABLE public.fournisseurs_etat_organismes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  raison_sociale VARCHAR NOT NULL,
  secteur_activite TEXT,
  adresse TEXT,
  telephone VARCHAR,
  email VARCHAR,
  site_web TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Activer RLS
ALTER TABLE public.fournisseurs_etat_organismes ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour les rôles autorisés
CREATE POLICY "Authorized roles can manage fournisseurs_etat_organismes"
ON public.fournisseurs_etat_organismes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('ADMIN', 'CONTRAT')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('ADMIN', 'CONTRAT')
  )
);

CREATE POLICY "Authorized roles can view fournisseurs_etat_organismes"
ON public.fournisseurs_etat_organismes
FOR SELECT
USING (
  user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
);

-- Trigger pour updated_at
CREATE TRIGGER update_fournisseurs_etat_organismes_updated_at
BEFORE UPDATE ON public.fournisseurs_etat_organismes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Ajouter la colonne fournisseur_etat_organisme_id à la table contrats
ALTER TABLE public.contrats
ADD COLUMN IF NOT EXISTS fournisseur_etat_organisme_id UUID REFERENCES public.fournisseurs_etat_organismes(id);