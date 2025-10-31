export type CRAStatut = 'BROUILLON' | 'SOUMIS' | 'VALIDE' | 'REJETE';
export type TypeJour = 
  | 'TRAVAILLE' 
  | 'CONGE_PAYE' 
  | 'RTT' 
  | 'ABSENCE' 
  | 'ARRET_MALADIE' 
  | 'FORMATION' 
  | 'FERIE' 
  | 'WEEKEND';

export interface CRA {
  id: string;
  mission_id: string;
  prestataire_id: string;
  annee: number;
  mois: number;
  statut: CRAStatut;
  jours_travailles: number;
  jours_conges: number;
  jours_absence: number;
  total_heures: number;
  ca_mensuel: number;
  commentaires?: string;
  valide_par?: string;
  date_soumission?: string;
  date_validation?: string;
  commentaires_validation?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  // Relations
  mission?: any;
  prestataire?: any;
  cra_jours?: CRAJour[];
}

export interface CRAJour {
  id: string;
  cra_id: string;
  date: string;
  type_jour: TypeJour;
  heures: number;
  commentaire?: string;
  created_at?: string;
  updated_at?: string;
}

export interface JourFerie {
  id: string;
  date: string;
  libelle: string;
  annee: number;
  created_at?: string;
}

export interface HistoriqueTJM {
  id: string;
  mission_id: string;
  tjm_ancien?: number;
  tjm_nouveau: number;
  date_changement: string;
  motif?: string;
  created_by?: string;
  created_at?: string;
}

export interface PrestataireEnMission {
  id: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  mission?: {
    id: string;
    titre: string;
    tjm?: number;
    date_debut?: string;
    date_fin?: string;
    statut?: string;
    contrat?: {
      client?: {
        raison_sociale: string;
      };
    };
  };
  cra_actuel?: CRA;
}
