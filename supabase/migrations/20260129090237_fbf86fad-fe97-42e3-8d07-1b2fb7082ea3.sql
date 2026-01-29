-- Table des types de sociétés
CREATE TABLE public.company_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  description TEXT,
  pros TEXT[] DEFAULT '{}',
  cons TEXT[] DEFAULT '{}',
  ir_possible BOOLEAN DEFAULT false,
  is_possible BOOLEAN DEFAULT false,
  tva_option VARCHAR(50) DEFAULT 'OUI', -- OUI, NON, OPTION
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table des cartes fiscales
CREATE TABLE public.tax_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  title VARCHAR(100) NOT NULL,
  subtitle TEXT,
  frequency VARCHAR(50) NOT NULL, -- ANNUEL, MENSUEL, TRIMESTRIEL, PONCTUEL
  organism VARCHAR(100),
  icon VARCHAR(50) DEFAULT 'file-text',
  color VARCHAR(20) DEFAULT '#3B82F6',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table des champs des cartes fiscales
CREATE TABLE public.tax_card_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tax_card_id uuid NOT NULL REFERENCES public.tax_cards(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  value TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table de mapping entre types de sociétés et cartes fiscales
CREATE TABLE public.company_type_tax_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_type_id uuid NOT NULL REFERENCES public.company_types(id) ON DELETE CASCADE,
  tax_card_id uuid NOT NULL REFERENCES public.tax_cards(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_type_id, tax_card_id)
);

-- Enable RLS
ALTER TABLE public.company_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_card_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_type_tax_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_types
CREATE POLICY "Everyone can view company_types" ON public.company_types
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage company_types" ON public.company_types
  FOR ALL USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));

-- RLS Policies for tax_cards
CREATE POLICY "Everyone can view tax_cards" ON public.tax_cards
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage tax_cards" ON public.tax_cards
  FOR ALL USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));

-- RLS Policies for tax_card_fields
CREATE POLICY "Everyone can view tax_card_fields" ON public.tax_card_fields
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage tax_card_fields" ON public.tax_card_fields
  FOR ALL USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));

-- RLS Policies for company_type_tax_cards
CREATE POLICY "Everyone can view company_type_tax_cards" ON public.company_type_tax_cards
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage company_type_tax_cards" ON public.company_type_tax_cards
  FOR ALL USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]))
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role]));