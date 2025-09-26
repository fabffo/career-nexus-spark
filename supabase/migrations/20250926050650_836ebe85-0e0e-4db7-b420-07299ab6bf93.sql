-- Corriger le profil existant pour qu'il soit CANDIDAT
UPDATE profiles 
SET role = 'CANDIDAT',
    nom = 'Test',
    prenom = 'Candidat'
WHERE id = '81998802-a5a0-47b0-b6c3-8d8657100793';

-- Associer le candidat au user_id
UPDATE candidats 
SET user_id = '81998802-a5a0-47b0-b6c3-8d8657100793'
WHERE email = 'candidat.test@example.com';