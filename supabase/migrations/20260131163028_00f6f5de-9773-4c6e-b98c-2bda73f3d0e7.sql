-- Ajout des colonnes détaillées pour l'analyse des bulletins de salaire
ALTER TABLE public.bulletins_salaire
ADD COLUMN IF NOT EXISTS net_avant_impot numeric,
ADD COLUMN IF NOT EXISTS total_urssaf numeric,
ADD COLUMN IF NOT EXISTS total_impots numeric,
ADD COLUMN IF NOT EXISTS total_autres numeric,
ADD COLUMN IF NOT EXISTS cout_employeur numeric,
ADD COLUMN IF NOT EXISTS confidence numeric;

-- Commentaires pour documentation
COMMENT ON COLUMN public.bulletins_salaire.net_avant_impot IS 'Montant net avant prélèvement de l''impôt à la source';
COMMENT ON COLUMN public.bulletins_salaire.total_urssaf IS 'Total des cotisations URSSAF (salariales + patronales)';
COMMENT ON COLUMN public.bulletins_salaire.total_impots IS 'Total des impôts (PAS DGFiP)';
COMMENT ON COLUMN public.bulletins_salaire.total_autres IS 'Total autres contributions (mutuelle, prévoyance, ADESATT...)';
COMMENT ON COLUMN public.bulletins_salaire.cout_employeur IS 'Coût total employeur = brut + charges patronales';
COMMENT ON COLUMN public.bulletins_salaire.confidence IS 'Score de confiance de l''extraction IA (0-1)';