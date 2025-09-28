-- Modifier la fonction pour gérer correctement le premier numéro
CREATE OR REPLACE FUNCTION public.get_next_contract_number(p_year integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_next_number INTEGER;
  v_formatted_number TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Vérifier s'il existe déjà une séquence pour cette année
  SELECT last_number INTO v_next_number
  FROM public.contrat_sequences
  WHERE year = p_year;
  
  IF v_next_number IS NULL THEN
    -- Première fois pour cette année, commencer à 1
    v_next_number := 1;
    INSERT INTO public.contrat_sequences (year, last_number)
    VALUES (p_year, 1);
  ELSE
    -- Incrémenter et mettre à jour
    v_next_number := v_next_number + 1;
    UPDATE public.contrat_sequences
    SET last_number = v_next_number,
        updated_at = NOW()
    WHERE year = p_year;
  END IF;
  
  -- Boucle pour trouver un numéro non utilisé
  LOOP
    v_formatted_number := p_year::TEXT || '-' || LPAD(v_next_number::TEXT, 4, '0');
    
    -- Vérifier si ce numéro existe déjà dans les contrats
    SELECT EXISTS(
      SELECT 1 FROM public.contrats 
      WHERE numero_contrat = v_formatted_number
    ) INTO v_exists;
    
    IF NOT v_exists THEN
      -- Numéro disponible, mettre à jour la séquence et retourner
      UPDATE public.contrat_sequences
      SET last_number = v_next_number,
          updated_at = NOW()
      WHERE year = p_year;
      
      RETURN v_formatted_number;
    END IF;
    
    -- Si le numéro existe, essayer le suivant
    v_next_number := v_next_number + 1;
  END LOOP;
END;
$function$;