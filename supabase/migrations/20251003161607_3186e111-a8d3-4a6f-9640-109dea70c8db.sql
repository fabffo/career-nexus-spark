-- Ajouter le champ numero_mission à la table missions
ALTER TABLE missions ADD COLUMN numero_mission VARCHAR UNIQUE;

-- Créer une table pour gérer les séquences de numéros de mission
CREATE TABLE IF NOT EXISTS mission_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activer RLS sur mission_sequences
ALTER TABLE mission_sequences ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux rôles autorisés de voir les séquences
CREATE POLICY "Authorized roles can view mission sequences"
ON mission_sequences
FOR SELECT
TO authenticated
USING (
  user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role])
);

-- Politique pour permettre aux rôles autorisés de gérer les séquences
CREATE POLICY "Authorized roles can manage mission sequences"
ON mission_sequences
FOR ALL
TO authenticated
USING (
  user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role])
)
WITH CHECK (
  user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role])
);

-- Fonction pour générer le prochain numéro de mission
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour générer automatiquement le numéro de mission
CREATE TRIGGER generate_mission_number_trigger
BEFORE INSERT ON missions
FOR EACH ROW
EXECUTE FUNCTION generate_mission_number();

-- Mettre à jour les missions existantes avec des numéros
DO $$
DECLARE
  mission_record RECORD;
  current_year INTEGER;
  counter INTEGER := 1;
  new_numero VARCHAR;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  FOR mission_record IN 
    SELECT id FROM missions WHERE numero_mission IS NULL ORDER BY created_at
  LOOP
    new_numero := 'MISS-' || current_year || '-' || LPAD(counter::TEXT, 4, '0');
    UPDATE missions SET numero_mission = new_numero WHERE id = mission_record.id;
    counter := counter + 1;
  END LOOP;
  
  -- Initialiser la séquence avec le bon nombre
  IF counter > 1 THEN
    INSERT INTO mission_sequences (year, last_number)
    VALUES (current_year, counter - 1)
    ON CONFLICT (year) DO UPDATE
    SET last_number = counter - 1;
  END IF;
END $$;