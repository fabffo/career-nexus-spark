-- Supprimer l'ancien trigger qui valide vers param_type_prestation
DROP TRIGGER IF EXISTS validate_type_prestation_trigger ON public.postes;
DROP FUNCTION IF EXISTS public.validate_type_prestation();

-- Créer un nouveau trigger qui valide vers param_type_mission
CREATE OR REPLACE FUNCTION public.validate_poste_type_mission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type_prestation IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM param_type_mission 
    WHERE code = NEW.type_prestation 
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Type de mission invalide: %', NEW.type_prestation;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_poste_type_mission_trigger
  BEFORE INSERT OR UPDATE ON public.postes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_poste_type_mission();