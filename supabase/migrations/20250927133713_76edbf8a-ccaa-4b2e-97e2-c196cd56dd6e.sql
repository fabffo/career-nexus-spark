-- Create table for email history
CREATE TABLE public.email_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  email_type TEXT NOT NULL, -- 'invitation_user', 'invitation_candidat', 'teams_invitation'
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'pending'
  error_message TEXT,
  metadata JSONB, -- Additional data like candidat_id, rdv_id, etc.
  sent_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_history ENABLE ROW LEVEL SECURITY;

-- Create policies (only admins can view email history)
CREATE POLICY "Admins can view email history" 
ON public.email_history 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
);

-- Create policy for system to insert email history
CREATE POLICY "System can insert email history" 
ON public.email_history 
FOR INSERT 
WITH CHECK (true);

-- Create index for better performance
CREATE INDEX idx_email_history_created_at ON public.email_history(created_at DESC);
CREATE INDEX idx_email_history_email_type ON public.email_history(email_type);
CREATE INDEX idx_email_history_status ON public.email_history(status);