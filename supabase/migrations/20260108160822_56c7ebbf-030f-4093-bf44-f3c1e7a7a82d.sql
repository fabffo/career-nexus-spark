-- Ajouter la colonne tva à abonnements_partenaires
ALTER TABLE public.abonnements_partenaires 
ADD COLUMN tva text DEFAULT 'normal';

-- Mettre à jour les valeurs existantes selon la nature
UPDATE public.abonnements_partenaires 
SET tva = CASE 
  WHEN nature = 'charges' THEN 'normal'
  ELSE 'exonere'
END;