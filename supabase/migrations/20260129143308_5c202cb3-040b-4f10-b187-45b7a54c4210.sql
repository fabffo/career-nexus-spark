-- Ajouter le type SALARIE à l'enum contrat_type
ALTER TYPE contrat_type ADD VALUE IF NOT EXISTS 'SALARIE';

-- Ajouter la colonne salarie_id à la table contrats (si elle n'existe pas déjà)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'contrats' 
                   AND column_name = 'salarie_id') THEN
        ALTER TABLE public.contrats ADD COLUMN salarie_id uuid REFERENCES public.salaries(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Créer la table de liaison entre contrats salariés et charges sociales
CREATE TABLE IF NOT EXISTS public.contrats_charges_sociales (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    contrat_id uuid NOT NULL REFERENCES public.contrats(id) ON DELETE CASCADE,
    declaration_charge_id uuid NOT NULL REFERENCES public.declarations_charges_sociales(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    UNIQUE(contrat_id, declaration_charge_id)
);

-- Activer RLS sur la table
ALTER TABLE public.contrats_charges_sociales ENABLE ROW LEVEL SECURITY;

-- Politiques RLS
CREATE POLICY "Authorized roles can view contrats_charges_sociales" 
ON public.contrats_charges_sociales 
FOR SELECT 
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role, 'RECRUTEUR'::user_role]));

CREATE POLICY "Authorized roles can manage contrats_charges_sociales" 
ON public.contrats_charges_sociales 
FOR ALL 
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]))
WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_contrats_salarie_id ON public.contrats(salarie_id);
CREATE INDEX IF NOT EXISTS idx_contrats_charges_sociales_contrat_id ON public.contrats_charges_sociales(contrat_id);
CREATE INDEX IF NOT EXISTS idx_contrats_charges_sociales_declaration_id ON public.contrats_charges_sociales(declaration_charge_id);