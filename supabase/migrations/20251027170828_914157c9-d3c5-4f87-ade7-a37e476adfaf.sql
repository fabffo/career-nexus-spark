-- Create rapprochements_factures junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.rapprochements_factures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rapprochement_id UUID NOT NULL REFERENCES public.rapprochements_bancaires(id) ON DELETE CASCADE,
  facture_id UUID NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(rapprochement_id, facture_id)
);

-- Create index for performance
CREATE INDEX idx_rapprochements_factures_rapprochement ON public.rapprochements_factures(rapprochement_id);
CREATE INDEX idx_rapprochements_factures_facture ON public.rapprochements_factures(facture_id);

-- Enable RLS
ALTER TABLE public.rapprochements_factures ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authorized roles can view rapprochements_factures"
  ON public.rapprochements_factures
  FOR SELECT
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can create rapprochements_factures"
  ON public.rapprochements_factures
  FOR INSERT
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can delete rapprochements_factures"
  ON public.rapprochements_factures
  FOR DELETE
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Note: facture_id column in rapprochements_bancaires is now deprecated but kept for backward compatibility