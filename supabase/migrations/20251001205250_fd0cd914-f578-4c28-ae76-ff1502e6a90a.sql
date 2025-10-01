-- Créer la table pour gérer les séquences de factures de vente
CREATE TABLE IF NOT EXISTS public.facture_sequences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type_facture character varying(20) NOT NULL DEFAULT 'VENTES',
  prefixe character varying(20) NOT NULL DEFAULT 'FAC-V',
  prochain_numero integer NOT NULL DEFAULT 1,
  annee integer,
  format character varying(50) NOT NULL DEFAULT '{prefixe}-{annee}-{numero}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT unique_sequence_type_annee UNIQUE (type_facture, annee)
);

-- Enable RLS
ALTER TABLE public.facture_sequences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage facture_sequences" 
  ON public.facture_sequences 
  FOR ALL 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'::user_role));

CREATE POLICY "Authorized users can view facture_sequences" 
  ON public.facture_sequences 
  FOR SELECT 
  USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Create trigger for updated_at
CREATE TRIGGER update_facture_sequences_updated_at
  BEFORE UPDATE ON public.facture_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Fonction pour obtenir le prochain numéro de facture de vente
CREATE OR REPLACE FUNCTION public.get_next_facture_numero(p_type_facture varchar DEFAULT 'VENTES')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequence record;
  v_numero text;
  v_annee integer;
BEGIN
  -- Pour les factures d'achat, retourner NULL (saisie manuelle)
  IF p_type_facture = 'ACHATS' THEN
    RETURN NULL;
  END IF;

  v_annee := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Récupérer ou créer la séquence pour l'année courante
  SELECT * INTO v_sequence
  FROM public.facture_sequences
  WHERE type_facture = p_type_facture
    AND (annee = v_annee OR annee IS NULL)
  ORDER BY annee DESC NULLS LAST
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- Créer une nouvelle séquence par défaut
    INSERT INTO public.facture_sequences (type_facture, prefixe, prochain_numero, annee, format)
    VALUES (p_type_facture, 'FAC-V', 1, v_annee, '{prefixe}-{annee}-{numero}')
    RETURNING * INTO v_sequence;
  ELSIF v_sequence.annee IS NULL OR v_sequence.annee != v_annee THEN
    -- Créer une nouvelle séquence pour la nouvelle année
    INSERT INTO public.facture_sequences (
      type_facture, 
      prefixe, 
      prochain_numero, 
      annee, 
      format
    )
    VALUES (
      v_sequence.type_facture,
      v_sequence.prefixe,
      1,
      v_annee,
      v_sequence.format
    )
    RETURNING * INTO v_sequence;
  END IF;
  
  -- Générer le numéro selon le format
  v_numero := v_sequence.format;
  v_numero := REPLACE(v_numero, '{prefixe}', v_sequence.prefixe);
  v_numero := REPLACE(v_numero, '{annee}', v_annee::text);
  v_numero := REPLACE(v_numero, '{numero}', LPAD(v_sequence.prochain_numero::text, 5, '0'));
  
  -- Incrémenter le compteur
  UPDATE public.facture_sequences
  SET prochain_numero = prochain_numero + 1,
      updated_at = NOW()
  WHERE id = v_sequence.id;
  
  RETURN v_numero;
END;
$$;

-- Modifier la fonction generate_numero_facture pour utiliser la nouvelle logique
DROP FUNCTION IF EXISTS public.generate_numero_facture(varchar);
CREATE OR REPLACE FUNCTION public.generate_numero_facture(p_type varchar)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_next_facture_numero(p_type);
$$;