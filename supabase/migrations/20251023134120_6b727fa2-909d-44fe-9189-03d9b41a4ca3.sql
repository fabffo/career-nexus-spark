-- Corriger la fonction create_rappels_for_echeance avec search_path
DROP TRIGGER IF EXISTS create_rappels_on_echeance_insert ON public.echeances_fiscales;
DROP FUNCTION IF EXISTS public.create_rappels_for_echeance();

CREATE OR REPLACE FUNCTION public.create_rappels_for_echeance()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- Créer rappels à J-15, J-7, J-1
  INSERT INTO public.rappels_fiscaux (echeance_id, jours_avant, date_rappel)
  VALUES 
    (NEW.id, 15, NEW.date_echeance - INTERVAL '15 days'),
    (NEW.id, 7, NEW.date_echeance - INTERVAL '7 days'),
    (NEW.id, 1, NEW.date_echeance - INTERVAL '1 day');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_rappels_on_echeance_insert
AFTER INSERT ON public.echeances_fiscales
FOR EACH ROW
EXECUTE FUNCTION public.create_rappels_for_echeance();