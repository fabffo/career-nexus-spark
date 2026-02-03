import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { ColumnDef } from "@tanstack/react-table";
import { format, differenceInDays, parseISO, isAfter, isBefore, isEqual } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, Clock, CalendarX, TrendingDown, RefreshCw, ArrowUpRight, ArrowDownLeft, CalendarIcon, X, Filter } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { cn } from "@/lib/utils";

// Types
interface FactureEnRetard {
  id: string;
  numero_facture: string;
  date_emission: string;
  date_echeance: string;
  total_ttc: number;
  statut: string;
  type_facture: string;
  partenaire_nom: string;
  partenaire_type: string;
  jours_retard: number;
  tranche_retard: string;
}

type PartenaireFilter = "TOUS" | "CLIENT" | "FOURNISSEUR_SERVICES" | "FOURNISSEUR_GENERAL" | "PRESTATAIRE" | "SALARIE";

const TRANCHES = ["0 mois (1-30j)", "1 mois (31-60j)", "2 mois (61-90j)", "2+ mois (>90j)"];

const TRANCHE_COLORS: Record<string, string> = {
  "0 mois (1-30j)": "hsl(var(--chart-1))",
  "1 mois (31-60j)": "hsl(var(--chart-2))",
  "2 mois (61-90j)": "hsl(var(--chart-3))",
  "2+ mois (>90j)": "hsl(var(--chart-4))",
};

const getTrancheRetard = (joursRetard: number): string => {
  if (joursRetard <= 30) return "0 mois (1-30j)";
  if (joursRetard <= 60) return "1 mois (31-60j)";
  if (joursRetard <= 90) return "2 mois (61-90j)";
  return "2+ mois (>90j)";
};

