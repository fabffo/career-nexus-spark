-- Create tables for the appointment system
CREATE TABLE IF NOT EXISTS public.candidats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  prenom VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telephone VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  raison_sociale VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telephone VARCHAR(50),
  adresse TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rdvs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidat_id UUID REFERENCES public.candidats(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  type_rdv VARCHAR(50) NOT NULL CHECK (type_rdv IN ('TEAMS', 'PRESENTIEL_CLIENT', 'TELEPHONIQUE')),
  statut VARCHAR(50) NOT NULL CHECK (statut IN ('PLANIFIE', 'CONFIRME', 'TERMINE', 'ANNULE')),
  lieu TEXT,
  notes TEXT,
  teams_link TEXT,
  teams_meeting_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rdvs_candidat_id ON public.rdvs(candidat_id);
CREATE INDEX IF NOT EXISTS idx_rdvs_client_id ON public.rdvs(client_id);
CREATE INDEX IF NOT EXISTS idx_rdvs_date ON public.rdvs(date);

-- Enable RLS
ALTER TABLE public.candidats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdvs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (for testing purposes)
-- In production, you should implement proper authentication
CREATE POLICY "Public can view candidats" ON public.candidats FOR SELECT USING (true);
CREATE POLICY "Public can insert candidats" ON public.candidats FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update candidats" ON public.candidats FOR UPDATE USING (true);
CREATE POLICY "Public can delete candidats" ON public.candidats FOR DELETE USING (true);

CREATE POLICY "Public can view clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Public can insert clients" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update clients" ON public.clients FOR UPDATE USING (true);
CREATE POLICY "Public can delete clients" ON public.clients FOR DELETE USING (true);

CREATE POLICY "Public can view rdvs" ON public.rdvs FOR SELECT USING (true);
CREATE POLICY "Public can insert rdvs" ON public.rdvs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update rdvs" ON public.rdvs FOR UPDATE USING (true);
CREATE POLICY "Public can delete rdvs" ON public.rdvs FOR DELETE USING (true);

-- Insert sample data for testing
INSERT INTO public.candidats (nom, prenom, email, telephone) VALUES
  ('Dupont', 'Jean', 'jean.dupont@example.com', '0612345678'),
  ('Martin', 'Marie', 'marie.martin@example.com', '0687654321'),
  ('Bernard', 'Pierre', 'pierre.bernard@example.com', '0698765432')
ON CONFLICT DO NOTHING;

INSERT INTO public.clients (raison_sociale, email, telephone, adresse) VALUES
  ('TechCorp', 'contact@techcorp.com', '0123456789', '123 Rue de la Tech, 75001 Paris'),
  ('DataSolutions', 'info@datasolutions.com', '0198765432', '456 Avenue des Données, 69001 Lyon'),
  ('WebAgency', 'hello@webagency.com', '0156789012', '789 Boulevard du Web, 13001 Marseille')
ON CONFLICT DO NOTHING;