-- Lier le candidat David Delawe à son compte utilisateur
UPDATE public.candidats 
SET user_id = '8008024e-9145-4cb6-8427-968bf0bcf73d' 
WHERE id = '5c5690c4-c896-4077-ac93-6cd4eee66ab9' AND user_id IS NULL;