-- Migration pour système de traçabilité bidirectionnelle des rapprochements bancaires

-- 1. Modifier la colonne numero_ligne dans rapprochements_bancaires pour la rendre UNIQUE
ALTER TABLE public.rapprochements_bancaires 
  ALTER COLUMN numero_ligne SET NOT NULL;

ALTER TABLE public.rapprochements_bancaires 
  ADD CONSTRAINT rapprochements_bancaires_numero_ligne_unique UNIQUE (numero_ligne);

-- Ajouter un commentaire sur la colonne
COMMENT ON COLUMN public.rapprochements_bancaires.numero_ligne IS 
  'Numéro unique de ligne de rapprochement au format RL-YYYYMMDD-XXXXX permettant la traçabilité bidirectionnelle';

-- 2. Créer un index sur numero_ligne pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_rapprochements_bancaires_numero_ligne 
  ON public.rapprochements_bancaires(numero_ligne);

-- 3. Ajouter la colonne numero_ligne_rapprochement dans factures
ALTER TABLE public.factures 
  ADD COLUMN IF NOT EXISTS numero_ligne_rapprochement TEXT;

-- Ajouter un commentaire sur la colonne
COMMENT ON COLUMN public.factures.numero_ligne_rapprochement IS 
  'Référence au numéro de ligne de rapprochement bancaire (format RL-YYYYMMDD-XXXXX) permettant de retrouver le rapprochement associé';

-- 4. Créer un index sur numero_ligne_rapprochement pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_factures_numero_ligne_rapprochement 
  ON public.factures(numero_ligne_rapprochement);

-- 5. Recréer la fonction generate_numero_ligne() avec gestion des limites
CREATE OR REPLACE FUNCTION public.generate_numero_ligne()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_numero TEXT;
  v_exists BOOLEAN;
  v_counter INTEGER := 1;
  v_date_prefix TEXT;
BEGIN
  -- Générer le préfixe de date
  v_date_prefix := 'RL-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-';
  
  LOOP
    -- Vérifier si on dépasse la limite journalière
    IF v_counter > 99999 THEN
      RAISE EXCEPTION 'Limite journalière de numéros de ligne atteinte (99999). Contactez l''administrateur.';
    END IF;
    
    -- Générer un numéro au format RL-YYYYMMDD-XXXXX
    v_numero := v_date_prefix || LPAD(v_counter::TEXT, 5, '0');
    
    -- Vérifier si ce numéro existe déjà
    SELECT EXISTS(
      SELECT 1 FROM public.rapprochements_bancaires 
      WHERE numero_ligne = v_numero
    ) INTO v_exists;
    
    -- Si le numéro n'existe pas, le retourner
    IF NOT v_exists THEN
      RETURN v_numero;
    END IF;
    
    -- Incrémenter le compteur pour le prochain essai
    v_counter := v_counter + 1;
  END LOOP;
END;
$$;

-- Ajouter un commentaire sur la fonction
COMMENT ON FUNCTION public.generate_numero_ligne() IS 
  'Génère un numéro unique de ligne de rapprochement au format RL-YYYYMMDD-XXXXX avec validation d''unicité et limite journalière de 99999 numéros';

-- 6. Recréer le trigger pour auto-générer le numero_ligne si null
CREATE OR REPLACE FUNCTION public.set_numero_ligne()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.numero_ligne IS NULL THEN
    NEW.numero_ligne := generate_numero_ligne();
  END IF;
  RETURN NEW;
END;
$$;

-- Supprimer l'ancien trigger s'il existe et le recréer
DROP TRIGGER IF EXISTS trigger_set_numero_ligne ON public.rapprochements_bancaires;

CREATE TRIGGER trigger_set_numero_ligne
  BEFORE INSERT ON public.rapprochements_bancaires
  FOR EACH ROW
  EXECUTE FUNCTION public.set_numero_ligne();