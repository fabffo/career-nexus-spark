-- Fix RLS policies to use has_role directly with app_role
DROP POLICY IF EXISTS "Authorized roles can manage fournisseurs_services" ON public.fournisseurs_services;
DROP POLICY IF EXISTS "Authorized roles can view fournisseurs_services" ON public.fournisseurs_services;

CREATE POLICY "Authorized roles can manage fournisseurs_services"
ON public.fournisseurs_services
FOR ALL
USING (
  has_role(auth.uid(), 'ADMIN'::app_role) OR 
  has_role(auth.uid(), 'CONTRAT'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'ADMIN'::app_role) OR 
  has_role(auth.uid(), 'CONTRAT'::app_role)
);

CREATE POLICY "Authorized roles can view fournisseurs_services"
ON public.fournisseurs_services
FOR SELECT
USING (
  has_role(auth.uid(), 'ADMIN'::app_role) OR 
  has_role(auth.uid(), 'RECRUTEUR'::app_role) OR 
  has_role(auth.uid(), 'CONTRAT'::app_role)
);

-- Fix RLS policies for fournisseurs_generaux
DROP POLICY IF EXISTS "Authorized roles can manage fournisseurs_generaux" ON public.fournisseurs_generaux;
DROP POLICY IF EXISTS "Authorized roles can view fournisseurs_generaux" ON public.fournisseurs_generaux;

CREATE POLICY "Authorized roles can manage fournisseurs_generaux"
ON public.fournisseurs_generaux
FOR ALL
USING (
  has_role(auth.uid(), 'ADMIN'::app_role) OR 
  has_role(auth.uid(), 'CONTRAT'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'ADMIN'::app_role) OR 
  has_role(auth.uid(), 'CONTRAT'::app_role)
);

CREATE POLICY "Authorized roles can view fournisseurs_generaux"
ON public.fournisseurs_generaux
FOR SELECT
USING (
  has_role(auth.uid(), 'ADMIN'::app_role) OR 
  has_role(auth.uid(), 'RECRUTEUR'::app_role) OR 
  has_role(auth.uid(), 'CONTRAT'::app_role)
);