-- Réinitialiser la séquence des contrats pour l'année courante
DELETE FROM public.contrat_sequences WHERE year = 2025;

-- Ou si vous voulez réinitialiser toutes les séquences
TRUNCATE TABLE public.contrat_sequences;