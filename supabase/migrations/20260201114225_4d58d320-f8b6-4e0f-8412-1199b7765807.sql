-- Ajout de la colonne total_retraite pour séparer les cotisations retraite de l'URSSAF
ALTER TABLE public.bulletins_salaire
ADD COLUMN IF NOT EXISTS total_retraite numeric;

COMMENT ON COLUMN public.bulletins_salaire.total_retraite IS 'Total des cotisations retraite (AGIRC-ARRCO, Sécurité Sociale retraite)';