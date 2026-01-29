-- Table de liaison entre tax_cards et abonnements_partenaires
CREATE TABLE public.tax_card_abonnements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tax_card_id uuid NOT NULL REFERENCES public.tax_cards(id) ON DELETE CASCADE,
  abonnement_id uuid NOT NULL REFERENCES public.abonnements_partenaires(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  UNIQUE(tax_card_id, abonnement_id)
);

-- Enable RLS
ALTER TABLE public.tax_card_abonnements ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authorized roles can manage tax_card_abonnements"
ON public.tax_card_abonnements
FOR ALL
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]))
WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can view tax_card_abonnements"
ON public.tax_card_abonnements
FOR SELECT
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));