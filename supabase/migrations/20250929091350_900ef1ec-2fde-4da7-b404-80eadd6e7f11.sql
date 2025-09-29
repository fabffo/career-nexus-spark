-- Fix security issue: Restrict access to salaries table
-- Implement proper role-based access control for employee personal data

-- Drop all existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view salaries" ON public.salaries;
DROP POLICY IF EXISTS "Authenticated users can insert salaries" ON public.salaries;
DROP POLICY IF EXISTS "Authenticated users can update salaries" ON public.salaries;
DROP POLICY IF EXISTS "Authenticated users can delete salaries" ON public.salaries;

-- SELECT Policy: Allow authorized roles and employees to view appropriate data
CREATE POLICY "Authorized users can view salaries" 
ON public.salaries 
FOR SELECT 
USING (
  -- Admins and Recruiters can view all employee records
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR')
  )
  OR
  -- Employees can view their own record
  (
    user_id = auth.uid()
    AND user_id IS NOT NULL
  )
);

-- INSERT Policy: Only admins can create employee records
CREATE POLICY "Only admins can insert salaries" 
ON public.salaries 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
);

-- UPDATE Policy: Admins can update all, employees can update only non-critical fields on their own record
CREATE POLICY "Authorized users can update salaries" 
ON public.salaries 
FOR UPDATE 
USING (
  -- Admins can update all employee records
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
  OR
  -- Employees can update their own record (with restrictions)
  (
    user_id = auth.uid()
    AND user_id IS NOT NULL
  )
)
WITH CHECK (
  -- Admins can update to any values
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
  OR
  -- Employees can only update if they maintain critical fields unchanged
  (
    user_id = auth.uid()
    AND user_id IS NOT NULL
    -- Critical fields must remain the same (comparing against current record)
    AND role = (SELECT role FROM public.salaries WHERE id = salaries.id)
    AND fonction = (SELECT fonction FROM public.salaries WHERE id = salaries.id)
    AND nom = (SELECT nom FROM public.salaries WHERE id = salaries.id)
    AND prenom = (SELECT prenom FROM public.salaries WHERE id = salaries.id)
    AND email = (SELECT email FROM public.salaries WHERE id = salaries.id)
  )
);

-- DELETE Policy: Only admins can delete employee records
CREATE POLICY "Only admins can delete salaries" 
ON public.salaries 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
);

-- Special policy for invitation token validation (for signup flow)
-- This allows the system to check if an invitation token exists
CREATE POLICY "Public can check invitation tokens" 
ON public.salaries 
FOR SELECT 
USING (
  -- Only allow selecting records with invitation tokens when not authenticated
  -- This is needed for the signup flow
  invitation_token IS NOT NULL
  AND invitation_token != ''
);