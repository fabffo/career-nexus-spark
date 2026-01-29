import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

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

// Fonction utilitaire pour extraire le taux de TVA d'une chaîne
const getTauxTva = (tvaStr: string): number => {
  const tvaLower = tvaStr.toLowerCase().trim();
  
  if (tvaLower.includes('exon')) {
    return 0;
  }
  
  const tvaMatch = tvaStr.match(/(\d+(?:[.,]\d+)?)\s*%?/);
  if (tvaMatch) {
    return parseFloat(tvaMatch[1].replace(',', '.'));
  }
  
  if (tvaLower.includes('normal')) return 20;
  if (tvaLower.includes('reduit') || tvaLower.includes('réduit')) return 5.5;
  if (tvaLower.includes('interm')) return 10;
  if (tvaLower.includes('super')) return 2.1;
  
  return 0;
};

type Paiement = {
  id: string;
  date_paiement: string;
  montant: number;
  notes: string;
  abonnement?: { id: string; nom: string; nature: string; type: string; tva: string | null };
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

// Détermine si c'est un remboursement (crédit)
const isRefund = (paiement: Paiement): boolean => {
  // Si on a les données du rapprochement, on vérifie le crédit
  if (paiement.rapprochement) {
    const credit = Number(paiement.rapprochement.transaction_credit) || 0;
    return credit > 0;
  }
  // Sinon on considère les montants négatifs comme des remboursements
  return Number(paiement.montant) < 0;
};
// Retourne le montant affiché (négatif pour les remboursements)
const getDisplayAmount = (paiement: Paiement): number => {
  const montant = Math.abs(Number(paiement.montant));
  return isRefund(paiement) ? -montant : montant;
};

export default function PaiementsAbonnements() {
  const [anneeSelectionnee, setAnneeSelectionnee] = useState(new Date().getFullYear());
  const [moisSelectionne, setMoisSelectionne] = useState<number | null>(null);

  const debut = moisSelectionne !== null
    ? startOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
    : startOfYear(new Date(anneeSelectionnee, 0, 1));
  const fin = moisSelectionne !== null
    ? endOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
    : endOfYear(new Date(anneeSelectionnee, 11, 31));

  const { data: paiements = [], isLoading } = useQuery({
    queryKey: ["paiements-abonnements", anneeSelectionnee, moisSelectionne],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paiements_abonnements")
        .select(`
          *,
          abonnement:abonnements_partenaires(id, nom, nature, type, tva),
          rapprochement:rapprochements_bancaires(id, transaction_libelle, transaction_credit, transaction_debit, numero_ligne)
        `)
        .gte("date_paiement", format(debut, "yyyy-MM-dd"))
        .lte("date_paiement", format(fin, "yyyy-MM-dd"))
        .order("date_paiement", { ascending: false });

      if (error) throw error;
      
      // Enrichir avec les données TVA de lignes_rapprochement
      const numerosLignes = data
        .filter(p => p.rapprochement?.numero_ligne)
        .map(p => p.rapprochement!.numero_ligne);
      
      if (numerosLignes.length > 0) {
        const { data: lignesData } = await supabase
          .from("lignes_rapprochement")
          .select("numero_ligne, total_ht, total_tva, total_ttc")
          .in("numero_ligne", numerosLignes);
        
        const lignesMap = new Map(
          (lignesData || []).map(l => [l.numero_ligne, l])
        );
        
        return data.map(p => {
          const ligneInfo = p.rapprochement?.numero_ligne 
            ? lignesMap.get(p.rapprochement.numero_ligne)
            : null;
          return {
            ...p,
            stored_total_ht: ligneInfo?.total_ht ?? null,
            stored_total_tva: ligneInfo?.total_tva ?? null,
            stored_total_ttc: ligneInfo?.total_ttc ?? null,
          } as Paiement;
        });
      }
      
      return data as Paiement[];
    },
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
        <div className="flex gap-4">
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
