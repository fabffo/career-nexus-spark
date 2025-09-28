-- Corriger les fonctions sans search_path défini
CREATE OR REPLACE FUNCTION public.get_next_avenant_number(p_parent_numero text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_avenant_count INTEGER;
BEGIN
  -- Compter le nombre d'avenants existants pour ce contrat parent
  SELECT COUNT(*) + 1 INTO v_avenant_count
  FROM public.contrats
  WHERE numero_contrat LIKE p_parent_numero || '-AV%';
  
  -- Retourner le numéro formaté : YYYY-NNNN-AVX
  RETURN p_parent_numero || '-AV' || v_avenant_count::TEXT;
END;
$function$;

-- Corriger la fonction generate_invitation_token
CREATE OR REPLACE FUNCTION public.generate_invitation_token()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$function$;