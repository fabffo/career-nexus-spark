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
  
  // Nouveaux champs détaillés
  net_avant_impot?: number;
  total_urssaf?: number;
  total_impots?: number;
  total_autres?: number;
  cout_employeur?: number;
  
  // Métadonnées
  statut: BulletinSalaireStatut;
  donnees_brutes?: any;
  erreur_analyse?: string;
  confidence?: number;
  
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
  
  // Lignes détaillées
  lignes?: BulletinLigne[];
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
  net_avant_impot?: number;
  total_urssaf?: number;
  total_impots?: number;
  total_autres?: number;
  cout_employeur?: number;
  statut?: BulletinSalaireStatut;
  donnees_brutes?: any;
  erreur_analyse?: string;
  confidence?: number;
}

// Types pour les lignes détaillées
export type OrganismeType = 'urssaf' | 'impots' | 'salarie' | 'autre';
export type NatureLigne = 'salariale' | 'patronale' | 'impot';
export type SensLigne = 'deduction' | 'ajout';

export interface BulletinLigne {
  id?: string;
  bulletin_id: string;
  section: string;
  libelle: string;
  base?: number;
  taux?: number;
  montant: number;
  sens: SensLigne;
  nature: NatureLigne;
  organisme_type: OrganismeType;
  organisme_nom?: string;
  raw_text?: string;
  confidence?: number;
  created_at?: string;
}

export interface BulletinAnalyseResult {
  // Informations générales
  nom_salarie?: string;
  periode_mois: number;
  periode_annee: number;
  
  // Totaux extraits du document
  salaire_brut?: number;
  total_cotisations_salariales?: number;
  total_charges_patronales?: number;
  net_avant_impot?: number;
  pas?: number;
  net_paye?: number;
  
  // Totaux recalculés par organisme
  total_urssaf?: number;
  total_impots?: number;
  total_autres?: number;
  total_salarie?: number;
  cout_employeur?: number;
  
  // Lignes détaillées
  lignes?: BulletinLigneExtrait[];
  
  // Métadonnées
  confidence?: number;
  donnees_brutes?: any;
}

export interface BulletinLigneExtrait {
  section: string;
  libelle: string;
  base?: number;
  taux?: number;
  montant: number;
  sens: SensLigne;
  nature: NatureLigne;
  organisme_type: OrganismeType;
  organisme_nom?: string;
  raw_text?: string;
  confidence?: number;
}

// Types pour les réconciliations
export interface BulletinReconciliation {
  bulletin_id: string;
  periode: string;
  net_paye: number;
  total_urssaf: number;
  total_impots: number;
  total_autres: number;
  cout_employeur: number;
  virements_attendus: VirementAttendu[];
}

export interface VirementAttendu {
  organisme_type: OrganismeType;
  organisme_nom: string;
  montant: number;
  periode: string;
}
