import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

const TYPE_CHARGE_LABELS: Record<string, string> = {
  SALAIRE: "Salaire",
  COTISATIONS: "Cotisations",
  CHARGES_PATRONALES: "Charges Patronales",
  AUTRES: "Autres",
};

type Charge = {
  id: string;
  date_paiement: string;
  montant: number;
  notes: string;
  declaration?: { id: string; nom: string; organisme: string; type_charge: string };
  rapprochement?: { id: string; transaction_libelle: string };
};

export default function ChargesSalaries() {
  const { data: charges = [], isLoading } = useQuery({
    queryKey: ["paiements-declarations-charges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paiements_declarations_charges")
        .select(`
          *,
          declaration:declarations_charges_sociales(id, nom, organisme, type_charge),
          rapprochement:rapprochements_bancaires(id, transaction_libelle)
        `)
        .order("date_paiement", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Calculs des statistiques
  const stats = {
    total: charges.reduce((sum, c) => sum + Number(c.montant), 0),
    count: charges.length,
    parType: charges.reduce((acc, c) => {
      const type = c.declaration?.type_charge || "AUTRES";
      acc[type] = (acc[type] || 0) + Number(c.montant);
      return acc;
    }, {} as Record<string, number>),
  };

  const columns: ColumnDef<Charge>[] = [
    {
      accessorKey: "date_paiement",
      header: "Date",
      cell: ({ row }) =>
        format(new Date(row.original.date_paiement), "dd MMM yyyy", { locale: fr }),
    },
    {
      id: "declaration",
      header: "Déclaration",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.declaration?.nom || "-"}</span>
      ),
    },
    {
      id: "organisme",
      header: "Organisme",
      cell: ({ row }) => row.original.declaration?.organisme || "-",
    },
    {
      id: "type_charge",
      header: "Type de charge",
      cell: ({ row }) => {
        const type = row.original.declaration?.type_charge;
        return type ? (
          <Badge variant="outline">
            {TYPE_CHARGE_LABELS[type] || type}
          </Badge>
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
        <span className="text-sm text-muted-foreground">
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
        <h1 className="text-3xl font-bold">Charges Salariales</h1>
        <p className="text-muted-foreground mt-1">
          Historique des paiements de déclarations de charges sociales
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total charges</div>
          <div className="text-2xl font-bold">{stats.count}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Montant total</div>
          <div className="text-2xl font-bold">{stats.total.toFixed(2)} €</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Mois en cours</div>
          <div className="text-2xl font-bold">
            {charges
              .filter(
                (c) =>
                  new Date(c.date_paiement).getMonth() === new Date().getMonth()
              )
              .reduce((sum, c) => sum + Number(c.montant), 0)
              .toFixed(2)}{" "}
            €
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Moyenne / charge</div>
          <div className="text-2xl font-bold">
            {stats.count > 0 ? (stats.total / stats.count).toFixed(2) : "0.00"} €
          </div>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={charges || []}
        searchPlaceholder="Rechercher une charge..."
      />
    </div>
  );
}
