-- Mettre à jour les RDVs existants avec des postes par défaut
-- On assigne le premier poste disponible du client au RDV

UPDATE public.rdvs r
SET poste_id = (
  SELECT p.id 
  FROM public.postes p 
  WHERE p.client_id = r.client_id 
  ORDER BY p.created_at 
  LIMIT 1
)
WHERE r.poste_id IS NULL 
  AND r.client_id IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM public.postes p2 
    WHERE p2.client_id = r.client_id
  );

-- Pour vérifier les mises à jour
SELECT 
  r.id,
  c.raison_sociale as client,
  p.titre as poste,
  r.date
FROM rdvs r
LEFT JOIN clients c ON r.client_id = c.id
LEFT JOIN postes p ON r.poste_id = p.id
ORDER BY r.date DESC;