-- Table pour stocker les rapprochements manuels
CREATE TABLE IF NOT EXISTS public.rapprochements_bancaires (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_date DATE NOT NULL,
  transaction_libelle TEXT NOT NULL,
  transaction_debit NUMERIC DEFAULT 0,
  transaction_credit NUMERIC DEFAULT 0,
  transaction_montant NUMERIC NOT NULL,
  facture_id UUID REFERENCES public.factures(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour améliorer les performances
CREATE INDEX idx_rapprochements_bancaires_date ON public.rapprochements_bancaires(transaction_date);
CREATE INDEX idx_rapprochements_bancaires_facture ON public.rapprochements_bancaires(facture_id);

-- Enable RLS
ALTER TABLE public.rapprochements_bancaires ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authorized roles can view rapprochements_bancaires"
  ON public.rapprochements_bancaires
  FOR SELECT
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can create rapprochements_bancaires"
  ON public.rapprochements_bancaires
  FOR INSERT
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can update rapprochements_bancaires"
  ON public.rapprochements_bancaires
  FOR UPDATE
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can delete rapprochements_bancaires"
  ON public.rapprochements_bancaires
  FOR DELETE
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Trigger pour updated_at
CREATE TRIGGER update_rapprochements_bancaires_updated_at
  BEFORE UPDATE ON public.rapprochements_bancaires
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();