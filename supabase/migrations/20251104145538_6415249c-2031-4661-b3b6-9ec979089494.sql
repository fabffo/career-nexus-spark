-- Correction des avertissements de sécurité pour les fonctions de génération de numéro de ligne

-- Recréer la fonction generate_numero_ligne() avec search_path sécurisé
CREATE OR REPLACE FUNCTION public.generate_numero_ligne()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Recréer la fonction set_numero_ligne() avec search_path sécurisé
CREATE OR REPLACE FUNCTION public.set_numero_ligne()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.numero_ligne IS NULL THEN
    NEW.numero_ligne := generate_numero_ligne();
  END IF;
  RETURN NEW;
END;
$$;