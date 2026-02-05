-- Table pour les prévisions de factures de vente
CREATE TABLE public.previsions_ventes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  annee INTEGER NOT NULL,
  mois INTEGER NOT NULL CHECK (mois >= 1 AND mois <= 12),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_nom VARCHAR,
  activite VARCHAR,
  tjm NUMERIC DEFAULT 0,
  quantite NUMERIC DEFAULT 1,
  total_ht NUMERIC DEFAULT 0,
  taux_tva NUMERIC DEFAULT 20,
  total_tva NUMERIC DEFAULT 0,
  total_ttc NUMERIC DEFAULT 0,
  date_emission DATE,
  date_echeance DATE,
  notes TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID
);

-- Table pour les prévisions de factures d'achats de services
CREATE TABLE public.previsions_achats_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  annee INTEGER NOT NULL,
  mois INTEGER NOT NULL CHECK (mois >= 1 AND mois <= 12),
  fournisseur_id UUID REFERENCES public.fournisseurs_services(id) ON DELETE SET NULL,
  prestataire_id UUID REFERENCES public.prestataires(id) ON DELETE SET NULL,
  fournisseur_nom VARCHAR,
  activite VARCHAR,
  tjm NUMERIC DEFAULT 0,
  quantite NUMERIC DEFAULT 1,
  total_ht NUMERIC DEFAULT 0,
  taux_tva NUMERIC DEFAULT 20,
  total_tva NUMERIC DEFAULT 0,
  total_ttc NUMERIC DEFAULT 0,
  date_emission DATE,
  date_echeance DATE,
  notes TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID
);

-- Table pour les prévisions d'abonnements mensuels
CREATE TABLE public.previsions_abonnements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  annee INTEGER NOT NULL,
  mois INTEGER NOT NULL CHECK (mois >= 1 AND mois <= 12),
  nom VARCHAR NOT NULL,
  activite VARCHAR,
  montant_mensuel NUMERIC DEFAULT 0,
  taux_tva NUMERIC DEFAULT 20,
  total_tva NUMERIC DEFAULT 0,
  total_ttc NUMERIC DEFAULT 0,
  notes TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID
);

-- Table pour les prévisions de charges salariales
CREATE TABLE public.previsions_charges_salariales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  annee INTEGER NOT NULL,
  mois INTEGER NOT NULL CHECK (mois >= 1 AND mois <= 12),
  nom VARCHAR NOT NULL,
  type_charge VARCHAR NOT NULL,
  montant NUMERIC DEFAULT 0,
  notes TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID
);

-- Table pour les prévisions d'achats généraux
CREATE TABLE public.previsions_achats_generaux (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  annee INTEGER NOT NULL,
  mois INTEGER NOT NULL CHECK (mois >= 1 AND mois <= 12),
  fournisseur_id UUID REFERENCES public.fournisseurs_generaux(id) ON DELETE SET NULL,
  fournisseur_nom VARCHAR,
  activite VARCHAR,
  total_ht NUMERIC DEFAULT 0,
  taux_tva NUMERIC DEFAULT 20,
  total_tva NUMERIC DEFAULT 0,
  total_ttc NUMERIC DEFAULT 0,
  date_emission DATE,
  date_echeance DATE,
  notes TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID
);

-- Enable RLS on all tables
ALTER TABLE public.previsions_ventes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.previsions_achats_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.previsions_abonnements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.previsions_charges_salariales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.previsions_achats_generaux ENABLE ROW LEVEL SECURITY;

-- RLS Policies for previsions_ventes
CREATE POLICY "Authorized roles can view previsions_ventes" ON public.previsions_ventes
  FOR SELECT USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can manage previsions_ventes" ON public.previsions_ventes
  FOR ALL USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- RLS Policies for previsions_achats_services
CREATE POLICY "Authorized roles can view previsions_achats_services" ON public.previsions_achats_services
  FOR SELECT USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can manage previsions_achats_services" ON public.previsions_achats_services
  FOR ALL USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- RLS Policies for previsions_abonnements
CREATE POLICY "Authorized roles can view previsions_abonnements" ON public.previsions_abonnements
  FOR SELECT USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can manage previsions_abonnements" ON public.previsions_abonnements
  FOR ALL USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- RLS Policies for previsions_charges_salariales
CREATE POLICY "Authorized roles can view previsions_charges_salariales" ON public.previsions_charges_salariales
  FOR SELECT USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can manage previsions_charges_salariales" ON public.previsions_charges_salariales
  FOR ALL USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- RLS Policies for previsions_achats_generaux
CREATE POLICY "Authorized roles can view previsions_achats_generaux" ON public.previsions_achats_generaux
  FOR SELECT USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can manage previsions_achats_generaux" ON public.previsions_achats_generaux
  FOR ALL USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));