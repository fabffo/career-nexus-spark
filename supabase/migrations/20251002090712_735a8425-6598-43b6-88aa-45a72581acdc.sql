-- Migration pour rendre les types dynamiques

-- 1. D'abord créer des colonnes temporaires
ALTER TABLE missions 
  ADD COLUMN type_mission_temp VARCHAR(50),
  ADD COLUMN type_intervenant_temp VARCHAR(50);

-- 2. Copier les données existantes
UPDATE missions 
SET 
  type_mission_temp = type_mission::text,
  type_intervenant_temp = type_intervenant::text;

-- 3. Supprimer les anciennes colonnes avec enum
ALTER TABLE missions 
  DROP COLUMN type_mission,
  DROP COLUMN type_intervenant;

-- 4. Renommer les colonnes temporaires
ALTER TABLE missions 
  RENAME COLUMN type_mission_temp TO type_mission;
ALTER TABLE missions 
  RENAME COLUMN type_intervenant_temp TO type_intervenant;

-- 5. Ajouter NOT NULL après la migration des données
ALTER TABLE missions 
  ALTER COLUMN type_mission SET NOT NULL,
  ALTER COLUMN type_intervenant SET NOT NULL;

-- 6. Créer une fonction de validation pour type_mission avec search_path
CREATE OR REPLACE FUNCTION validate_type_mission()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM param_type_mission 
    WHERE code = NEW.type_mission 
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Type de mission invalide: %', NEW.type_mission;
  END IF;
  RETURN NEW;
END;
$$;

-- 7. Créer une fonction de validation pour type_intervenant avec search_path
CREATE OR REPLACE FUNCTION validate_type_intervenant()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM param_type_intervenant 
    WHERE code = NEW.type_intervenant 
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Type d''intervenant invalide: %', NEW.type_intervenant;
  END IF;
  RETURN NEW;
END;
$$;

-- 8. Créer les triggers de validation
CREATE TRIGGER validate_mission_type_mission
  BEFORE INSERT OR UPDATE OF type_mission ON missions
  FOR EACH ROW
  EXECUTE FUNCTION validate_type_mission();

CREATE TRIGGER validate_mission_type_intervenant
  BEFORE INSERT OR UPDATE OF type_intervenant ON missions
  FOR EACH ROW
  EXECUTE FUNCTION validate_type_intervenant();

-- 9. Supprimer les anciens types enum qui ne sont plus utilisés
DROP TYPE IF EXISTS type_mission;
DROP TYPE IF EXISTS type_intervenant;