-- Créer la table pour les fichiers de rapprochement
CREATE TABLE IF NOT EXISTS public.fichiers_rapprochement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_rapprochement VARCHAR NOT NULL UNIQUE,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  fichier_data JSONB NOT NULL,
  statut VARCHAR NOT NULL DEFAULT 'EN_COURS',
  total_lignes INTEGER NOT NULL DEFAULT 0,
  lignes_rapprochees INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ajouter une colonne numero_rapprochement dans la table factures
ALTER TABLE public.factures 
ADD COLUMN IF NOT EXISTS numero_rapprochement VARCHAR,
ADD COLUMN IF NOT EXISTS date_rapprochement TIMESTAMP WITH TIME ZONE;

-- Créer une séquence pour les numéros de rapprochement par année
CREATE TABLE IF NOT EXISTS public.rapprochement_sequences (
  year INTEGER NOT NULL PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Fonction pour générer le prochain numéro de rapprochement
CREATE OR REPLACE FUNCTION public.get_next_rapprochement_numero()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER;
  v_next_number INTEGER;
  v_numero TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  INSERT INTO public.rapprochement_sequences (year, last_number)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = rapprochement_sequences.last_number + 1,
      updated_at = NOW()
  RETURNING last_number INTO v_next_number;
  
  v_numero := 'RAP-' || 
              SUBSTRING(v_year::TEXT FROM 3 FOR 2) || 
              LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::TEXT, 2, '0') || 
              LPAD(v_next_number::TEXT, 2, '0');
  
  RETURN v_numero;
END;
$$;

-- Fonction pour vérifier si des dates sont déjà rapprochées
CREATE OR REPLACE FUNCTION public.check_dates_already_reconciled(p_date_debut DATE, p_date_fin DATE)
RETURNS TABLE(is_reconciled BOOLEAN, numero_rapprochement VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE as is_reconciled,
    fr.numero_rapprochement
  FROM public.fichiers_rapprochement fr
  WHERE fr.statut = 'VALIDE'
    AND (
      (p_date_debut BETWEEN fr.date_debut AND fr.date_fin) OR
      (p_date_fin BETWEEN fr.date_debut AND fr.date_fin) OR
      (fr.date_debut BETWEEN p_date_debut AND p_date_fin) OR
      (fr.date_fin BETWEEN p_date_debut AND p_date_fin)
    )
  LIMIT 1;
END;
$$;

-- Trigger pour update_at
CREATE TRIGGER update_fichiers_rapprochement_updated_at
BEFORE UPDATE ON public.fichiers_rapprochement
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rapprochement_sequences_updated_at
BEFORE UPDATE ON public.rapprochement_sequences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies pour fichiers_rapprochement
ALTER TABLE public.fichiers_rapprochement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized roles can view fichiers_rapprochement"
ON public.fichiers_rapprochement FOR SELECT
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can create fichiers_rapprochement"
ON public.fichiers_rapprochement FOR INSERT
WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can update fichiers_rapprochement"
ON public.fichiers_rapprochement FOR UPDATE
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can delete fichiers_rapprochement"
ON public.fichiers_rapprochement FOR DELETE
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- RLS Policies pour rapprochement_sequences
ALTER TABLE public.rapprochement_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized roles can view rapprochement_sequences"
ON public.rapprochement_sequences FOR SELECT
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can manage rapprochement_sequences"
ON public.rapprochement_sequences FOR ALL
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]))
WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));