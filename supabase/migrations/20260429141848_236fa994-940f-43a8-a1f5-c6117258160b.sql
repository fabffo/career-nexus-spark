-- Table pour gérer les paiements d'une facture sur plusieurs écritures bancaires
CREATE TABLE public.paiements_factures_multi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facture_id UUID NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  ligne_rapprochement_id UUID NOT NULL REFERENCES public.rapprochements_bancaires(id) ON DELETE CASCADE,
  montant_alloue NUMERIC(15, 2) NOT NULL CHECK (montant_alloue > 0),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (facture_id, ligne_rapprochement_id)
);

-- Index pour accélérer les requêtes
CREATE INDEX idx_paiements_factures_multi_facture ON public.paiements_factures_multi(facture_id);
CREATE INDEX idx_paiements_factures_multi_ligne ON public.paiements_factures_multi(ligne_rapprochement_id);

-- Activer RLS
ALTER TABLE public.paiements_factures_multi ENABLE ROW LEVEL SECURITY;

-- Politiques RLS
CREATE POLICY "Authenticated users can view paiements multi"
ON public.paiements_factures_multi
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin/Recruteur/Contrat can insert paiements multi"
ON public.paiements_factures_multi
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role::text IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);

CREATE POLICY "Admin/Recruteur/Contrat can update paiements multi"
ON public.paiements_factures_multi
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role::text IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);

CREATE POLICY "Admin/Recruteur/Contrat can delete paiements multi"
ON public.paiements_factures_multi
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role::text IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);

-- Trigger pour updated_at
CREATE TRIGGER update_paiements_factures_multi_updated_at
BEFORE UPDATE ON public.paiements_factures_multi
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();