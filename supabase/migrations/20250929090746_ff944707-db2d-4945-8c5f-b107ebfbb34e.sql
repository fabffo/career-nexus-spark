-- Fix security issue: Restrict access to analyse_poste_candidat table
-- Only allow ADMIN, RECRUTEUR, and CONTRAT roles to view candidate analyses

-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view analyses" ON public.analyse_poste_candidat;

-- Create a new SELECT policy that restricts access to authorized roles only
CREATE POLICY "Authorized roles can view analyses" 
ON public.analyse_poste_candidat 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);

-- Update INSERT policy to also restrict to authorized roles
DROP POLICY IF EXISTS "Authenticated users can create analyses" ON public.analyse_poste_candidat;

CREATE POLICY "Authorized roles can create analyses" 
ON public.analyse_poste_candidat 
FOR INSERT 
WITH CHECK (
  auth.uid() = created_by 
  AND EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);

-- Update UPDATE policy to also restrict to authorized roles
DROP POLICY IF EXISTS "Authenticated users can update their analyses" ON public.analyse_poste_candidat;

CREATE POLICY "Authorized roles can update their analyses" 
ON public.analyse_poste_candidat 
FOR UPDATE 
USING (
  auth.uid() = created_by 
  AND EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);

-- Add DELETE policy for authorized roles
CREATE POLICY "Authorized roles can delete their analyses" 
ON public.analyse_poste_candidat 
FOR DELETE 
USING (
  auth.uid() = created_by 
  AND EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);