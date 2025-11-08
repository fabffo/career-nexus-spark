-- Fix RLS policies for fournisseurs_services to use user_has_role function
DROP POLICY IF EXISTS "Authorized roles can manage fournisseurs_services" ON public.fournisseurs_services;
DROP POLICY IF EXISTS "Authorized roles can view fournisseurs_services" ON public.fournisseurs_services;

-- Create policies using the secure user_has_role function
CREATE POLICY "Authorized roles can manage fournisseurs_services"
ON public.fournisseurs_services
FOR ALL
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]))
WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can view fournisseurs_services"
ON public.fournisseurs_services
FOR SELECT
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role]));

-- Fix RLS policies for fournisseurs_generaux to use user_has_role function
DROP POLICY IF EXISTS "Authorized roles can manage fournisseurs_generaux" ON public.fournisseurs_generaux;
DROP POLICY IF EXISTS "Authorized roles can view fournisseurs_generaux" ON public.fournisseurs_generaux;

CREATE POLICY "Authorized roles can manage fournisseurs_generaux"
ON public.fournisseurs_generaux
FOR ALL
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]))
WITH CHECK (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role]));

CREATE POLICY "Authorized roles can view fournisseurs_generaux"
ON public.fournisseurs_generaux
FOR SELECT
USING (user_has_role(auth.uid(), ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role]));