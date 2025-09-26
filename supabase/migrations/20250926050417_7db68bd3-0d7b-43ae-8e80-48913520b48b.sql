-- Créer un compte candidat de test
INSERT INTO candidats (nom, prenom, email, telephone)
VALUES ('Test', 'Candidat', 'candidat.test@example.com', '0600000000')
ON CONFLICT DO NOTHING;