-- Fix: Restrict access to matchings table to authorized roles only
-- Remove public read access and limit to ADMIN, RECRUTEUR, and CONTRAT roles

-- Drop existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view matchings" ON public.matchings;

-- Create new restrictive SELECT policy for authorized roles only
CREATE POLICY "Authorized roles can view matchings"
ON public.matchings
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
  )
);

-- Update INSERT policy to also ensure only authorized roles can create matchings
DROP POLICY IF EXISTS "Authenticated users can create matchings" ON public.matchings;

CREATE POLICY "Authorized roles can create matchings"
ON public.matchings
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
  )
);

-- Add UPDATE policy for authorized roles to update their own matchings
CREATE POLICY "Authorized roles can update their own matchings"
ON public.matchings
FOR UPDATE
USING (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
  )
);

-- Add DELETE policy for authorized roles to delete their own matchings
CREATE POLICY "Authorized roles can delete their own matchings"
ON public.matchings
FOR DELETE
USING (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['ADMIN'::user_role, 'RECRUTEUR'::user_role, 'CONTRAT'::user_role])
  )
);

-- Also fix contrat_sequences table which has similar issue
DROP POLICY IF EXISTS "Authenticated users can view sequences" ON public.contrat_sequences;

-- Restrict contrat_sequences to CONTRAT and ADMIN roles only
CREATE POLICY "Authorized roles can view sequences"
ON public.contrat_sequences
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = ANY (ARRAY['ADMIN'::user_role, 'CONTRAT'::user_role])
  )
);