import { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { usePaiementsAbonnements } from "@/features/paiementsAbonnements/usePaiementsAbonnements";
import type { PaiementAbonnementRow as Paiement } from "@/features/paiementsAbonnements/types";
import { getDisplayAmount, getTauxTva, isRefund } from "@/features/paiementsAbonnements/utils";

const NATURE_LABELS: Record<string, string> = {
  RELEVE_BANQUE: "Relevé Banque",
  ASSURANCE: "Assurance",
  LOA_VOITURE: "LOA Voiture",
  LOYER: "Loyer",
  AUTRE: "Autre",
};

const TYPE_LABELS: Record<string, string> = {
  CHARGE: "Charge",
  AUTRE: "Autre",
};

// (Types + helpers déplacés dans src/features/paiementsAbonnements/*)

export default function PaiementsAbonnements() {
  const [anneeSelectionnee, setAnneeSelectionnee] = useState(new Date().getFullYear());
  const [moisSelectionne, setMoisSelectionne] = useState<number | null>(null);
  const [natureFilter, setNatureFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const debut = moisSelectionne !== null
    ? startOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
    : startOfYear(new Date(anneeSelectionnee, 0, 1));
  const fin = moisSelectionne !== null
    ? endOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
    : endOfYear(new Date(anneeSelectionnee, 11, 31));

  const { data: paiementsRaw = [], isLoading } = usePaiementsAbonnements({
    debut,
    fin,
    anneeSelectionnee,
    moisSelectionne,
  });

  // Appliquer les filtres Nature et Type
  const paiements = paiementsRaw.filter((p) => {
    if (natureFilter && p.abonnement?.nature !== natureFilter) return false;
    if (typeFilter && p.abonnement?.type !== typeFilter) return false;
    return true;
  });

  // Calculs des statistiques - tenir compte des remboursements
  const stats = {
    total: paiements.reduce((sum, p) => sum + getDisplayAmount(p), 0),
    totalDebits: paiements.filter(p => !isRefund(p)).reduce((sum, p) => sum + Math.abs(Number(p.montant)), 0),
    totalCredits: paiements.filter(p => isRefund(p)).reduce((sum, p) => sum + Math.abs(Number(p.montant)), 0),
    count: paiements.length,
    countDebits: paiements.filter(p => !isRefund(p)).length,
    countCredits: paiements.filter(p => isRefund(p)).length,
    parNature: paiements.reduce((acc, p) => {
      const nature = p.abonnement?.nature || "AUTRE";
      acc[nature] = (acc[nature] || 0) + getDisplayAmount(p);
      return acc;
    }, {} as Record<string, number>),
  };

  const columns: ColumnDef<Paiement>[] = [
    {
      accessorKey: "date_paiement",
      header: "Date",
      cell: ({ row }) =>
        format(new Date(row.original.date_paiement), "dd MMM yyyy", { locale: fr }),
    },
    {
      id: "abonnement",
      header: "Abonnement",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.abonnement?.nom || "-"}</span>
      ),
    },
    {
      id: "nature",
      header: "Nature",
      cell: ({ row }) => {
        const nature = row.original.abonnement?.nature;
        return nature ? (
          <Badge variant="outline">{NATURE_LABELS[nature]}</Badge>
        ) : null;
      },
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.original.abonnement?.type;
        return type ? (
          <Badge variant="secondary">{TYPE_LABELS[type] || type}</Badge>
        ) : null;
      },
    },
    {
      id: "montant_ht",
      header: "Montant HT",
      cell: ({ row }) => {
        const refund = isRefund(row.original);
        
        // Priorité aux valeurs stockées de lignes_rapprochement
        if (row.original.stored_total_ht !== null && row.original.stored_total_ht !== undefined) {
          const montantHT = Math.abs(Number(row.original.stored_total_ht));
          return (
            <span className={refund ? "text-green-600 font-medium" : ""}>
              {refund ? "+" : ""}{montantHT.toFixed(2)} €
            </span>
          );
        }
        
        // Fallback: calcul dynamique
        const tvaStr = row.original.abonnement?.tva;
        const montantTTC = Math.abs(Number(row.original.montant));
        
        if (!tvaStr) {
          return (
            <span className={refund ? "text-green-600 font-medium" : "text-muted-foreground"}>
              {refund ? "+" : ""}{montantTTC.toFixed(2)} €
            </span>
          );
        }
        
        const tauxTva = getTauxTva(tvaStr);
        const montantHT = montantTTC / (1 + tauxTva / 100);
        
        return (
          <span className={refund ? "text-green-600 font-medium" : ""}>
            {refund ? "+" : ""}{montantHT.toFixed(2)} €
          </span>
        );
      },
    },
    {
      accessorKey: "montant",
      header: "Montant TTC",
      cell: ({ row }) => {
        const displayAmount = getDisplayAmount(row.original);
        const refund = isRefund(row.original);
        return (
          <span className={`font-semibold ${refund ? "text-green-600" : ""}`}>
            {refund ? "+" : ""}{displayAmount.toFixed(2)} €
          </span>
        );
      },
    },
    {
      id: "tva",
      header: "TVA",
      cell: ({ row }) => {
        const refund = isRefund(row.original);
        
        // Priorité aux valeurs stockées de lignes_rapprochement
        if (row.original.stored_total_tva !== null && row.original.stored_total_tva !== undefined) {
          const montantTVA = Math.abs(Number(row.original.stored_total_tva));
          if (montantTVA === 0) return <span className="text-muted-foreground">0,00 €</span>;
          
          const tvaStr = row.original.abonnement?.tva;
          const tauxTva = tvaStr ? getTauxTva(tvaStr) : 20;
          
          return (
            <span className={`text-sm ${refund ? "text-green-600" : ""}`}>
              {refund ? "+" : ""}{montantTVA.toFixed(2)} € <span className="text-muted-foreground">({tauxTva}%)</span>
            </span>
          );
        }
        
        // Fallback: calcul dynamique
        const tvaStr = row.original.abonnement?.tva;
        if (!tvaStr) return <span className="text-muted-foreground">-</span>;
        
        const tauxTva = getTauxTva(tvaStr);
        if (tauxTva === 0) return <span className="text-muted-foreground">0,00 €</span>;
        
        const montantTTC = Math.abs(Number(row.original.montant));
        const montantTVA = montantTTC - (montantTTC / (1 + tauxTva / 100));
        
        return (
          <span className={`text-sm ${refund ? "text-green-600" : ""}`}>
            {refund ? "+" : ""}{montantTVA.toFixed(2)} € <span className="text-muted-foreground">({tauxTva}%)</span>
          </span>
        );
      },
    },
    {
      id: "type_operation",
      header: "Type",
      cell: ({ row }) => {
        const refund = isRefund(row.original);
        return (
          <Badge variant={refund ? "default" : "secondary"} className={refund ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
            {refund ? "Remboursement" : "Paiement"}
          </Badge>
        );
      },
    },
    {
      id: "rapprochement",
      header: "Rapprochement",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground max-w-xs truncate block">
          {row.original.rapprochement?.transaction_libelle || "-"}
        </span>
      ),
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground max-w-xs truncate block">
          {row.original.notes || "-"}
        </span>
      ),
    },
  ];

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Paiements Abonnements</h1>
          <p className="text-muted-foreground mt-1">
            Historique des paiements d'abonnements issus des rapprochements bancaires
          </p>
        </div>
        <div className="flex gap-4 flex-wrap">
          <select
            value={anneeSelectionnee}
            onChange={(e) => setAnneeSelectionnee(Number(e.target.value))}
            className="border rounded-md px-4 py-2 bg-background"
          >
            {[2023, 2024, 2025, 2026].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <select
            value={moisSelectionne ?? ""}
            onChange={(e) => setMoisSelectionne(e.target.value ? Number(e.target.value) : null)}
            className="border rounded-md px-4 py-2 bg-background"
          >
            <option value="">Toute l'année</option>
            {[
              { value: 0, label: "Janvier" },
              { value: 1, label: "Février" },
              { value: 2, label: "Mars" },
              { value: 3, label: "Avril" },
              { value: 4, label: "Mai" },
              { value: 5, label: "Juin" },
              { value: 6, label: "Juillet" },
              { value: 7, label: "Août" },
              { value: 8, label: "Septembre" },
              { value: 9, label: "Octobre" },
              { value: 10, label: "Novembre" },
              { value: 11, label: "Décembre" },
            ].map((mois) => (
              <option key={mois.value} value={mois.value}>
                {mois.label}
              </option>
            ))}
          </select>
          <select
            value={natureFilter ?? ""}
            onChange={(e) => setNatureFilter(e.target.value || null)}
            className="border rounded-md px-4 py-2 bg-background"
          >
            <option value="">Toutes natures</option>
            {Object.entries(NATURE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={typeFilter ?? ""}
            onChange={(e) => setTypeFilter(e.target.value || null)}
            className="border rounded-md px-4 py-2 bg-background"
          >
            <option value="">Tous types</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total paiements</div>
          <div className="text-2xl font-bold">{stats.countDebits}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total remboursements</div>
          <div className="text-2xl font-bold text-green-600">{stats.countCredits}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Montant débité</div>
          <div className="text-2xl font-bold">{stats.totalDebits.toFixed(2)} €</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Montant remboursé</div>
          <div className="text-2xl font-bold text-green-600">+{stats.totalCredits.toFixed(2)} €</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Solde net</div>
          <div className={`text-2xl font-bold ${stats.total < 0 ? "" : "text-green-600"}`}>
            {stats.total.toFixed(2)} €
          </div>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={paiements || []}
        searchPlaceholder="Rechercher un paiement..."
      />
    </div>
  );
}
