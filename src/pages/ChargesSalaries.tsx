import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, getDate } from "date-fns";
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
  // Filtres date paiement
  const [anneePaiement, setAnneePaiement] = useState(new Date().getFullYear());
  const [moisPaiement, setMoisPaiement] = useState<number | null>(null);
  
  // Filtres date effective
  const [anneeEffective, setAnneeEffective] = useState<number | null>(null);
  const [moisEffective, setMoisEffective] = useState<number | null>(null);

  // Calcul de la date effective
  const getDateEffective = (datePaiement: string, typeCharge?: string): Date => {
    const date = new Date(datePaiement);
    const jour = getDate(date);
    
    // Pour RETRAITE: toujours mois précédent
    if (typeCharge === "RETRAITE") {
      return subMonths(date, 1);
    }
    // Pour SALAIRE: si jour entre 1 et 15, mois précédent
    if (typeCharge === "SALAIRE" && jour >= 1 && jour <= 15) {
      return subMonths(date, 1);
    }
    return date;
  };

  const { data: allCharges = [], isLoading } = useQuery({
    queryKey: ["paiements-declarations-charges", anneePaiement, moisPaiement],
    queryFn: async () => {
      const debut = moisPaiement !== null
        ? startOfMonth(new Date(anneePaiement, moisPaiement, 1))
        : startOfYear(new Date(anneePaiement, 0, 1));
      const fin = moisPaiement !== null
        ? endOfMonth(new Date(anneePaiement, moisPaiement, 1))
        : endOfYear(new Date(anneePaiement, 11, 31));

      const { data, error } = await supabase
        .from("paiements_declarations_charges")
        .select(`
          *,
          declaration:declarations_charges_sociales(id, nom, organisme, type_charge),
          rapprochement:rapprochements_bancaires(id, transaction_libelle)
        `)
        .gte("date_paiement", format(debut, "yyyy-MM-dd"))
        .lte("date_paiement", format(fin, "yyyy-MM-dd"))
        .order("date_paiement", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Filtrage par date effective (côté client)
  const charges = allCharges.filter((c) => {
    if (anneeEffective === null) return true;
    
    const dateEff = getDateEffective(c.date_paiement, c.declaration?.type_charge);
    const annee = dateEff.getFullYear();
    const mois = dateEff.getMonth();
    
    if (annee !== anneeEffective) return false;
    if (moisEffective !== null && mois !== moisEffective) return false;
    return true;
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
      header: "Date paiement",
      cell: ({ row }) =>
        format(new Date(row.original.date_paiement), "dd MMM yyyy", { locale: fr }),
    },
    {
      id: "date_effective",
      header: "Date effective",
      cell: ({ row }) => {
        const dateEffective = getDateEffective(
          row.original.date_paiement,
          row.original.declaration?.type_charge
        );
        return format(dateEffective, "MMM yyyy", { locale: fr });
      },
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Charges Salariales</h1>
          <p className="text-muted-foreground mt-1">
            Historique des paiements de déclarations de charges sociales
          </p>
        </div>
        <div className="flex gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">Date paiement</span>
          <div className="flex gap-2">
            <select
              value={anneePaiement}
              onChange={(e) => setAnneePaiement(Number(e.target.value))}
              className="border rounded-md px-3 py-2 bg-background text-sm"
            >
              {[2023, 2024, 2025, 2026].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              value={moisPaiement ?? ""}
              onChange={(e) => setMoisPaiement(e.target.value ? Number(e.target.value) : null)}
              className="border rounded-md px-3 py-2 bg-background text-sm"
            >
              <option value="">Tous</option>
              {[
                { value: 0, label: "Jan" },
                { value: 1, label: "Fév" },
                { value: 2, label: "Mar" },
                { value: 3, label: "Avr" },
                { value: 4, label: "Mai" },
                { value: 5, label: "Juin" },
                { value: 6, label: "Juil" },
                { value: 7, label: "Août" },
                { value: 8, label: "Sep" },
                { value: 9, label: "Oct" },
                { value: 10, label: "Nov" },
                { value: 11, label: "Déc" },
              ].map((mois) => (
                <option key={mois.value} value={mois.value}>
                  {mois.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">Date effective</span>
          <div className="flex gap-2">
            <select
              value={anneeEffective ?? ""}
              onChange={(e) => setAnneeEffective(e.target.value ? Number(e.target.value) : null)}
              className="border rounded-md px-3 py-2 bg-background text-sm"
            >
              <option value="">Toutes</option>
              {[2023, 2024, 2025, 2026].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              value={moisEffective ?? ""}
              onChange={(e) => setMoisEffective(e.target.value ? Number(e.target.value) : null)}
              className="border rounded-md px-3 py-2 bg-background text-sm"
              disabled={anneeEffective === null}
            >
              <option value="">Tous</option>
              {[
                { value: 0, label: "Jan" },
                { value: 1, label: "Fév" },
                { value: 2, label: "Mar" },
                { value: 3, label: "Avr" },
                { value: 4, label: "Mai" },
                { value: 5, label: "Juin" },
                { value: 6, label: "Juil" },
                { value: 7, label: "Août" },
                { value: 8, label: "Sep" },
                { value: 9, label: "Oct" },
                { value: 10, label: "Nov" },
                { value: 11, label: "Déc" },
              ].map((mois) => (
                <option key={mois.value} value={mois.value}>
                  {mois.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total charges</div>
          <div className="text-2xl font-bold">{stats.count}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Montant total</div>
          <div className="text-2xl font-bold">{stats.total.toFixed(2)} €</div>
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
