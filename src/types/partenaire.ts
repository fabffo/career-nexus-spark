// Types de partenaires uniformisés
// Ces types doivent être utilisés partout dans l'application pour assurer la cohérence

export type PartenaireType = 
  | 'CLIENT'
  | 'PRESTATAIRE'
  | 'SALARIE'
  | 'BANQUE'
  | 'FOURNISSEUR_GENERAL'
  | 'FOURNISSEUR_SERVICES'
  | 'FOURNISSEUR_ETAT_ORGANISME';

// Mapping entre type d'achat et type de fournisseur
// Si Fournisseur issu d'achat de type services -> FOURNISSEUR_SERVICES
// Si Fournisseur issu d'achat de type généraux -> FOURNISSEUR_GENERAL
export const ACHAT_TYPE_TO_FOURNISSEUR_TYPE: Record<string, PartenaireType> = {
  'services': 'FOURNISSEUR_SERVICES',
  'SERVICES': 'FOURNISSEUR_SERVICES',
  'general': 'FOURNISSEUR_GENERAL',
  'GENERAL': 'FOURNISSEUR_GENERAL',
  'generaux': 'FOURNISSEUR_GENERAL',
  'GENERAUX': 'FOURNISSEUR_GENERAL',
};

// Tables de base de données correspondantes pour chaque type de partenaire
export const PARTENAIRE_TABLE_MAP: Record<PartenaireType, string> = {
  'CLIENT': 'clients',
  'PRESTATAIRE': 'prestataires',
  'SALARIE': 'salaries',
  'BANQUE': 'banques',
  'FOURNISSEUR_GENERAL': 'fournisseurs_generaux',
  'FOURNISSEUR_SERVICES': 'fournisseurs_services',
  'FOURNISSEUR_ETAT_ORGANISME': 'fournisseurs_etat_organismes',
};

// Champ pour le nom dans chaque table
export const PARTENAIRE_NOM_FIELD: Record<PartenaireType, 'raison_sociale' | 'nom'> = {
  'CLIENT': 'raison_sociale',
  'PRESTATAIRE': 'nom',
  'SALARIE': 'nom',
  'BANQUE': 'raison_sociale',
  'FOURNISSEUR_GENERAL': 'raison_sociale',
  'FOURNISSEUR_SERVICES': 'raison_sociale',
  'FOURNISSEUR_ETAT_ORGANISME': 'raison_sociale',
};

// Labels pour l'affichage
export const PARTENAIRE_LABELS: Record<PartenaireType, string> = {
  'CLIENT': 'Client',
  'PRESTATAIRE': 'Prestataire',
  'SALARIE': 'Salarié',
  'BANQUE': 'Banque',
  'FOURNISSEUR_GENERAL': 'Fournisseur général',
  'FOURNISSEUR_SERVICES': 'Fournisseur de services',
  'FOURNISSEUR_ETAT_ORGANISME': 'Fournisseur État & organismes',
};

// Helper pour obtenir le type de fournisseur à partir du type d'achat
export function getFournisseurTypeFromAchatType(achatType: string): PartenaireType {
  return ACHAT_TYPE_TO_FOURNISSEUR_TYPE[achatType] || 'FOURNISSEUR_GENERAL';
}
