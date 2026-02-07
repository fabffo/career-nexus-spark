
-- Add tva_id column to contrats table with default to TVA Normale (20%)
ALTER TABLE public.contrats 
ADD COLUMN tva_id UUID REFERENCES public.tva(id);

-- Set default value to TVA Normale for existing and new records
UPDATE public.contrats 
SET tva_id = 'e8357902-a99c-4c97-b0c5-aea42059f735'
WHERE tva_id IS NULL;

-- Set default for future inserts
ALTER TABLE public.contrats 
ALTER COLUMN tva_id SET DEFAULT 'e8357902-a99c-4c97-b0c5-aea42059f735';
