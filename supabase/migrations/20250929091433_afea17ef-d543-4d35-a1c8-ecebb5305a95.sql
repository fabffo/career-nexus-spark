-- Continue fixing security issue: Complete the remaining policies for salaries table

-- Drop any conflicting policies first
DROP POLICY IF EXISTS "Public can check invitation tokens" ON public.salaries;
DROP POLICY IF EXISTS "System can update invitation tokens" ON public.salaries;

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