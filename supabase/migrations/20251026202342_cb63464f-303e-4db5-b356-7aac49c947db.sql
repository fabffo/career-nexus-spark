-- Créer la table pour les charges des salariés
CREATE TABLE IF NOT EXISTS public.charges_salaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salarie_id UUID NOT NULL REFERENCES public.salaries(id) ON DELETE CASCADE,
  rapprochement_id UUID REFERENCES public.fichiers_rapprochement(id) ON DELETE SET NULL,
  date_paiement DATE NOT NULL,
  montant NUMERIC NOT NULL,
  type_charge VARCHAR NOT NULL, -- 'SALAIRE', 'COTISATIONS', 'CHARGES_PATRONALES', 'AUTRES'
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Activer RLS
ALTER TABLE public.charges_salaries ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour charges_salaries
CREATE POLICY "Authorized roles can view charges_salaries"
  ON public.charges_salaries FOR SELECT
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can create charges_salaries"
  ON public.charges_salaries FOR INSERT
  WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can update charges_salaries"
  ON public.charges_salaries FOR UPDATE
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can delete charges_salaries"
  ON public.charges_salaries FOR DELETE
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Trigger pour updated_at
CREATE TRIGGER update_charges_salaries_updated_at
  BEFORE UPDATE ON public.charges_salaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index pour améliorer les performances
CREATE INDEX idx_charges_salaries_salarie_id ON public.charges_salaries(salarie_id);
CREATE INDEX idx_charges_salaries_date_paiement ON public.charges_salaries(date_paiement);
CREATE INDEX idx_charges_salaries_rapprochement_id ON public.charges_salaries(rapprochement_id);