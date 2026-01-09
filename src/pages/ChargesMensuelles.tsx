import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

interface ChargeLigne {
  id: string;
  transaction_date: string;
  transaction_libelle: string;
  transaction_montant: number;
  total_ht: number;
  total_ttc: number;
  total_tva: number;
  numero_facture: string | null;
  type: string;
  activite: string;
}

export default function ChargesMensuelles() {
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [availablePeriods, setAvailablePeriods] = useState<{ month: string; year: string }[]>([]);
  const [lignes, setLignes] = useState<ChargeLigne[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Statistiques
  const stats = {
    count: lignes.length,
    totalHt: lignes.reduce((sum, l) => sum + (l.total_ht ?? 0), 0),
    totalTtc: lignes.reduce((sum, l) => sum + (l.total_ttc ?? 0), 0),
    totalTva: lignes.reduce((sum, l) => sum + (l.total_tva ?? 0), 0),
  };

  const columns: ColumnDef<ChargeLigne>[] = [
    {
      accessorKey: "transaction_date",
      header: "Date",
      cell: ({ row }) => 
        row.original.transaction_date 
          ? format(new Date(row.original.transaction_date), "dd MMM yyyy", { locale: fr })
          : "",
      enableSorting: true,
    },
    {
      accessorKey: "transaction_libelle",
      header: "Libellé",
      enableSorting: true,
    },
    {
      accessorKey: "transaction_montant",
      header: "Montant",
      cell: ({ row }) => (
        <span className="font-semibold">
          {new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency: "EUR",
          }).format(row.original.transaction_montant)}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "total_ht",
      header: "HT",
      cell: ({ row }) => {
        const ht = row.original.total_ht;
        return ht !== undefined && ht !== null
          ? new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
            }).format(ht)
          : "—";
      },
      enableSorting: true,
    },
    {
      accessorKey: "total_ttc",
      header: "TTC",
      cell: ({ row }) => {
        const ttc = row.original.total_ttc;
        return ttc !== undefined && ttc !== null
          ? new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
            }).format(ttc)
          : "—";
      },
      enableSorting: true,
    },
    {
      accessorKey: "total_tva",
      header: "TVA",
      cell: ({ row }) => {
        const tva = row.original.total_tva;
        return tva !== undefined && tva !== null
          ? new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
            }).format(tva)
          : "—";
      },
      enableSorting: true,
    },
    {
      accessorKey: "numero_facture",
      header: "Facture",
      cell: ({ row }) => row.original.numero_facture || "facDefaut",
      enableSorting: true,
    },
    {
      accessorKey: "type",
      header: "Type",
      enableSorting: true,
    },
    {
      accessorKey: "activite",
      header: "Activité",
      enableSorting: true,
    },
  ];

  useEffect(() => {
    loadAvailablePeriods();
  }, []);

  useEffect(() => {
    if (selectedMonth && selectedYear) {
      loadData();
    }
  }, [selectedMonth, selectedYear]);

  const loadAvailablePeriods = async () => {
    try {
      // Charger les périodes disponibles depuis charges_mensuelles
      const { data: charges, error } = await supabase
        .from("charges_mensuelles")
        .select("periode_mois, periode_annee")
        .order("periode_annee", { ascending: false })
        .order("periode_mois", { ascending: false });

      if (error) throw error;

      const periods = new Map<string, { month: string; year: string }>();
      charges?.forEach(charge => {
        const month = charge.periode_mois.toString();
        const year = charge.periode_annee.toString();
        const key = `${year}-${month}`;
        if (!periods.has(key)) {
          periods.set(key, { month, year });
        }
      });

      const periodsArray = Array.from(periods.values()).sort((a, b) => {
        if (a.year !== b.year) return parseInt(b.year) - parseInt(a.year);
        return parseInt(b.month) - parseInt(a.month);
      });

      setAvailablePeriods(periodsArray);
      if (periodsArray.length > 0 && !selectedMonth && !selectedYear) {
        setSelectedMonth(periodsArray[0].month);
        setSelectedYear(periodsArray[0].year);
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les périodes disponibles",
        variant: "destructive",
      });
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth);

      // Charger les données depuis la table charges_mensuelles
      const { data, error } = await supabase
        .from("charges_mensuelles")
        .select("*")
        .eq("periode_annee", year)
        .eq("periode_mois", month)
        .order("transaction_date", { ascending: true });

      if (error) throw error;

      const formattedData: ChargeLigne[] = (data || []).map(row => ({
        id: row.id,
        transaction_date: row.transaction_date,
        transaction_libelle: row.transaction_libelle,
        transaction_montant: row.transaction_montant,
        total_ht: row.total_ht || 0,
        total_ttc: row.total_ttc || 0,
        total_tva: row.total_tva || 0,
        numero_facture: row.numero_facture,
        type: row.type,
        activite: row.activite,
      }));

      setLignes(formattedData);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getMonthLabel = (month: string) => {
    const months = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
    return months[parseInt(month) - 1] || month;
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Charges Mensuelles</h1>
          <p className="text-muted-foreground mt-1">
            Charges mensuelles - Type Achat, Activité Généraux
          </p>
        </div>
        <div className="flex gap-4">
          <Select value={`${selectedYear}-${selectedMonth}`} onValueChange={(value) => {
            const [year, month] = value.split("-");
            setSelectedYear(year);
            setSelectedMonth(month);
          }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Sélectionner une période" />
            </SelectTrigger>
            <SelectContent>
              {availablePeriods.map(period => (
                <SelectItem key={`${period.year}-${period.month}`} value={`${period.year}-${period.month}`}>
                  {getMonthLabel(period.month)} {period.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Nombre de lignes</div>
          <div className="text-2xl font-bold">{stats.count}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total HT</div>
          <div className="text-2xl font-bold">
            {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(stats.totalHt)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total TTC</div>
          <div className="text-2xl font-bold">
            {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(stats.totalTtc)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">TVA totale</div>
          <div className="text-2xl font-bold">
            {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(stats.totalTva)}
          </div>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={lignes}
        searchPlaceholder="Rechercher une charge..."
      />
    </div>
  );
}