const getTrancheColor = (tranche: string): string => {
  switch (tranche) {
    case "0 mois (1-30j)":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case "1 mois (31-60j)":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "2 mois (61-90j)":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "2+ mois (>90j)":
      return "bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const normalizePartenaireType = (type: string): string => {
  const t = type?.toUpperCase() || "";
  if (t.includes("CLIENT")) return "CLIENT";
  if (t.includes("PRESTATAIRE")) return "PRESTATAIRE";
  if (t.includes("SALARIE")) return "SALARIE";
  if (t.includes("FOURNISSEUR_SERVICES") || t === "FOURNISSEUR DE SERVICES") return "FOURNISSEUR_SERVICES";
  if (t.includes("FOURNISSEUR_GENERAL") || t === "FOURNISSEUR GÉNÉRAL" || t === "FOURNISSEUR GENERAUX") return "FOURNISSEUR_GENERAL";
  if (t.includes("FOURNISSEUR")) return "FOURNISSEUR_GENERAL"; // Fallback
  return "AUTRE";
};

// Compute stats for a given list of invoices
const computeStats = (facturesList: FactureEnRetard[]) => {
  const total = facturesList.length;
  const montantTotal = facturesList.reduce((sum, f) => sum + f.total_ttc, 0);

  const parTranche: Record<string, { count: number; montant: number }> = {};
  TRANCHES.forEach((t) => {
    parTranche[t] = { count: 0, montant: 0 };
  });
  facturesList.forEach((f) => {
    parTranche[f.tranche_retard].count++;
    parTranche[f.tranche_retard].montant += f.total_ttc;
  });

  const parPartenaire: Record<string, { count: number; montant: number }> = {
    CLIENT: { count: 0, montant: 0 },
    FOURNISSEUR_SERVICES: { count: 0, montant: 0 },
    FOURNISSEUR_GENERAL: { count: 0, montant: 0 },
    PRESTATAIRE: { count: 0, montant: 0 },
    SALARIE: { count: 0, montant: 0 },
  };
  facturesList.forEach((f) => {
    if (parPartenaire[f.partenaire_type]) {
      parPartenaire[f.partenaire_type].count++;
      parPartenaire[f.partenaire_type].montant += f.total_ttc;
    }
  });

  return { total, montantTotal, parTranche, parPartenaire };
};

// Date filter types
type DateFilterType = "emission" | "echeance" | null;

interface DateFilter {
  type: DateFilterType;
  debut: Date | undefined;
  fin: Date | undefined;
}

export default function FacturesEnRetard() {
  const [loading, setLoading] = useState(true);
  const [factures, setFactures] = useState<FactureEnRetard[]>([]);
  const [filtrePartenaire, setFiltrePartenaire] = useState<PartenaireFilter>("TOUS");
  const [activeTab, setActiveTab] = useState<"ventes" | "achats">("ventes");
  
  // Filtres de période
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    type: null,
    debut: undefined,
    fin: undefined,
  });

  const loadFactures = async () => {
    setLoading(true);
    try {
      const today = new Date();

      // Fetch all invoices that are potentially overdue
      const { data, error } = await supabase
        .from("factures")
        .select("*")
        .is("numero_ligne_rapprochement", null)
        .not("statut", "eq", "BROUILLON")
        .not("statut", "eq", "ANNULEE")
        .not("statut", "eq", "PAYEE")
        .lt("date_echeance", format(today, "yyyy-MM-dd"));

      if (error) throw error;

      const facturesEnRetard: FactureEnRetard[] = (data || []).map((f) => {
        const dateEcheance = parseISO(f.date_echeance);
        const joursRetard = differenceInDays(today, dateEcheance);

        // Determine partner type based on invoice type
        let partenaireNom = "";
        let partenaireType = "";

        if (f.type_facture === "VENTES") {
          partenaireNom = f.destinataire_nom || "N/A";
          partenaireType = normalizePartenaireType(f.destinataire_type || "CLIENT");
        } else {
          partenaireNom = f.emetteur_nom || "N/A";
          partenaireType = normalizePartenaireType(f.emetteur_type || "FOURNISSEUR");
        }

        return {
          id: f.id,
          numero_facture: f.numero_facture,
          date_emission: f.date_emission,
          date_echeance: f.date_echeance,
          total_ttc: f.total_ttc || 0,
          statut: f.statut || "",
          type_facture: f.type_facture,
          partenaire_nom: partenaireNom,
          partenaire_type: partenaireType,
          jours_retard: joursRetard,
          tranche_retard: getTrancheRetard(joursRetard),
        };
      });

      setFactures(facturesEnRetard);
    } catch (err) {
      console.error("Erreur chargement factures en retard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFactures();
  }, []);

  // Separate ventes and achats
  const facturesVentes = useMemo(() => factures.filter((f) => f.type_facture === "VENTES"), [factures]);
  const facturesAchats = useMemo(() => factures.filter((f) => f.type_facture !== "VENTES"), [factures]);

  // Filtered data based on active tab
  const facturesActives = activeTab === "ventes" ? facturesVentes : facturesAchats;

  // Apply date filter helper
  const applyDateFilter = (list: FactureEnRetard[]) => {
    if (!dateFilter.type || (!dateFilter.debut && !dateFilter.fin)) {
      return list;
    }

    return list.filter((f) => {
      const dateToCheck = dateFilter.type === "emission" 
        ? parseISO(f.date_emission) 
        : parseISO(f.date_echeance);

      if (dateFilter.debut && dateFilter.fin) {
        return (isAfter(dateToCheck, dateFilter.debut) || isEqual(dateToCheck, dateFilter.debut)) &&
               (isBefore(dateToCheck, dateFilter.fin) || isEqual(dateToCheck, dateFilter.fin));
      } else if (dateFilter.debut) {
        return isAfter(dateToCheck, dateFilter.debut) || isEqual(dateToCheck, dateFilter.debut);
      } else if (dateFilter.fin) {
        return isBefore(dateToCheck, dateFilter.fin) || isEqual(dateToCheck, dateFilter.fin);
      }
      return true;
    });
  };

  const facturesFiltrees = useMemo(() => {
    let result = facturesActives;
    
    // Filtre par partenaire
    if (filtrePartenaire !== "TOUS") {
      result = result.filter((f) => f.partenaire_type === filtrePartenaire);
    }
    
    // Filtre par date
    result = applyDateFilter(result);
    
    return result;
  }, [facturesActives, filtrePartenaire, dateFilter]);

  // Reset date filter
  const resetDateFilter = () => {
    setDateFilter({ type: null, debut: undefined, fin: undefined });
  };

  // Check if date filter is active
  const isDateFilterActive = dateFilter.type && (dateFilter.debut || dateFilter.fin);

  // Statistics
  const stats = useMemo(() => computeStats(facturesFiltrees), [facturesFiltrees]);
  const statsVentes = useMemo(() => computeStats(facturesVentes), [facturesVentes]);
  const statsAchats = useMemo(() => computeStats(facturesAchats), [facturesAchats]);

  // Chart data
  const pieData = useMemo(() => {
    return TRANCHES.map((t) => ({
      name: t,
      value: stats.parTranche[t].montant,
      count: stats.parTranche[t].count,
    })).filter((d) => d.value > 0);
  }, [stats]);

  const barData = useMemo(() => {
    return Object.entries(stats.parPartenaire).map(([type, data]) => ({
      name: type,
      Montant: data.montant,
      Factures: data.count,
    }));
  }, [stats]);

  // Table columns
  const columns: ColumnDef<FactureEnRetard>[] = [
    {
      accessorKey: "numero_facture",
      header: "N° Facture",
      cell: ({ row }) => <span className="font-medium">{row.original.numero_facture}</span>,
    },
    {
      accessorKey: "partenaire_nom",
      header: "Partenaire",
    },
    {
      accessorKey: "partenaire_type",
      header: "Type Partenaire",
      cell: ({ row }) => {
        const type = row.original.partenaire_type;
        const labels: Record<string, string> = {
          CLIENT: "Client",
          FOURNISSEUR_SERVICES: "Fournisseur services",
          FOURNISSEUR_GENERAL: "Fournisseur général",
          PRESTATAIRE: "Prestataire",
          SALARIE: "Salarié",
        };
        return <Badge variant="outline">{labels[type] || type}</Badge>;
      },
    },
    {
      accessorKey: "date_emission",
      header: "Date Émission",
      cell: ({ row }) => format(parseISO(row.original.date_emission), "dd/MM/yyyy", { locale: fr }),
    },
    {
      accessorKey: "date_echeance",
      header: "Date Échéance",
      cell: ({ row }) => format(parseISO(row.original.date_echeance), "dd/MM/yyyy", { locale: fr }),
    },
    {
      accessorKey: "total_ttc",
      header: "Montant TTC",
      cell: ({ row }) => (
        <span className="font-semibold">
          {row.original.total_ttc.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
        </span>
      ),
    },
    {
      accessorKey: "jours_retard",
      header: "Jours de Retard",
      cell: ({ row }) => (
        <span className="text-destructive font-semibold">{row.original.jours_retard} j</span>
      ),
    },
    {
      accessorKey: "tranche_retard",
      header: "Tranche",
      cell: ({ row }) => <span>{row.original.tranche_retard}</span>,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            Factures en Retard
          </h1>
          <p className="text-muted-foreground">Suivi des factures non payées après échéance</p>
        </div>
        <Button onClick={loadFactures} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "ventes" | "achats")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="ventes" className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4" />
            Ventes ({statsVentes.total})
          </TabsTrigger>
          <TabsTrigger value="achats" className="flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4" />
            Achats ({statsAchats.total})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ventes" className="space-y-6 mt-6">
          <FacturesContent
            stats={stats}
            pieData={pieData}
            barData={barData}
            facturesFiltrees={facturesFiltrees}
            columns={columns}
            filtrePartenaire={filtrePartenaire}
            setFiltrePartenaire={setFiltrePartenaire}
            typeLabel="Ventes"
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            resetDateFilter={resetDateFilter}
            isDateFilterActive={!!isDateFilterActive}
          />
        </TabsContent>

        <TabsContent value="achats" className="space-y-6 mt-6">
          <FacturesContent
            stats={stats}
            pieData={pieData}
            barData={barData}
            facturesFiltrees={facturesFiltrees}
            columns={columns}
            filtrePartenaire={filtrePartenaire}
            setFiltrePartenaire={setFiltrePartenaire}
            typeLabel="Achats"
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            resetDateFilter={resetDateFilter}
            isDateFilterActive={!!isDateFilterActive}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Extracted content component
interface FacturesContentProps {
  stats: ReturnType<typeof computeStats>;
  pieData: { name: string; value: number; count: number }[];
  barData: { name: string; Montant: number; Factures: number }[];
  facturesFiltrees: FactureEnRetard[];
  columns: ColumnDef<FactureEnRetard>[];
  filtrePartenaire: PartenaireFilter;
  setFiltrePartenaire: (v: PartenaireFilter) => void;
  typeLabel: string;
  dateFilter: DateFilter;
  setDateFilter: (v: DateFilter) => void;
  resetDateFilter: () => void;
  isDateFilterActive: boolean;
}

function FacturesContent({
  stats,
  pieData,
  barData,
  facturesFiltrees,
  columns,
  filtrePartenaire,
  setFiltrePartenaire,
  typeLabel,
  dateFilter,
  setDateFilter,
  resetDateFilter,
  isDateFilterActive,
}: FacturesContentProps) {
  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarX className="h-4 w-4" />
              {typeLabel} en Retard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Montant Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats.montantTotal.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Retard &gt; 60 jours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.parTranche["2 mois (61-90j)"].count + stats.parTranche["2+ mois (>90j)"].count}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Retard &gt; 90 jours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.parTranche["2+ mois (>90j)"].count}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart - By Delay Range */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Répartition par Tranche de Retard</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name.split(" ")[0]} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={TRANCHE_COLORS[entry.name] || "#ccc"} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) =>
                      value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Aucune facture en retard
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart - By Partner Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Répartition par Type de Partenaire</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === "Montant"
                      ? value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
                      : value
                  }
                />
                <Legend />
                <Bar dataKey="Montant" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Summary Table by Tranche */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Synthèse par Tranche de Retard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Tranche</th>
                  <th className="text-right py-2 px-4">Nb Factures</th>
                  <th className="text-right py-2 px-4">Montant TTC</th>
                </tr>
              </thead>
              <tbody>
                {TRANCHES.map((tranche) => (
                  <tr key={tranche} className="border-b">
                    <td className="py-2 px-4">{tranche}</td>
                    <td className="text-right py-2 px-4">{stats.parTranche[tranche].count}</td>
                    <td className="text-right py-2 px-4 font-semibold">
                      {stats.parTranche[tranche].montant.toLocaleString("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </td>
                  </tr>
                ))}
                <tr className="font-bold bg-muted/50">
                  <td className="py-2 px-4">Total</td>
                  <td className="text-right py-2 px-4">{stats.total}</td>
                  <td className="text-right py-2 px-4">
                    {stats.montantTotal.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Filter & Data Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Liste des Factures en Retard</CardTitle>
              <Select
                value={filtrePartenaire}
                onValueChange={(v) => setFiltrePartenaire(v as PartenaireFilter)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrer par partenaire" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="TOUS">Tous les partenaires</SelectItem>
                  <SelectItem value="CLIENT">Clients</SelectItem>
                  <SelectItem value="FOURNISSEUR_SERVICES">Fournisseurs de services</SelectItem>
                  <SelectItem value="FOURNISSEUR_GENERAL">Fournisseurs généraux</SelectItem>
                  <SelectItem value="PRESTATAIRE">Prestataires</SelectItem>
                  <SelectItem value="SALARIE">Salariés</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Filters */}
            <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Période :</span>
              </div>

              {/* Type de date */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Type de date</Label>
                <Select
                  value={dateFilter.type || ""}
                  onValueChange={(v) => setDateFilter({ ...dateFilter, type: v as DateFilterType || null })}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="emission">Date d'émission</SelectItem>
                    <SelectItem value="echeance">Date d'échéance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date début */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Du</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[150px] justify-start text-left font-normal",
                        !dateFilter.debut && "text-muted-foreground"
                      )}
                      disabled={!dateFilter.type}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFilter.debut ? format(dateFilter.debut, "dd/MM/yyyy") : "Début"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFilter.debut}
                      onSelect={(date) => setDateFilter({ ...dateFilter, debut: date })}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date fin */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Au</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[150px] justify-start text-left font-normal",
                        !dateFilter.fin && "text-muted-foreground"
                      )}
                      disabled={!dateFilter.type}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFilter.fin ? format(dateFilter.fin, "dd/MM/yyyy") : "Fin"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFilter.fin}
                      onSelect={(date) => setDateFilter({ ...dateFilter, fin: date })}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Reset button */}
              {isDateFilterActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetDateFilter}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Effacer
                </Button>
              )}

              {/* Active filter indicator */}
              {isDateFilterActive && (
                <Badge variant="secondary" className="ml-auto">
                  Filtre actif : {dateFilter.type === "emission" ? "Émission" : "Échéance"}
                  {dateFilter.debut && ` du ${format(dateFilter.debut, "dd/MM/yyyy")}`}
                  {dateFilter.fin && ` au ${format(dateFilter.fin, "dd/MM/yyyy")}`}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={facturesFiltrees} searchPlaceholder="Rechercher une facture..." />
        </CardContent>
      </Card>
    </>
  );
}
