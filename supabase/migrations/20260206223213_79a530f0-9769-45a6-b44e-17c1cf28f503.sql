
-- Table des devis (entête) - même structure que factures
CREATE TABLE public.devis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_devis TEXT NOT NULL UNIQUE,
  date_emission TEXT NOT NULL DEFAULT CURRENT_DATE::TEXT,
  date_echeance TEXT NOT NULL,
  date_validite TEXT,
  emetteur_type TEXT NOT NULL,
  emetteur_id TEXT,
  emetteur_nom TEXT NOT NULL,
  emetteur_adresse TEXT,
  emetteur_telephone TEXT,
  emetteur_email TEXT,
  destinataire_type TEXT NOT NULL,
  destinataire_id TEXT,
  destinataire_nom TEXT NOT NULL,
  destinataire_adresse TEXT,
  destinataire_telephone TEXT,
  destinataire_email TEXT,
  total_ht NUMERIC DEFAULT 0,
  total_tva NUMERIC DEFAULT 0,
  total_ttc NUMERIC DEFAULT 0,
  informations_paiement TEXT,
  reference_societe TEXT,
  statut TEXT NOT NULL DEFAULT 'ENCOURS',
  activite TEXT,
  facture_id UUID REFERENCES public.factures(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Table des lignes de devis - même structure que facture_lignes
CREATE TABLE public.devis_lignes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  devis_id UUID NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  ordre INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL,
  quantite NUMERIC NOT NULL DEFAULT 1,
  prix_unitaire_ht NUMERIC NOT NULL,
  prix_ht NUMERIC NOT NULL,
  taux_tva NUMERIC NOT NULL DEFAULT 20,
  montant_tva NUMERIC DEFAULT 0,
  prix_ttc NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devis_lignes ENABLE ROW LEVEL SECURITY;

-- RLS policies for devis
CREATE POLICY "Authenticated users can view devis" ON public.devis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert devis" ON public.devis FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update devis" ON public.devis FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete devis" ON public.devis FOR DELETE TO authenticated USING (true);

-- RLS policies for devis_lignes
CREATE POLICY "Authenticated users can view devis_lignes" ON public.devis_lignes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert devis_lignes" ON public.devis_lignes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update devis_lignes" ON public.devis_lignes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete devis_lignes" ON public.devis_lignes FOR DELETE TO authenticated USING (true);

-- Trigger to update totaux on devis when lignes change
CREATE OR REPLACE FUNCTION public.update_devis_totaux()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.devis
  SET 
    total_ht = (SELECT COALESCE(SUM(prix_ht), 0) FROM public.devis_lignes WHERE devis_id = COALESCE(NEW.devis_id, OLD.devis_id)),
    total_tva = (SELECT COALESCE(SUM(montant_tva), 0) FROM public.devis_lignes WHERE devis_id = COALESCE(NEW.devis_id, OLD.devis_id)),
    total_ttc = (SELECT COALESCE(SUM(prix_ttc), 0) FROM public.devis_lignes WHERE devis_id = COALESCE(NEW.devis_id, OLD.devis_id)),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.devis_id, OLD.devis_id);
  RETURN NEW;
END;
$function$;

CREATE TRIGGER update_devis_totaux_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.devis_lignes
FOR EACH ROW EXECUTE FUNCTION public.update_devis_totaux();

-- Trigger to calculate prix_ttc on devis_lignes
CREATE TRIGGER calculate_devis_ligne_prix_ttc
BEFORE INSERT OR UPDATE ON public.devis_lignes
FOR EACH ROW EXECUTE FUNCTION public.calculate_prix_ttc();

-- Trigger to update updated_at
CREATE TRIGGER update_devis_updated_at
BEFORE UPDATE ON public.devis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequence for devis numbers
CREATE TABLE IF NOT EXISTS public.devis_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.devis_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage devis_sequences" ON public.devis_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Function to generate devis number
CREATE OR REPLACE FUNCTION public.get_next_devis_numero()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_year INTEGER;
  v_next INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  INSERT INTO public.devis_sequences (year, last_number)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = devis_sequences.last_number + 1,
      updated_at = NOW()
  RETURNING last_number INTO v_next;
  
  RETURN 'DEV-' || v_year || '-' || LPAD(v_next::TEXT, 5, '0');
END;
$function$;
