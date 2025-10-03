// Types dynamiques - les valeurs sont maintenant gérées dans les tables param_type_mission et param_type_intervenant
export type TypeMission = string;
export type TypeIntervenant = string;
export type StatutMission = 'EN_COURS' | 'TERMINE' | 'ANNULE';

export interface Tva {
  id: string;
  taux: number;
  libelle: string;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Mission {
  id: string;
  numero_mission?: string;
  
  // Liens
  poste_id?: string;
  contrat_id?: string;
  
  // Informations de base
  titre: string;
  description?: string;
  localisation?: string;
  competences?: string[];
  
  // Type de mission et intervenant
  type_mission: TypeMission;
  type_intervenant: TypeIntervenant;
  
  // Intervenants
  prestataire_id?: string;
  salarie_id?: string;
  
  // Informations financières
  prix_ht?: number;
  tva_id?: string;
  taux_tva?: number;
  prix_ttc?: number;
  
  // Spécifique TJM
  tjm?: number;
  nombre_jours?: number;
  
  // Dates
  date_debut?: string;
  date_fin?: string;
  
  // Statut
  statut?: StatutMission;
  
  // Audit
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  
  // Relations
  poste?: any;
  contrat?: any;
  prestataire?: any;
  salarie?: any;
  tva?: Tva;
}