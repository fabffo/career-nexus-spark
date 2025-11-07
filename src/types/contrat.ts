// Types pour la gestion des contrats
export type ContratType = 'CLIENT' | 'PRESTATAIRE' | 'FOURNISSEUR_SERVICES' | 'FOURNISSEUR_GENERAL' | 'FOURNISSEUR_ETAT_ORGANISME';
export type ContratStatut = 'BROUILLON' | 'ACTIF' | 'TERMINE' | 'ANNULE' | 'ARCHIVE';

export interface Contrat {
  id: string;
  numero_contrat: string;
  type: ContratType;
  statut: ContratStatut;
  date_debut: string;
  date_fin?: string;
  version: string;
  parent_id?: string;
  client_id?: string;
  prestataire_id?: string;
  fournisseur_services_id?: string;
  fournisseur_general_id?: string;
  fournisseur_etat_organisme_id?: string;
  montant?: number;
  description?: string;
  piece_jointe_url?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  // Relations
  client?: any;
  prestataire?: any;
  fournisseur_services?: any;
  fournisseur_general?: any;
  fournisseur_etat_organisme?: any;
  parent?: Contrat;
}

export interface Prestataire {
  id: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  cv_url?: string;
  recommandation_url?: string;
  detail_cv?: string;
  user_id?: string;
  invitation_token?: string;
  invitation_sent_at?: string;
  fournisseur_services_id?: string;
  salarie_id?: string;
  type_prestataire?: 'INDEPENDANT' | 'SOCIETE' | 'SALARIE';
  actif?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FournisseurServices {
  id: string;
  raison_sociale: string;
  secteur_activite?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  site_web?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FournisseurGeneral {
  id: string;
  raison_sociale: string;
  secteur_activite?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  site_web?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FournisseurEtatOrganisme {
  id: string;
  raison_sociale: string;
  secteur_activite?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  site_web?: string;
  created_at?: string;
  updated_at?: string;
}