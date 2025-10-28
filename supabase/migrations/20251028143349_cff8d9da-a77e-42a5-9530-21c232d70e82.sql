-- Ajouter les nouveaux types de règles
ALTER TABLE regles_rapprochement 
DROP CONSTRAINT IF EXISTS regles_rapprochement_type_regle_check;

ALTER TABLE regles_rapprochement 
ADD CONSTRAINT regles_rapprochement_type_regle_check 
CHECK (type_regle IN ('MONTANT', 'DATE', 'LIBELLE', 'TYPE_TRANSACTION', 'PARTENAIRE', 'ABONNEMENT', 'DECLARATION_CHARGE', 'PERSONNALISEE'));