-- Corriger les politiques RLS pour utiliser directement les métadonnées auth au lieu de la table profiles
-- Cela évite la récursion et améliore les performances

-- CANDIDATS
DROP POLICY IF EXISTS "Authorized roles can view candidats" ON public.candidats;
CREATE POLICY "Authorized roles can view candidats"
ON public.candidats
FOR SELECT
USING (
  (auth.jwt()->>'role' IN ('ADMIN', 'RECRUTEUR', 'CONTRAT'))
  OR (user_id = auth.uid() AND user_id IS NOT NULL)
);

DROP POLICY IF EXISTS "Authorized roles can update candidats" ON public.candidats;
CREATE POLICY "Authorized roles can update candidats"
ON public.candidats
FOR UPDATE
USING (
  (auth.jwt()->>'role' IN ('ADMIN', 'RECRUTEUR'))
  OR (user_id = auth.uid() AND user_id IS NOT NULL)
);

-- CLIENTS
DROP POLICY IF EXISTS "Authorized roles can view clients" ON public.clients;
CREATE POLICY "Authorized roles can view clients"
ON public.clients
FOR SELECT
USING (auth.jwt()->>'role' IN ('ADMIN', 'RECRUTEUR', 'CONTRAT'));

-- POSTES
DROP POLICY IF EXISTS "Authorized roles can view postes" ON public.postes;
CREATE POLICY "Authorized roles can view postes"
ON public.postes
FOR SELECT
USING (auth.jwt()->>'role' IN ('ADMIN', 'RECRUTEUR', 'CONTRAT'));

-- RDVS
DROP POLICY IF EXISTS "Authorized users can view rdvs" ON public.rdvs;
CREATE POLICY "Authorized users can view rdvs"
ON public.rdvs
FOR SELECT
USING (
  (auth.jwt()->>'role' IN ('ADMIN', 'RECRUTEUR', 'CONTRAT'))
  OR EXISTS (
    SELECT 1 FROM candidats
    WHERE candidats.id = rdvs.candidat_id
    AND candidats.user_id = auth.uid()
  )
);

-- REFERENTS
DROP POLICY IF EXISTS "Authorized roles can view referents" ON public.referents;
CREATE POLICY "Authorized roles can view referents"
ON public.referents
FOR SELECT
USING (auth.jwt()->>'role' IN ('ADMIN', 'RECRUTEUR', 'CONTRAT'));

-- PRESTATAIRES
DROP POLICY IF EXISTS "Authorized users can view prestataires" ON public.prestataires;
CREATE POLICY "Authorized users can view prestataires"
ON public.prestataires
FOR SELECT
USING (
  (auth.jwt()->>'role' IN ('ADMIN', 'RECRUTEUR', 'CONTRAT'))
  OR (user_id = auth.uid() AND auth.jwt()->>'role' = 'PRESTATAIRE')
);

-- SALARIES
DROP POLICY IF EXISTS "Authorized users can view salaries" ON public.salaries;
CREATE POLICY "Authorized users can view salaries"
ON public.salaries
FOR SELECT
USING (
  (auth.jwt()->>'role' IN ('ADMIN', 'RECRUTEUR'))
  OR (user_id = auth.uid() AND user_id IS NOT NULL)
);

-- MATCHINGS
DROP POLICY IF EXISTS "Authorized roles can view matchings" ON public.matchings;
CREATE POLICY "Authorized roles can view matchings"
ON public.matchings
FOR SELECT
USING (auth.jwt()->>'role' IN ('ADMIN', 'RECRUTEUR', 'CONTRAT'));

-- ANALYSE_POSTE_CANDIDAT
DROP POLICY IF EXISTS "Authorized roles can view analyses" ON public.analyse_poste_candidat;
CREATE POLICY "Authorized roles can view analyses"
ON public.analyse_poste_candidat
FOR SELECT
USING (auth.jwt()->>'role' IN ('ADMIN', 'RECRUTEUR', 'CONTRAT'));