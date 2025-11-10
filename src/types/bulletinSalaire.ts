export type BulletinSalaireStatut = 'EN_ATTENTE' | 'ANALYSE_EN_COURS' | 'VALIDE' | 'ERREUR';

export interface BulletinSalaire {
  id: string;
  salarie_id?: string;
  fichier_url: string;
  nom_fichier: string;
  
  // Données extraites
  periode_mois: number;
  periode_annee: number;
  salaire_brut?: number;
  charges_sociales_salariales?: number;
  charges_sociales_patronales?: number;
  impot_source?: number;
  net_a_payer?: number;
  
  // Métadonnées
  statut: BulletinSalaireStatut;
  donnees_brutes?: any;
  erreur_analyse?: string;
  
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  
  // Relations
  salarie?: {
    id: string;
    nom: string;
    prenom: string;
    email?: string;
  };
}

export interface BulletinSalaireCreate {
  salarie_id?: string;
  fichier_url: string;
  nom_fichier: string;
  periode_mois: number;
  periode_annee: number;
  salaire_brut?: number;
  charges_sociales_salariales?: number;
  charges_sociales_patronales?: number;
  impot_source?: number;
  net_a_payer?: number;
  statut?: BulletinSalaireStatut;
  donnees_brutes?: any;
  erreur_analyse?: string;
}

export interface BulletinAnalyseResult {
  nom_salarie?: string;
  periode_mois: number;
  periode_annee: number;
  salaire_brut?: number;
  charges_sociales_salariales?: number;
  charges_sociales_patronales?: number;
  impot_source?: number;
  net_a_payer?: number;
  donnees_brutes?: any;
}
