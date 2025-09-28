-- Supprimer le contrat de test et réinitialiser la séquence
DELETE FROM contrats WHERE numero_contrat = '2025-0006';

-- Réinitialiser la séquence à 0 pour que le prochain soit 0001
UPDATE contrat_sequences 
SET last_number = 0, 
    updated_at = NOW() 
WHERE year = 2025;