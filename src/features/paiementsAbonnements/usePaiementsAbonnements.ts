import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { PaiementAbonnementRow } from "./types";

type Params = {
  debut: Date;
  fin: Date;
  anneeSelectionnee: number;
  moisSelectionne: number | null;
};

export function usePaiementsAbonnements({
  debut,
  fin,
  anneeSelectionnee,
  moisSelectionne,
}: Params) {
  return useQuery({
    queryKey: ["paiements-abonnements", "lignes_rapprochement", anneeSelectionnee, moisSelectionne],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lignes_rapprochement")
        .select(
          `
          id,
          numero_ligne,
          transaction_date,
          transaction_libelle,
          transaction_credit,
          transaction_debit,
          transaction_montant,
          notes,
          total_ht,
          total_tva,
          total_ttc,
          abonnement:abonnements_partenaires(id, nom, nature, type, tva)
        `,
        )
        // uniquement les lignes liées à un abonnement (inclut les lignes de TVA paramétrées comme abonnement)
        .not("abonnement_id", "is", null)
        .gte("transaction_date", format(debut, "yyyy-MM-dd"))
        .lte("transaction_date", format(fin, "yyyy-MM-dd"))
        .order("transaction_date", { ascending: false });

      if (error) throw error;

      return (data || []).map((lr: any) => {
        const montantRaw =
          lr.total_ttc ??
          (Number(lr.transaction_credit) > 0 ? lr.transaction_credit : lr.transaction_debit) ??
          Math.abs(Number(lr.transaction_montant) || 0);

        return {
          id: lr.id,
          date_paiement: lr.transaction_date,
          montant: Number(montantRaw) || 0,
          notes: lr.notes || "",
          abonnement: lr.abonnement || undefined,
          rapprochement: {
            id: lr.id,
            transaction_libelle: lr.transaction_libelle,
            transaction_credit: lr.transaction_credit,
            transaction_debit: lr.transaction_debit,
            numero_ligne: lr.numero_ligne,
          },
          stored_total_ht: lr.total_ht ?? null,
          stored_total_tva: lr.total_tva ?? null,
          stored_total_ttc: lr.total_ttc ?? null,
        } satisfies PaiementAbonnementRow;
      });
    },
  });
}
