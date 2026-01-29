import type { PaiementAbonnementRow } from "./types";

// Fonction utilitaire pour extraire le taux de TVA d'une chaîne
export const getTauxTva = (tvaStr: string): number => {
  const tvaLower = tvaStr.toLowerCase().trim();

  if (tvaLower.includes("exon")) {
    return 0;
  }

  const tvaMatch = tvaStr.match(/(\d+(?:[.,]\d+)?)\s*%?/);
  if (tvaMatch) {
    return parseFloat(tvaMatch[1].replace(",", "."));
  }

  if (tvaLower.includes("normal")) return 20;
  if (tvaLower.includes("reduit") || tvaLower.includes("réduit")) return 5.5;
  if (tvaLower.includes("interm")) return 10;
  if (tvaLower.includes("super")) return 2.1;

  return 0;
};

// Détermine si c'est un remboursement (crédit)
export const isRefund = (paiement: PaiementAbonnementRow): boolean => {
  if (paiement.rapprochement) {
    const credit = Number(paiement.rapprochement.transaction_credit) || 0;
    return credit > 0;
  }
  return Number(paiement.montant) < 0;
};

// Retourne le montant affiché (négatif pour les remboursements)
export const getDisplayAmount = (paiement: PaiementAbonnementRow): number => {
  const montant = Math.abs(Number(paiement.montant));
  return isRefund(paiement) ? -montant : montant;
};
