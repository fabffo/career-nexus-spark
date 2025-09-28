-- 1. Créer la table des prestataires
CREATE TABLE public.prestataires (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom VARCHAR NOT NULL,
  prenom VARCHAR NOT NULL,
  email VARCHAR UNIQUE,
  telephone VARCHAR,
  cv_url TEXT,
  recommandation_url TEXT,
  detail_cv TEXT,
  user_id UUID UNIQUE,
  invitation_token TEXT UNIQUE,
  invitation_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Créer la table des fournisseurs de services
CREATE TABLE public.fournisseurs_services (
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

-- 3. Créer la table des fournisseurs généraux
CREATE TABLE public.fournisseurs_generaux (
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

-- 4. Créer les enums pour les contrats
CREATE TYPE contrat_type AS ENUM ('CLIENT', 'PRESTATAIRE', 'FOURNISSEUR_SERVICES', 'FOURNISSEUR_GENERAL');
CREATE TYPE contrat_statut AS ENUM ('BROUILLON', 'ACTIF', 'TERMINE', 'ANNULE', 'ARCHIVE');

-- 5. Créer la table des contrats
CREATE TABLE public.contrats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_contrat VARCHAR NOT NULL UNIQUE,
  type contrat_type NOT NULL,
  statut contrat_statut NOT NULL DEFAULT 'BROUILLON',
  date_debut DATE NOT NULL,
  date_fin DATE,
  version VARCHAR NOT NULL DEFAULT '1.0',
  parent_id UUID REFERENCES public.contrats(id),
  client_id UUID REFERENCES public.clients(id),
  prestataire_id UUID REFERENCES public.prestataires(id),
  fournisseur_services_id UUID REFERENCES public.fournisseurs_services(id),
  fournisseur_general_id UUID REFERENCES public.fournisseurs_generaux(id),
  montant NUMERIC(10,2),
  description TEXT,
  piece_jointe_url TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Activer RLS
ALTER TABLE public.prestataires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fournisseurs_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fournisseurs_generaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrats ENABLE ROW LEVEL SECURITY;

-- 7. Politiques RLS pour prestataires
CREATE POLICY "Authenticated users can view prestataires" 
ON public.prestataires FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert prestataires" 
ON public.prestataires FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update prestataires" 
ON public.prestataires FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete prestataires" 
ON public.prestataires FOR DELETE 
USING (true);

-- 8. Politiques RLS pour fournisseurs_services
CREATE POLICY "Authenticated users can view fournisseurs_services" 
ON public.fournisseurs_services FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert fournisseurs_services" 
ON public.fournisseurs_services FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update fournisseurs_services" 
ON public.fournisseurs_services FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete fournisseurs_services" 
ON public.fournisseurs_services FOR DELETE 
USING (true);

-- 9. Politiques RLS pour fournisseurs_generaux
CREATE POLICY "Authenticated users can view fournisseurs_generaux" 
ON public.fournisseurs_generaux FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert fournisseurs_generaux" 
ON public.fournisseurs_generaux FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update fournisseurs_generaux" 
ON public.fournisseurs_generaux FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete fournisseurs_generaux" 
ON public.fournisseurs_generaux FOR DELETE 
USING (true);

-- 10. Politiques RLS pour contrats (accès limité aux rôles CONTRAT et ADMIN)
CREATE POLICY "Users with CONTRAT or ADMIN role can view contrats" 
ON public.contrats FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'CONTRAT' OR profiles.role = 'ADMIN')
  )
);

CREATE POLICY "Users with CONTRAT or ADMIN role can insert contrats" 
ON public.contrats FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'CONTRAT' OR profiles.role = 'ADMIN')
  )
);

CREATE POLICY "Users with CONTRAT or ADMIN role can update contrats" 
ON public.contrats FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'CONTRAT' OR profiles.role = 'ADMIN')
  )
);

CREATE POLICY "Users with CONTRAT or ADMIN role can delete contrats" 
ON public.contrats FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'CONTRAT' OR profiles.role = 'ADMIN')
  )
);

-- 11. Créer les triggers pour updated_at
CREATE TRIGGER update_prestataires_updated_at
BEFORE UPDATE ON public.prestataires
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fournisseurs_services_updated_at
BEFORE UPDATE ON public.fournisseurs_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fournisseurs_generaux_updated_at
BEFORE UPDATE ON public.fournisseurs_generaux
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contrats_updated_at
BEFORE UPDATE ON public.contrats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 12. Créer des index pour les performances
CREATE INDEX idx_contrats_type ON public.contrats(type);
CREATE INDEX idx_contrats_statut ON public.contrats(statut);
CREATE INDEX idx_contrats_client_id ON public.contrats(client_id);
CREATE INDEX idx_contrats_prestataire_id ON public.contrats(prestataire_id);
CREATE INDEX idx_prestataires_email ON public.prestataires(email);
CREATE INDEX idx_prestataires_user_id ON public.prestataires(user_id);