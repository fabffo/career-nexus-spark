import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
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

type Paiement = {
  id: string;
  date_paiement: string;
  montant: number;
  notes: string;
  abonnement?: { id: string; nom: string; nature: string; type: string };
  rapprochement?: { id: string; transaction_libelle: string };
};

export default function PaiementsAbonnements() {
  const { data: paiements = [], isLoading } = useQuery({
    queryKey: ["paiements-abonnements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paiements_abonnements")
        .select(`
          *,
          abonnement:abonnements_partenaires(id, nom, nature, type),
          rapprochement:rapprochements_bancaires(id, transaction_libelle)
        `)
        .order("date_paiement", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Calculs des statistiques
  const stats = {
    total: paiements.reduce((sum, p) => sum + Number(p.montant), 0),
    count: paiements.length,
    parNature: paiements.reduce((acc, p) => {
      const nature = p.abonnement?.nature || "AUTRE";
      acc[nature] = (acc[nature] || 0) + Number(p.montant);
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
      accessorKey: "montant",
      header: "Montant",
      cell: ({ row }) => (
        <span className="font-semibold">{Number(row.original.montant).toFixed(2)} €</span>
      ),
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Paiements Abonnements</h1>
        <p className="text-muted-foreground mt-1">
          Historique des paiements d'abonnements issus des rapprochements bancaires
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total paiements</div>
          <div className="text-2xl font-bold">{stats.count}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Montant total</div>
          <div className="text-2xl font-bold">{stats.total.toFixed(2)} €</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Mois en cours</div>
          <div className="text-2xl font-bold">
            {paiements
              .filter(
                (p) =>
                  new Date(p.date_paiement).getMonth() === new Date().getMonth()
              )
              .reduce((sum, p) => sum + Number(p.montant), 0)
              .toFixed(2)}{" "}
            €
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Moyenne / paiement</div>
          <div className="text-2xl font-bold">
            {stats.count > 0 ? (stats.total / stats.count).toFixed(2) : "0.00"} €
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
