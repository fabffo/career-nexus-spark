-- Corriger la fonction calculate_prix_ttc avec search_path
CREATE OR REPLACE FUNCTION public.calculate_prix_ttc()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.prix_ht IS NOT NULL AND NEW.taux_tva IS NOT NULL THEN
    NEW.prix_ttc := NEW.prix_ht * (1 + NEW.taux_tva / 100);
  END IF;
  RETURN NEW;
END;
$$;