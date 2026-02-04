export type PaiementAbonnementRow = {
  id: string;
  date_paiement: string;
  montant: number;
  notes: string;
  abonnement?: { id: string; nom: string; activite: string | null; type: string; tva: string | null };
  rapprochement?: {
    id: string;
    transaction_libelle: string;
    transaction_credit: number | null;
    transaction_debit: number | null;
    numero_ligne?: string | null;
  };
  // Valeurs TVA stockées depuis lignes_rapprochement
  stored_total_ht?: number | null;
  stored_total_tva?: number | null;
  stored_total_ttc?: number | null;
};
