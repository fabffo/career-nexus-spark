-- ============================================
-- CRITICAL SECURITY FIX 1: Separate User Roles Table
-- ============================================

-- Create app_role enum if not exists
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('ADMIN', 'RECRUTEUR', 'CONTRAT', 'CANDIDAT', 'PRESTATAIRE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role, created_at)
SELECT id, role::text::app_role, created_at
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Only admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'))
WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

-- ============================================
-- CRITICAL SECURITY FIX 2: Fix two_factor_codes RLS
-- ============================================

-- Drop the dangerous INSERT policy
DROP POLICY IF EXISTS "Users can insert their own 2FA codes" ON public.two_factor_codes;

-- Keep only SELECT policy (UPDATE already exists, no DELETE needed)
CREATE POLICY "Users can view own 2FA codes"
ON public.two_factor_codes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- CRITICAL SECURITY FIX 3: Secure Candidate Invitations
-- ============================================

-- Drop the public access policy
DROP POLICY IF EXISTS "Public can view candidat with valid invitation token" ON public.candidats;

-- Add expiration column for invitation tokens
ALTER TABLE public.candidats 
ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP WITH TIME ZONE;

-- Set expiration for existing tokens (7 days from sent date, or 7 days from now if no sent date)
UPDATE public.candidats
SET invitation_expires_at = COALESCE(invitation_sent_at + INTERVAL '7 days', NOW() + INTERVAL '7 days')
WHERE invitation_token IS NOT NULL 
  AND user_id IS NULL 
  AND invitation_expires_at IS NULL;

-- Add column for tracking token usage
ALTER TABLE public.candidats
ADD COLUMN IF NOT EXISTS invitation_used_at TIMESTAMP WITH TIME ZONE;

-- Create similar fixes for prestataires and salaries tables
ALTER TABLE public.prestataires
ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invitation_used_at TIMESTAMP WITH TIME ZONE;

UPDATE public.prestataires
SET invitation_expires_at = COALESCE(invitation_sent_at + INTERVAL '7 days', NOW() + INTERVAL '7 days')
WHERE invitation_token IS NOT NULL 
  AND user_id IS NULL 
  AND invitation_expires_at IS NULL;

ALTER TABLE public.salaries
ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invitation_used_at TIMESTAMP WITH TIME ZONE;

UPDATE public.salaries
SET invitation_expires_at = COALESCE(invitation_sent_at + INTERVAL '7 days', NOW() + INTERVAL '7 days')
WHERE invitation_token IS NOT NULL 
  AND user_id IS NULL 
  AND invitation_expires_at IS NULL;

-- ============================================
-- CRITICAL SECURITY FIX 4: Add Rate Limiting Table
-- ============================================

-- Create rate limiting table for 2FA attempts
CREATE TABLE IF NOT EXISTS public.rate_limit_2fa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- Can be IP or user_id
  attempt_type TEXT NOT NULL, -- 'send_code', 'verify_code', 'check_device'
  attempts INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(identifier, attempt_type)
);

-- Enable RLS (service role only)
ALTER TABLE public.rate_limit_2fa ENABLE ROW LEVEL SECURITY;

-- No policies needed - only service role can access

-- Create function to check and update rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _identifier TEXT,
  _attempt_type TEXT,
  _max_attempts INTEGER DEFAULT 5,
  _window_minutes INTEGER DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_record RECORD;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_result jsonb;
BEGIN
  -- Get or create rate limit record
  SELECT * INTO v_record
  FROM public.rate_limit_2fa
  WHERE identifier = _identifier
    AND attempt_type = _attempt_type;
  
  -- Check if blocked
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'blocked_until', v_record.blocked_until,
      'message', 'Too many attempts. Please try again later.'
    );
  END IF;
  
  -- Check if window expired (reset counter)
  IF v_record.window_start IS NULL OR (v_now - v_record.window_start) > (INTERVAL '1 minute' * _window_minutes) THEN
    -- Reset window
    UPDATE public.rate_limit_2fa
    SET attempts = 1,
        window_start = v_now,
        blocked_until = NULL
    WHERE identifier = _identifier AND attempt_type = _attempt_type;
    
    RETURN jsonb_build_object('allowed', true, 'remaining', _max_attempts - 1);
  END IF;
  
  -- Increment attempts
  IF v_record.attempts >= _max_attempts THEN
    -- Block for 15 minutes
    UPDATE public.rate_limit_2fa
    SET blocked_until = v_now + INTERVAL '15 minutes'
    WHERE identifier = _identifier AND attempt_type = _attempt_type;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'blocked_until', v_now + INTERVAL '15 minutes',
      'message', 'Too many attempts. Blocked for 15 minutes.'
    );
  ELSE
    -- Increment
    UPDATE public.rate_limit_2fa
    SET attempts = attempts + 1
    WHERE identifier = _identifier AND attempt_type = _attempt_type;
    
    RETURN jsonb_build_object('allowed', true, 'remaining', _max_attempts - v_record.attempts - 1);
  END IF;
  
  -- If no record exists, create one
  IF v_record IS NULL THEN
    INSERT INTO public.rate_limit_2fa (identifier, attempt_type, attempts, window_start)
    VALUES (_identifier, _attempt_type, 1, v_now);
    
    RETURN jsonb_build_object('allowed', true, 'remaining', _max_attempts - 1);
  END IF;
END;
$$;