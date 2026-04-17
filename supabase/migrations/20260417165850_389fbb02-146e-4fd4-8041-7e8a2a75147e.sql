-- Table des justificatifs de paiements d'abonnements
CREATE TABLE public.paiements_abonnements_justificatifs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  abonnement_id UUID NOT NULL REFERENCES public.abonnements_partenaires(id) ON DELETE CASCADE,
  portee TEXT NOT NULL CHECK (portee IN ('GLOBAL', 'ANNUEL', 'MENSUEL')),
  annee INTEGER,
  ligne_rapprochement_id UUID REFERENCES public.lignes_rapprochement(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  nom_fichier TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT chk_annuel_has_annee CHECK (
    (portee = 'ANNUEL' AND annee IS NOT NULL) OR (portee <> 'ANNUEL')
  ),
  CONSTRAINT chk_mensuel_has_ligne CHECK (
    (portee = 'MENSUEL' AND ligne_rapprochement_id IS NOT NULL) OR (portee <> 'MENSUEL')
  )
);

CREATE INDEX idx_paj_abonnement ON public.paiements_abonnements_justificatifs(abonnement_id);
CREATE INDEX idx_paj_ligne ON public.paiements_abonnements_justificatifs(ligne_rapprochement_id);
CREATE INDEX idx_paj_portee_annee ON public.paiements_abonnements_justificatifs(abonnement_id, portee, annee);

ALTER TABLE public.paiements_abonnements_justificatifs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view" ON public.paiements_abonnements_justificatifs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert" ON public.paiements_abonnements_justificatifs
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update" ON public.paiements_abonnements_justificatifs
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete" ON public.paiements_abonnements_justificatifs
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_paj_updated_at
BEFORE UPDATE ON public.paiements_abonnements_justificatifs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket de stockage privé
INSERT INTO storage.buckets (id, name, public)
VALUES ('paiements-abonnements-justificatifs', 'paiements-abonnements-justificatifs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth can read paj files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'paiements-abonnements-justificatifs');
CREATE POLICY "Auth can upload paj files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'paiements-abonnements-justificatifs');
CREATE POLICY "Auth can update paj files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'paiements-abonnements-justificatifs');
CREATE POLICY "Auth can delete paj files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'paiements-abonnements-justificatifs');