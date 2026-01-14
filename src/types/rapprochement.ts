// Types pour le système de rapprochement bancaire

// Statuts des fichiers de rapprochement
export type StatutFichierRapprochement = 'EN_COURS' | 'VALIDE' | 'ARCHIVE';

// Statuts des rapprochements individuels
export type StatutRapprochement = 'EN_ATTENTE' | 'RAPPROCHE' | 'PARTIEL' | 'IGNORE';

// Type de rapprochement
export type TypeRapprochement = 'FACTURE' | 'ABONNEMENT' | 'DECLARATION_CHARGE' | 'MULTIPLE';

// Types de factures supportés
export type TypeFacture = 'VENTES' | 'ACHATS' | 'ACHATS_GENERAUX' | 'ACHATS_SERVICES' | 'ACHATS_ETAT';

// Structure d'une transaction bancaire dans le fichier_data
export interface TransactionBancaire {
  numero_ligne: string; // Format: RL-YYYYMMDD-XXXXX
  date: string;
  libelle: string;
  debit: number;
  credit: number;
  montant: number;
  statut: StatutRapprochement;
  facture_id?: string;
  numero_facture?: string;
  abonnement_id?: string;
  declaration_charge_id?: string;
  notes?: string;
  factures_ids?: string[]; // Pour les rapprochements multiples
}

// Structure du fichier de rapprochement
export interface FichierRapprochement {
  id: string;
  numero_rapprochement: string; // Format: RAP-YYMM-NN
  date_debut: string;
  date_fin: string;
  fichier_data: {
    transactions: TransactionBancaire[];
  };
  total_lignes: number;
  lignes_rapprochees: number;
  statut: StatutFichierRapprochement;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Structure d'un rapprochement bancaire
export interface RapprochementBancaire {
  id: string;
  numero_ligne: string;
  transaction_date: string;
  transaction_libelle: string;
  transaction_debit: number;
  transaction_credit: number;
  transaction_montant: number;
  facture_id?: string;
  abonnement_id?: string;
  declaration_charge_id?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Structure pour l'affichage des factures dans les dialogues
export interface FactureMatch {
  id: string;
  numero_facture: string;
  date_facture: string;
  date_echeance?: string;
  montant_ht: number;
  montant_ttc: number;
  type_facture: 'VENTE' | 'ACHAT';
  client_id?: string;
  fournisseur_id?: string;
  client?: {
    raison_sociale: string;
  };
  fournisseur_general?: {
    raison_sociale: string;
  };
  fournisseur_services?: {
    raison_sociale: string;
  };
  fournisseur_etat?: {
    raison_sociale: string;
  };
  statut_paiement: string;
  numero_rapprochement?: string;
  numero_ligne_rapprochement?: string;
}

// Structure pour l'affichage dans les dialogues de rapprochement
export interface Rapprochement {
  id: string;
  numero_ligne: string;
  transaction: TransactionBancaire;
  selectedFactureIds: string[];
  status: StatutRapprochement;
  notes?: string;
}

// Structure d'une règle de rapprochement automatique
export interface RegleRapprochement {
  id: string;
  nom: string;
  type_transaction: 'DEBIT' | 'CREDIT' | 'TOUS';
  mots_cles: string[];
  type_rapprochement: 'FACTURE' | 'ABONNEMENT' | 'DECLARATION_CHARGE';
  fournisseur_id?: string;
  abonnement_id?: string;
  declaration_charge_id?: string;
  actif: boolean;
  priorite: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Structure pour les paiements d'abonnements
export interface PaiementAbonnement {
  id: string;
  abonnement_id: string;
  rapprochement_id?: string;
  date_paiement: string;
  montant: number;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Structure pour les consommations d'abonnements
export interface ConsommationAbonnement {
  id: string;
  abonnement_id: string;
  rapprochement_id?: string;
  libelle: string;
  description?: string;
  date_consommation: string;
  montant: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Structure pour les paiements de déclarations de charges
export interface PaiementDeclarationCharge {
  id: string;
  declaration_charge_id: string;
  rapprochement_id?: string;
  date_paiement: string;
  montant: number;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Structure pour l'historique de rapprochement d'une facture
export interface RapprochementInfo {
  id: string;
  date: string;
  libelle: string;
  debit: number;
  credit: number;
  montant: number;
  fichierRapprochement: string;
  notes?: string;
  facturesAssociees: Array<{
    numero_facture: string;
    montant_ttc: number;
  }>;
}

// Props pour les dialogues
export interface RapprochementManuelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionBancaire;
  factures: FactureMatch[];
  onSuccess: () => void;
}

export interface EditRapprochementEnCoursDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rapprochement: Rapprochement;
  factures: FactureMatch[];
  onStatusChange: (id: string, status: StatutRapprochement) => void;
  onFactureSelection: (id: string, factureIds: string[]) => void;
  onNotesChange: (id: string, notes: string) => void;
}

export interface EditRapprochementHistoriqueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionBancaire;
  factures: FactureMatch[];
  onSuccess: () => void;
}

export interface FactureRapprochementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factureId: string;
  factureNumero: string;
  onSuccess?: () => void;
}
