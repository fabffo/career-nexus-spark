-- Créer le bucket de stockage pour les bulletins de salaire
INSERT INTO storage.buckets (id, name, public) 
VALUES ('bulletins-salaire', 'bulletins-salaire', false)
ON CONFLICT (id) DO NOTHING;

-- Créer la table des bulletins de salaire
CREATE TABLE IF NOT EXISTS public.bulletins_salaire (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salarie_id UUID REFERENCES public.salaries(id) ON DELETE CASCADE,
  fichier_url TEXT NOT NULL,
  nom_fichier TEXT NOT NULL,
  
  -- Données extraites
  periode_mois INTEGER NOT NULL,
  periode_annee INTEGER NOT NULL,
  salaire_brut NUMERIC(10, 2),
  charges_sociales_salariales NUMERIC(10, 2),
  charges_sociales_patronales NUMERIC(10, 2),
  impot_source NUMERIC(10, 2),
  net_a_payer NUMERIC(10, 2),
  
  -- Métadonnées
  statut VARCHAR(50) DEFAULT 'EN_ATTENTE', -- EN_ATTENTE, ANALYSE_EN_COURS, VALIDE, ERREUR
  donnees_brutes JSONB, -- Stocke toutes les données brutes extraites
  erreur_analyse TEXT,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(salarie_id, periode_mois, periode_annee)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_bulletins_salarie ON public.bulletins_salaire(salarie_id);
CREATE INDEX IF NOT EXISTS idx_bulletins_periode ON public.bulletins_salaire(periode_annee, periode_mois);
CREATE INDEX IF NOT EXISTS idx_bulletins_statut ON public.bulletins_salaire(statut);

-- RLS Policies
ALTER TABLE public.bulletins_salaire ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized roles can view bulletins_salaire"
  ON public.bulletins_salaire FOR SELECT
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can create bulletins_salaire"
  ON public.bulletins_salaire FOR INSERT
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can update bulletins_salaire"
  ON public.bulletins_salaire FOR UPDATE
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can delete bulletins_salaire"
  ON public.bulletins_salaire FOR DELETE
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Storage policies pour les bulletins
CREATE POLICY "Authorized roles can view bulletins files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bulletins-salaire' AND user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can upload bulletins files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bulletins-salaire' AND user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can delete bulletins files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'bulletins-salaire' AND user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION public.update_bulletins_salaire_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bulletins_salaire_updated_at
  BEFORE UPDATE ON public.bulletins_salaire
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bulletins_salaire_updated_at();