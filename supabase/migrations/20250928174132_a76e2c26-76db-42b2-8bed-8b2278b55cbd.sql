-- Créer une table pour gérer les séquences de numéros de contrat
CREATE TABLE IF NOT EXISTS public.contrat_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activer RLS
ALTER TABLE public.contrat_sequences ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture à tous les utilisateurs authentifiés
CREATE POLICY "Authenticated users can view sequences" 
ON public.contrat_sequences 
FOR SELECT 
TO authenticated
USING (true);

-- Politique pour permettre l'insertion/mise à jour aux utilisateurs avec rôle CONTRAT ou ADMIN
CREATE POLICY "CONTRAT and ADMIN users can manage sequences" 
ON public.contrat_sequences 
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'CONTRAT' OR profiles.role = 'ADMIN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'CONTRAT' OR profiles.role = 'ADMIN')
  )
);

-- Fonction pour obtenir le prochain numéro de contrat
CREATE OR REPLACE FUNCTION public.get_next_contract_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_number INTEGER;
BEGIN
  -- Insérer ou mettre à jour la séquence pour l'année
  INSERT INTO public.contrat_sequences (year, last_number)
  VALUES (p_year, 1)
  ON CONFLICT (year) 
  DO UPDATE SET 
    last_number = contrat_sequences.last_number + 1,
    updated_at = NOW()
  RETURNING last_number INTO v_next_number;
  
  -- Retourner le numéro formaté : YYYY-NNNN
  RETURN p_year::TEXT || '-' || LPAD(v_next_number::TEXT, 4, '0');
END;
$$;

-- Fonction pour obtenir le prochain numéro d'avenant
CREATE OR REPLACE FUNCTION public.get_next_avenant_number(p_parent_numero TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_avenant_count INTEGER;
BEGIN
  -- Compter le nombre d'avenants existants pour ce contrat parent
  SELECT COUNT(*) + 1 INTO v_avenant_count
  FROM public.contrats
  WHERE numero_contrat LIKE p_parent_numero || '-AV%';
  
  -- Retourner le numéro formaté : YYYY-NNNN-AVX
  RETURN p_parent_numero || '-AV' || v_avenant_count::TEXT;
END;
$$;

-- Initialiser la séquence avec les contrats existants
DO $$
DECLARE
  v_year INTEGER;
  v_max_number INTEGER;
  v_numero TEXT;
BEGIN
  -- Pour chaque année présente dans les contrats existants
  FOR v_year IN 
    SELECT DISTINCT EXTRACT(YEAR FROM created_at)::INTEGER 
    FROM public.contrats 
    WHERE numero_contrat LIKE 'CTR-%'
  LOOP
    -- Trouver le plus grand numéro pour cette année
    SELECT MAX(
      CASE 
        WHEN numero_contrat ~ '^CTR-\d{4}-\d+$' THEN
          NULLIF(SPLIT_PART(numero_contrat, '-', 3), '')::INTEGER
        ELSE 0
      END
    ) INTO v_max_number
    FROM public.contrats
    WHERE EXTRACT(YEAR FROM created_at) = v_year;
    
    -- Insérer dans la table de séquence si on a trouvé des contrats
    IF v_max_number IS NOT NULL AND v_max_number > 0 THEN
      INSERT INTO public.contrat_sequences (year, last_number)
      VALUES (v_year, v_max_number)
      ON CONFLICT (year) DO NOTHING;
    END IF;
  END LOOP;
END $$;