-- Fix security issue: Restrict access to prestataires table
-- Implement proper role-based access control for contractor personal data

-- Drop all existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view prestataires" ON public.prestataires;
DROP POLICY IF EXISTS "Authenticated users can insert prestataires" ON public.prestataires;
DROP POLICY IF EXISTS "Authenticated users can update prestataires" ON public.prestataires;
DROP POLICY IF EXISTS "Authenticated users can delete prestataires" ON public.prestataires;

-- SELECT Policy: Allow authorized roles and contractors to view their own data
CREATE POLICY "Authorized users can view prestataires" 
ON public.prestataires 
FOR SELECT 
USING (
  -- Admins, Recruiters, and Contract managers can view all
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
  OR
  -- Prestataires can view their own record
  (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'PRESTATAIRE'
    )
  )
);

-- INSERT Policy: Only authorized roles can create prestataire records
CREATE POLICY "Authorized roles can insert prestataires" 
ON public.prestataires 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);

-- UPDATE Policy: Authorized roles can update all, prestataires can update their own
CREATE POLICY "Authorized users can update prestataires" 
ON public.prestataires 
FOR UPDATE 
USING (
  -- Admins, Recruiters, and Contract managers can update all
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
  OR
  -- Prestataires can update their own record
  (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'PRESTATAIRE'
    )
  )
);

-- DELETE Policy: Only admins and recruiters can delete prestataire records
CREATE POLICY "Admins and recruiters can delete prestataires" 
ON public.prestataires 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR')
  )
);