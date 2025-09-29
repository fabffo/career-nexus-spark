-- PHASE 1: CRITICAL SECURITY FIXES

-- 1. FIX PROFILES TABLE RLS POLICIES
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create more restrictive policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Admins and recruiters can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
    AND p.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);

-- 2. SECURE THE CANDIDATS TABLE
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view candidats" ON public.candidats;
DROP POLICY IF EXISTS "Authenticated users can insert candidats" ON public.candidats;
DROP POLICY IF EXISTS "Authenticated users can update candidats" ON public.candidats;
DROP POLICY IF EXISTS "Authenticated users can delete candidats" ON public.candidats;

-- Create role-based policies for candidats
CREATE POLICY "Authorized roles can view candidats" 
ON public.candidats 
FOR SELECT 
USING (
  -- Admins, recruiters, and contract managers can view all
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
  OR
  -- Candidates can view their own record
  (user_id = auth.uid() AND user_id IS NOT NULL)
);

CREATE POLICY "Only authorized roles can insert candidats" 
ON public.candidats 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR')
  )
);

CREATE POLICY "Authorized roles can update candidats" 
ON public.candidats 
FOR UPDATE 
USING (
  -- Admins and recruiters can update any candidat
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR')
  )
  OR
  -- Candidates can update their own record (limited fields)
  (user_id = auth.uid() AND user_id IS NOT NULL)
);

CREATE POLICY "Only admins can delete candidats" 
ON public.candidats 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
);

-- 3. SECURE THE CLIENTS TABLE
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON public.clients;

CREATE POLICY "Authorized roles can view clients" 
ON public.clients 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);

CREATE POLICY "Authorized roles can insert clients" 
ON public.clients 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR')
  )
);

CREATE POLICY "Authorized roles can update clients" 
ON public.clients 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR')
  )
);

CREATE POLICY "Only admins can delete clients" 
ON public.clients 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
);

-- 4. SECURE THE POSTES TABLE
DROP POLICY IF EXISTS "Authenticated users can view postes" ON public.postes;
DROP POLICY IF EXISTS "Authenticated users can insert postes" ON public.postes;
DROP POLICY IF EXISTS "Authenticated users can update postes" ON public.postes;
DROP POLICY IF EXISTS "Authenticated users can delete postes" ON public.postes;

CREATE POLICY "Authorized roles can view postes" 
ON public.postes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);

CREATE POLICY "Authorized roles can insert postes" 
ON public.postes 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR')
  )
);

CREATE POLICY "Authorized roles can update postes" 
ON public.postes 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR')
  )
);

CREATE POLICY "Only admins can delete postes" 
ON public.postes 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
);

-- 5. SECURE THE RDVS TABLE
DROP POLICY IF EXISTS "Authenticated users can view rdvs" ON public.rdvs;
DROP POLICY IF EXISTS "Authenticated users can insert rdvs" ON public.rdvs;
DROP POLICY IF EXISTS "Authenticated users can update rdvs" ON public.rdvs;
DROP POLICY IF EXISTS "Authenticated users can delete rdvs" ON public.rdvs;

CREATE POLICY "Authorized users can view rdvs" 
ON public.rdvs 
FOR SELECT 
USING (
  -- Admins, recruiters, and contract managers can view all
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
  OR
  -- Candidates can view their own appointments
  EXISTS (
    SELECT 1 FROM public.candidats
    WHERE candidats.id = rdvs.candidat_id
    AND candidats.user_id = auth.uid()
  )
);

CREATE POLICY "Authorized roles can insert rdvs" 
ON public.rdvs 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR')
  )
);

CREATE POLICY "Authorized roles can update rdvs" 
ON public.rdvs 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR')
  )
);

CREATE POLICY "Only admins can delete rdvs" 
ON public.rdvs 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
);

-- 6. SECURE THE REFERENTS TABLE
DROP POLICY IF EXISTS "Authenticated users can view referents" ON public.referents;
DROP POLICY IF EXISTS "Authenticated users can insert referents" ON public.referents;
DROP POLICY IF EXISTS "Authenticated users can update referents" ON public.referents;
DROP POLICY IF EXISTS "Authenticated users can delete referents" ON public.referents;

CREATE POLICY "Authorized roles can view referents" 
ON public.referents 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);

CREATE POLICY "Authorized roles can insert referents" 
ON public.referents 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR')
  )
);

CREATE POLICY "Authorized roles can update referents" 
ON public.referents 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR')
  )
);

CREATE POLICY "Only admins can delete referents" 
ON public.referents 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
);

-- 7. SECURE THE RDV_REFERENTS TABLE
DROP POLICY IF EXISTS "Authenticated users can view rdv_referents" ON public.rdv_referents;
DROP POLICY IF EXISTS "Authenticated users can insert rdv_referents" ON public.rdv_referents;
DROP POLICY IF EXISTS "Authenticated users can update rdv_referents" ON public.rdv_referents;
DROP POLICY IF EXISTS "Authenticated users can delete rdv_referents" ON public.rdv_referents;

CREATE POLICY "Authorized roles can view rdv_referents" 
ON public.rdv_referents 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR', 'CONTRAT')
  )
);

CREATE POLICY "Authorized roles can manage rdv_referents" 
ON public.rdv_referents 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'RECRUTEUR')
  )
);

-- 8. SECURE FOURNISSEURS TABLES
-- Fournisseurs généraux
DROP POLICY IF EXISTS "Authenticated users can view fournisseurs_generaux" ON public.fournisseurs_generaux;
DROP POLICY IF EXISTS "Authenticated users can insert fournisseurs_generaux" ON public.fournisseurs_generaux;
DROP POLICY IF EXISTS "Authenticated users can update fournisseurs_generaux" ON public.fournisseurs_generaux;
DROP POLICY IF EXISTS "Authenticated users can delete fournisseurs_generaux" ON public.fournisseurs_generaux;

CREATE POLICY "Authorized roles can view fournisseurs_generaux" 
ON public.fournisseurs_generaux 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'CONTRAT')
  )
);

CREATE POLICY "Authorized roles can manage fournisseurs_generaux" 
ON public.fournisseurs_generaux 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'CONTRAT')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'CONTRAT')
  )
);

-- Fournisseurs services
DROP POLICY IF EXISTS "Authenticated users can view fournisseurs_services" ON public.fournisseurs_services;
DROP POLICY IF EXISTS "Authenticated users can insert fournisseurs_services" ON public.fournisseurs_services;
DROP POLICY IF EXISTS "Authenticated users can update fournisseurs_services" ON public.fournisseurs_services;
DROP POLICY IF EXISTS "Authenticated users can delete fournisseurs_services" ON public.fournisseurs_services;

CREATE POLICY "Authorized roles can view fournisseurs_services" 
ON public.fournisseurs_services 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'CONTRAT')
  )
);

CREATE POLICY "Authorized roles can manage fournisseurs_services" 
ON public.fournisseurs_services 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'CONTRAT')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('ADMIN', 'CONTRAT')
  )
);