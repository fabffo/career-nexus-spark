-- Add document_url column to abonnements_partenaires table
ALTER TABLE public.abonnements_partenaires
ADD COLUMN document_url TEXT;

COMMENT ON COLUMN public.abonnements_partenaires.document_url IS 'URL du document associé à l''abonnement';