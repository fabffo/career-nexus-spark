-- Ajouter les nouveaux champs d'adresse structurée à la table clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS adresse_ligne1 TEXT,
  ADD COLUMN IF NOT EXISTS code_postal VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ville VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pays VARCHAR(100) DEFAULT 'France';

-- Créer une fonction temporaire pour extraire le code postal
CREATE OR REPLACE FUNCTION extract_code_postal(addr TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  code TEXT;
BEGIN
  -- Chercher un pattern de 5 chiffres
  code := (SELECT (regexp_match(addr, '\s(\d{5})\s'))[1]);
  RETURN code;
END;
$$;

-- Migrer les données existantes
UPDATE public.clients
SET 
  adresse_ligne1 = CASE 
    WHEN adresse IS NOT NULL THEN 
      -- Prendre tout avant le code postal
      TRIM(regexp_replace(adresse, '\s+\d{5}\s+.*$', ''))
    ELSE NULL
  END,
  code_postal = CASE 
    WHEN adresse IS NOT NULL THEN 
      extract_code_postal(adresse)
    ELSE NULL
  END,
  ville = CASE 
    WHEN adresse IS NOT NULL AND extract_code_postal(adresse) IS NOT NULL THEN 
      -- Extraire la ville (après le code postal)
      TRIM(regexp_replace(regexp_replace(adresse, '^.*\d{5}\s+', ''), '\s+(France|Belgique|Suisse|Luxembourg).*$', '', 'i'))
    ELSE NULL
  END,
  pays = CASE
    WHEN adresse ~* 'Belgique' THEN 'Belgique'
    WHEN adresse ~* 'Suisse' THEN 'Suisse'
    WHEN adresse ~* 'Luxembourg' THEN 'Luxembourg'
    WHEN adresse IS NOT NULL THEN 'France'
    ELSE 'France'
  END
WHERE adresse IS NOT NULL;

-- Pour les adresses qui n'ont pas pu être parsées, mettre toute l'adresse dans adresse_ligne1
UPDATE public.clients
SET adresse_ligne1 = adresse,
    ville = COALESCE(ville, 'Non spécifiée'),
    pays = COALESCE(pays, 'France')
WHERE adresse IS NOT NULL 
  AND (code_postal IS NULL OR ville IS NULL OR ville = '');

-- S'assurer que ville et pays ne sont jamais NULL pour les clients existants
UPDATE public.clients
SET ville = 'Non spécifiée'
WHERE ville IS NULL OR ville = '';

UPDATE public.clients
SET pays = 'France'
WHERE pays IS NULL OR pays = '';

-- Supprimer l'ancien champ adresse
ALTER TABLE public.clients DROP COLUMN IF EXISTS adresse;

-- Supprimer la fonction temporaire
DROP FUNCTION IF EXISTS extract_code_postal(TEXT);

-- Rendre certains champs obligatoires
ALTER TABLE public.clients 
  ALTER COLUMN ville SET NOT NULL,
  ALTER COLUMN pays SET NOT NULL;

-- Ajouter des commentaires
COMMENT ON COLUMN public.clients.adresse_ligne1 IS 'Numéro, rue et complément d''adresse';
COMMENT ON COLUMN public.clients.code_postal IS 'Code postal';
COMMENT ON COLUMN public.clients.ville IS 'Ville';
COMMENT ON COLUMN public.clients.pays IS 'Pays';