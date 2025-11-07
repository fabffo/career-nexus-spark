-- Modifier le trigger pour calculer le CA avec tjm OU prix_ht
CREATE OR REPLACE FUNCTION public.calculer_totaux_cra()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  v_cra_id UUID;
  v_total_travailles INTEGER;
  v_total_conges INTEGER;
  v_total_absence INTEGER;
  v_total_heures NUMERIC;
BEGIN
  -- Récupérer le cra_id
  IF TG_OP = 'DELETE' THEN
    v_cra_id := OLD.cra_id;
  ELSE
    v_cra_id := NEW.cra_id;
  END IF;
  
  -- Calculer les totaux
  SELECT 
    COUNT(*) FILTER (WHERE type_jour = 'TRAVAILLE'),
    COUNT(*) FILTER (WHERE type_jour IN ('CONGE_PAYE', 'RTT')),
    COUNT(*) FILTER (WHERE type_jour IN ('ABSENCE', 'ARRET_MALADIE')),
    COALESCE(SUM(heures) FILTER (WHERE type_jour = 'TRAVAILLE'), 0)
  INTO 
    v_total_travailles,
    v_total_conges,
    v_total_absence,
    v_total_heures
  FROM public.cra_jours
  WHERE cra_id = v_cra_id;
  
  -- Mettre à jour le CRA avec tjm OU prix_ht si tjm est null
  UPDATE public.cra
  SET 
    jours_travailles = v_total_travailles,
    jours_conges = v_total_conges,
    jours_absence = v_total_absence,
    total_heures = v_total_heures,
    ca_mensuel = v_total_travailles * (
      SELECT COALESCE(m.tjm, m.prix_ht, 0)
      FROM public.missions m 
      WHERE m.id = (SELECT mission_id FROM public.cra WHERE id = v_cra_id)
    )
  WHERE id = v_cra_id;
  
  RETURN NEW;
END;
$function$;