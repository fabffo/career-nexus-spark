-- Corriger les politiques RLS pour utiliser correctement la table profiles sans récursion

-- Créer une fonction pour vérifier le rôle d'un utilisateur sans récursion
CREATE OR REPLACE FUNCTION public.user_has_role(user_id uuid, allowed_roles user_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = user_id
    AND profiles.role = ANY(allowed_roles)
  )
$$;

-- CANDIDATS
DROP POLICY IF EXISTS "Authorized roles can view candidats" ON public.candidats;
CREATE POLICY "Authorized roles can view candidats"
ON public.candidats
FOR SELECT
USING (
  public.user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
  OR (user_id = auth.uid() AND user_id IS NOT NULL)
);

DROP POLICY IF EXISTS "Authorized roles can update candidats" ON public.candidats;
CREATE POLICY "Authorized roles can update candidats"
ON public.candidats
FOR UPDATE
USING (
  public.user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role])
  OR (user_id = auth.uid() AND user_id IS NOT NULL)
);

-- CLIENTS
DROP POLICY IF EXISTS "Authorized roles can view clients" ON public.clients;
CREATE POLICY "Authorized roles can view clients"
ON public.clients
FOR SELECT
USING (public.user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role]));

-- POSTES
DROP POLICY IF EXISTS "Authorized roles can view postes" ON public.postes;
CREATE POLICY "Authorized roles can view postes"
ON public.postes
FOR SELECT
USING (public.user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role]));

-- RDVS
DROP POLICY IF EXISTS "Authorized users can view rdvs" ON public.rdvs;
CREATE POLICY "Authorized users can view rdvs"
ON public.rdvs
FOR SELECT
USING (
  public.user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
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
USING (public.user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role]));

-- PRESTATAIRES
DROP POLICY IF EXISTS "Authorized users can view prestataires" ON public.prestataires;
CREATE POLICY "Authorized users can view prestataires"
ON public.prestataires
FOR SELECT
USING (
  public.user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
  OR (user_id = auth.uid() AND public.user_has_role(auth.uid(), ARRAY['PRESTATAIRE'::user_role]))
);

-- SALARIES
DROP POLICY IF EXISTS "Authorized users can view salaries" ON public.salaries;
CREATE POLICY "Authorized users can view salaries"
ON public.salaries
FOR SELECT
USING (
  public.user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role])
  OR (user_id = auth.uid() AND user_id IS NOT NULL)
);

-- MATCHINGS
DROP POLICY IF EXISTS "Authorized roles can view matchings" ON public.matchings;
CREATE POLICY "Authorized roles can view matchings"
ON public.matchings
FOR SELECT
USING (public.user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role]));

-- ANALYSE_POSTE_CANDIDAT
DROP POLICY IF EXISTS "Authorized roles can view analyses" ON public.analyse_poste_candidat;
CREATE POLICY "Authorized roles can view analyses"
ON public.analyse_poste_candidat
FOR SELECT
USING (public.user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role]));