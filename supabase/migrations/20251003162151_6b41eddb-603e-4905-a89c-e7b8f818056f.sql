-- Supprimer d'abord le trigger puis recréer la fonction avec le bon search_path
DROP TRIGGER IF EXISTS generate_mission_number_trigger ON missions;
DROP FUNCTION IF EXISTS generate_mission_number();

CREATE OR REPLACE FUNCTION generate_mission_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
  new_numero VARCHAR;
BEGIN
  -- Si un numéro existe déjà, ne pas le modifier
  IF NEW.numero_mission IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Obtenir l'année en cours
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Obtenir et incrémenter le numéro de séquence
  INSERT INTO mission_sequences (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_number = mission_sequences.last_number + 1,
      updated_at = now()
  RETURNING last_number INTO next_number;
  
  -- Générer le numéro de mission au format MISS-YYYY-NNNN
  new_numero := 'MISS-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
  
  NEW.numero_mission := new_numero;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Recréer le trigger
CREATE TRIGGER generate_mission_number_trigger
BEFORE INSERT ON missions
FOR EACH ROW
EXECUTE FUNCTION generate_mission_number();