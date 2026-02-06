export interface Devis {
  id: string;
  numero_devis: string;
  date_emission: string;
  date_echeance: string;
  date_validite?: string;
  emetteur_type: string;
  emetteur_id?: string;
  emetteur_nom: string;
  emetteur_adresse?: string;
  emetteur_telephone?: string;
  emetteur_email?: string;
  destinataire_type: string;
  destinataire_id?: string;
  destinataire_nom: string;
  destinataire_adresse?: string;
  destinataire_telephone?: string;
  destinataire_email?: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  informations_paiement?: string;
  reference_societe?: string;
  statut: 'ENCOURS' | 'REALISE' | 'ANNULE';
  activite?: string;
  facture_id?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  lignes?: DevisLigne[];
}

export interface DevisLigne {
  id?: string;
  devis_id?: string;
  ordre: number;
  description: string;
  quantite: number;
  prix_unitaire_ht: number;
  prix_ht: number;
  taux_tva: number;
  montant_tva?: number;
  prix_ttc?: number;
}
