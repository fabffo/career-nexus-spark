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
  // Mode de filtre: "paiement" ou "effective"
  const [modeFiltre, setModeFiltre] = useState<"paiement" | "effective">("paiement");
  
  // Filtres année/mois
  const [anneeSelectionnee, setAnneeSelectionnee] = useState(new Date().getFullYear());
  const [moisSelectionne, setMoisSelectionne] = useState<number | null>(null);

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

  // Pour le mode paiement, on filtre côté serveur
  // Pour le mode effective, on charge tout et filtre côté client
  const { data: allCharges = [], isLoading } = useQuery({
    queryKey: ["paiements-declarations-charges", modeFiltre === "paiement" ? anneeSelectionnee : null, modeFiltre === "paiement" ? moisSelectionne : null],
    queryFn: async () => {
      let query = supabase
        .from("paiements_declarations_charges")
        .select(`
          *,
          declaration:declarations_charges_sociales(id, nom, organisme, type_charge),
          rapprochement:rapprochements_bancaires(id, transaction_libelle)
        `)
        .order("date_paiement", { ascending: false });

      // Filtrer par date paiement côté serveur uniquement en mode paiement
      if (modeFiltre === "paiement") {
        const debut = moisSelectionne !== null
          ? startOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
          : startOfYear(new Date(anneeSelectionnee, 0, 1));
        const fin = moisSelectionne !== null
          ? endOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
          : endOfYear(new Date(anneeSelectionnee, 11, 31));

        query = query
          .gte("date_paiement", format(debut, "yyyy-MM-dd"))
          .lte("date_paiement", format(fin, "yyyy-MM-dd"));
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Filtrage par date effective (côté client) si mode effective
  const charges = modeFiltre === "effective" 
    ? allCharges.filter((c) => {
        const dateEff = getDateEffective(c.date_paiement, c.declaration?.type_charge);
        const annee = dateEff.getFullYear();
        const mois = dateEff.getMonth();
        
        if (annee !== anneeSelectionnee) return false;
        if (moisSelectionne !== null && mois !== moisSelectionne) return false;
        return true;
      })
    : allCharges;

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
      sortingFn: "datetime",
    },
    {
      id: "date_effective",
      header: "Date effective",
      accessorFn: (row) => getDateEffective(row.date_paiement, row.declaration?.type_charge),
      cell: ({ row }) => {
        const dateEffective = getDateEffective(
          row.original.date_paiement,
          row.original.declaration?.type_charge
        );
        return format(dateEffective, "MMM yyyy", { locale: fr });
      },
      sortingFn: "datetime",
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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="modeFiltre"
                checked={modeFiltre === "paiement"}
                onChange={() => setModeFiltre("paiement")}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Date paiement</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="modeFiltre"
                checked={modeFiltre === "effective"}
                onChange={() => setModeFiltre("effective")}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Date effective</span>
            </label>
          </div>
          <select
            value={anneeSelectionnee}
            onChange={(e) => setAnneeSelectionnee(Number(e.target.value))}
            className="border rounded-md px-3 py-2 bg-background text-sm"
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
            className="border rounded-md px-3 py-2 bg-background text-sm"
          >
            <option value="">Tous les mois</option>
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

      {/* Statistiques générales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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

      {/* Statistiques par type de charge */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        {Object.entries(stats.parType).map(([type, montant]) => (
          <Card key={type} className="p-4">
            <div className="text-sm text-muted-foreground">
              {TYPE_CHARGE_LABELS[type] || type}
            </div>
            <div className="text-xl font-bold">{montant.toFixed(2)} €</div>
          </Card>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={charges || []}
        searchPlaceholder="Rechercher une charge..."
      />
    </div>
  );
}
