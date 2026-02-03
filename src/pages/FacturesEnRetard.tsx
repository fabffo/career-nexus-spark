import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ColumnDef } from "@tanstack/react-table";
import { format, differenceInDays, parseISO, isAfter, isBefore, isEqual } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, Clock, CalendarX, TrendingDown, RefreshCw, ArrowUpRight, ArrowDownLeft, CalendarIcon, X, Filter, Users } from "lucide-react";
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
  partenaire_id: string | null;
  jours_retard: number;
  tranche_retard: string;
}

interface Client {
  id: string;
  raison_sociale: string;
}

type PartenaireFilter = "TOUS" | "CLIENT" | "FOURNISSEUR_SERVICES" | "FOURNISSEUR_GENERAL" | "PRESTATAIRE" | "SALARIE";

const TRANCHES = ["0 mois (1-30j)", "1 mois (31-60j)", "2 mois (61-90j)", "2+ mois (>90j)"];

const getTrancheRetard = (joursRetard: number): string => {
  if (joursRetard <= 30) return "0 mois (1-30j)";
  if (joursRetard <= 60) return "1 mois (31-60j)";
  if (joursRetard <= 90) return "2 mois (61-90j)";
  return "2+ mois (>90j)";
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
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  
  // Filtres de période
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    type: null,
    debut: undefined,
    fin: undefined,
  });

  // Load clients for filter
  useEffect(() => {
    const loadClients = async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, raison_sociale")
        .order("raison_sociale");
      if (data) setClients(data);
    };
    loadClients();
  }, []);

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
          partenaire_id: f.type_facture === "VENTES" ? f.destinataire_id : f.emetteur_id,
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

    // Filtre par client (uniquement pour ventes)
    if (activeTab === "ventes" && selectedClientIds.length > 0) {
      result = result.filter((f) => f.partenaire_id && selectedClientIds.includes(f.partenaire_id));
    }
    
    // Filtre par date
    result = applyDateFilter(result);
    
    return result;
  }, [facturesActives, filtrePartenaire, dateFilter, activeTab, selectedClientIds]);

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
        return <span>{labels[type] || type}</span>;
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
            facturesFiltrees={facturesFiltrees}
            columns={columns}
            filtrePartenaire={filtrePartenaire}
            setFiltrePartenaire={setFiltrePartenaire}
            typeLabel="Ventes"
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            resetDateFilter={resetDateFilter}
            isDateFilterActive={!!isDateFilterActive}
            showClientFilter={true}
            showPartenaireFilter={false}
            clients={clients}
            selectedClientIds={selectedClientIds}
            setSelectedClientIds={setSelectedClientIds}
          />
        </TabsContent>

        <TabsContent value="achats" className="space-y-6 mt-6">
          <FacturesContent
            stats={stats}
            facturesFiltrees={facturesFiltrees}
            columns={columns}
            filtrePartenaire={filtrePartenaire}
            setFiltrePartenaire={setFiltrePartenaire}
            typeLabel="Achats"
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            resetDateFilter={resetDateFilter}
            isDateFilterActive={!!isDateFilterActive}
            showClientFilter={false}
            showPartenaireFilter={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Extracted content component
interface FacturesContentProps {
  stats: ReturnType<typeof computeStats>;
  facturesFiltrees: FactureEnRetard[];
  columns: ColumnDef<FactureEnRetard>[];
  filtrePartenaire: PartenaireFilter;
  setFiltrePartenaire: (v: PartenaireFilter) => void;
  typeLabel: string;
  dateFilter: DateFilter;
  setDateFilter: (v: DateFilter) => void;
  resetDateFilter: () => void;
  isDateFilterActive: boolean;
  showClientFilter?: boolean;
  showPartenaireFilter?: boolean;
  clients?: Client[];
  selectedClientIds?: string[];
  setSelectedClientIds?: (v: string[]) => void;
}

function FacturesContent({
  stats,
  facturesFiltrees,
  columns,
  filtrePartenaire,
  setFiltrePartenaire,
  typeLabel,
  dateFilter,
  setDateFilter,
  resetDateFilter,
  isDateFilterActive,
  showClientFilter = false,
  showPartenaireFilter = true,
  clients = [],
  selectedClientIds = [],
  setSelectedClientIds,
}: FacturesContentProps) {

  const toggleClient = (clientId: string) => {
    if (!setSelectedClientIds) return;
    if (selectedClientIds.includes(clientId)) {
      setSelectedClientIds(selectedClientIds.filter(id => id !== clientId));
    } else {
      setSelectedClientIds([...selectedClientIds, clientId]);
    }
  };

  const selectAllClients = () => {
    if (!setSelectedClientIds) return;
    setSelectedClientIds(clients.map(c => c.id));
  };

  const clearAllClients = () => {
    if (!setSelectedClientIds) return;
    setSelectedClientIds([]);
  };

  // Calculer les stats par client pour l'onglet Ventes
  const statsParClient = useMemo(() => {
    if (!showClientFilter) return [];
    
    const clientStats: Record<string, { nom: string; count: number; montant: number }> = {};
    
    facturesFiltrees.forEach((f) => {
      if (f.partenaire_id) {
        if (!clientStats[f.partenaire_id]) {
          clientStats[f.partenaire_id] = {
            nom: f.partenaire_nom,
            count: 0,
            montant: 0,
          };
        }
        clientStats[f.partenaire_id].count++;
        clientStats[f.partenaire_id].montant += f.total_ttc;
      }
    });

    return Object.entries(clientStats)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.montant - a.montant);
  }, [facturesFiltrees, showClientFilter]);

  return (
    <>
      {/* KPI par Client - uniquement pour Ventes */}
      {showClientFilter && statsParClient.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Retard par Client</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {statsParClient.map((client) => (
                <div
                  key={client.id}
                  className="flex flex-col p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium text-sm truncate" title={client.nom}>
                    {client.nom}
                  </span>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {client.count} facture{client.count > 1 ? "s" : ""}
                    </span>
                    <span className="text-sm font-semibold text-destructive">
                      {client.montant.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg">Liste des Factures en Retard</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Client multi-select filter - only for Ventes */}
                {showClientFilter && setSelectedClientIds && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[220px] justify-start">
                        <Users className="mr-2 h-4 w-4" />
                        {selectedClientIds.length === 0 
                          ? "Tous les clients" 
                          : selectedClientIds.length === 1 
                            ? clients.find(c => c.id === selectedClientIds[0])?.raison_sociale || "1 client"
                            : `${selectedClientIds.length} clients`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0 bg-background z-50" align="start">
                      <div className="p-2 border-b flex gap-2">
                        <Button variant="outline" size="sm" onClick={selectAllClients} className="flex-1">
                          Tout sélectionner
                        </Button>
                        <Button variant="outline" size="sm" onClick={clearAllClients} className="flex-1">
                          Effacer
                        </Button>
                      </div>
                      <ScrollArea className="h-[250px]">
                        <div className="p-2 space-y-1">
                          {clients.map((client) => (
                            <div
                              key={client.id}
                              className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                              onClick={() => toggleClient(client.id)}
                            >
                              <Checkbox
                                checked={selectedClientIds.includes(client.id)}
                                onCheckedChange={() => toggleClient(client.id)}
                              />
                              <span className="text-sm truncate">{client.raison_sociale}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                )}
                
                {/* Partenaire filter - only for Achats */}
                {showPartenaireFilter && (
                  <Select
                    value={filtrePartenaire}
                    onValueChange={(v) => setFiltrePartenaire(v as PartenaireFilter)}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filtrer par partenaire" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="TOUS">Tous les partenaires</SelectItem>
                      <SelectItem value="FOURNISSEUR_SERVICES">Fournisseurs de services</SelectItem>
                      <SelectItem value="FOURNISSEUR_GENERAL">Fournisseurs généraux</SelectItem>
                      <SelectItem value="PRESTATAIRE">Prestataires</SelectItem>
                      <SelectItem value="SALARIE">Salariés</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
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
                <span className="ml-auto text-sm text-muted-foreground">
                  Filtre actif : {dateFilter.type === "emission" ? "Émission" : "Échéance"}
                  {dateFilter.debut && ` du ${format(dateFilter.debut, "dd/MM/yyyy")}`}
                  {dateFilter.fin && ` au ${format(dateFilter.fin, "dd/MM/yyyy")}`}
                </span>
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
