import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, TrendingDown, Eye, Pencil, Trash2, Download, Sparkles, UserPlus, CheckCircle2, AlertCircle, Link } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AddFactureAchatDialog from "@/components/AddFactureAchatDialog";
import ExtractionFactureDialog from "@/components/ExtractionFactureDialog";
import EditFactureAchatDialog from "@/components/EditFactureAchatDialog";
import ViewFactureDialog from "@/components/ViewFactureDialog";
import CreateFournisseurQuickDialog from "@/components/CreateFournisseurQuickDialog";
import FactureRapprochementDialog from "@/components/FactureRapprochementDialog";
import RapprochementDetailDialog from "@/components/RapprochementDetailDialog";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface Facture {
  id: string;
  numero_facture: string;
  type_facture: "VENTES" | "ACHATS";
  date_emission: string;
  date_echeance: string;
  emetteur_type: string;
  emetteur_id?: string;
  emetteur_nom: string;
  emetteur_adresse?: string;
  emetteur_telephone?: string;
  emetteur_email?: string;
  destinataire_type: string;
  destinataire_id?: string;
  destinataire_nom: string;
  destinataire_adresse?: string;
  destinataire_telephone?: string;
  destinataire_email?: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  informations_paiement?: string;
  reference_societe?: string;
  statut: "BROUILLON" | "VALIDEE" | "PAYEE" | "ANNULEE";
  created_at: string;
  updated_at: string;
  created_by?: string;
  facture_url?: string;
  numero_rapprochement?: string;
  date_rapprochement?: string;
  numero_ligne_rapprochement?: string;
}

export default function FacturesAchats() {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(false);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [openExtractionDialog, setOpenExtractionDialog] = useState(false);
  const [openCreateFournisseur, setOpenCreateFournisseur] = useState(false);
  const [openRapprochementDialog, setOpenRapprochementDialog] = useState(false);
  const [openDetailRapprochementDialog, setOpenDetailRapprochementDialog] = useState(false);
  const [selectedNumeroLigne, setSelectedNumeroLigne] = useState<string>("");
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null);
  const [fournisseurInitialData, setFournisseurInitialData] = useState<{
    raison_sociale?: string;
    adresse?: string;
    telephone?: string;
    email?: string;
  } | undefined>(undefined);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedTypeFournisseur, setSelectedTypeFournisseur] = useState<string>("all");
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedFactureIds, setSelectedFactureIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [existingFournisseurs, setExistingFournisseurs] = useState<Set<string>>(new Set());
  const [fournisseurTypesMap, setFournisseurTypesMap] = useState<Map<string, string>>(new Map());
  const [stats, setStats] = useState({
    totalFactures: 0,
    totalHT: 0,
    totalTTC: 0,
    totalPayees: 0,
    totalEnAttente: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchFactures();
    fetchFournisseurs();
  }, [selectedYear, selectedMonth]);

  const fetchFournisseurs = async () => {
    try {
      // Récupérer les fournisseurs de services
      const { data: services } = await supabase
        .from("fournisseurs_services")
        .select("raison_sociale");
      
      // Récupérer les fournisseurs généraux
      const { data: generaux } = await supabase
        .from("fournisseurs_generaux")
        .select("raison_sociale");

      // Récupérer les fournisseurs État & organismes
      const { data: etatOrganismes } = await supabase
        .from("fournisseurs_etat_organismes")
        .select("raison_sociale");

      const fournisseursSet = new Set<string>();
      const typesMap = new Map<string, string>();
      
      services?.forEach(f => {
        if (f.raison_sociale) {
          const key = f.raison_sociale.toLowerCase().trim();
          fournisseursSet.add(key);
          typesMap.set(key, "SERVICES");
        }
      });
      
      generaux?.forEach(f => {
        if (f.raison_sociale) {
          const key = f.raison_sociale.toLowerCase().trim();
          fournisseursSet.add(key);
          typesMap.set(key, "GENERAUX");
        }
      });

      etatOrganismes?.forEach(f => {
        if (f.raison_sociale) {
          const key = f.raison_sociale.toLowerCase().trim();
          fournisseursSet.add(key);
          typesMap.set(key, "ETAT_ORGANISMES");
        }
      });

      setExistingFournisseurs(fournisseursSet);
      setFournisseurTypesMap(typesMap);
    } catch (error) {
      console.error("Erreur lors du chargement des fournisseurs:", error);
    }
  };

  const fetchFactures = async () => {
    setLoading(true);
    try {
      let query = supabase.from("factures").select("*").eq("type_facture", "ACHATS");

      // Filtrer par année et mois si sélectionné
      if (selectedYear !== "all") {
        const yearNum = parseInt(selectedYear);

        if (selectedMonth !== "all") {
          // Filtrer par année ET mois
          const monthNum = parseInt(selectedMonth);
          const startDate = `${yearNum}-${monthNum.toString().padStart(2, '0')}-01`;
          const lastDay = new Date(yearNum, monthNum, 0).getDate();
          const endDate = `${yearNum}-${monthNum.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
          query = query.gte("date_emission", startDate).lte("date_emission", endDate);
        } else {
          // Filtrer par année uniquement
          const startDate = `${yearNum}-01-01`;
          const endDate = `${yearNum}-12-31`;
          query = query.gte("date_emission", startDate).lte("date_emission", endDate);
        }
      }

      const { data, error } = await query.order("date_emission", { ascending: false });

      if (error) throw error;

      const facturesData = (data || []).map((f) => ({
        ...f,
        type_facture: f.type_facture as "VENTES" | "ACHATS",
        statut: f.statut as "BROUILLON" | "VALIDEE" | "PAYEE" | "ANNULEE",
      }));

      // Extraire les années disponibles
      const years = new Set<string>();
      facturesData.forEach((f) => {
        if (f.date_emission) {
          const year = new Date(f.date_emission).getFullYear().toString();
          years.add(year);
        }
      });
      setAvailableYears(Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)));

      setFactures(facturesData);

      // Calculer les statistiques
      const totalHT = facturesData.reduce((sum, f) => sum + (f.total_ht || 0), 0);
      const totalTTC = facturesData.reduce((sum, f) => sum + (f.total_ttc || 0), 0);
      const totalPayees = facturesData.filter((f) => f.statut === "PAYEE").length;
      const totalEnAttente = facturesData.filter((f) => f.statut === "VALIDEE").length;

      setStats({
        totalFactures: facturesData.length,
        totalHT,
        totalTTC,
        totalPayees,
        totalEnAttente,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les factures d'achat",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette facture ?")) return;

    try {
      // Récupérer la facture pour supprimer le fichier associé
      const facture = factures.find((f) => f.id === id);

      // Supprimer le fichier du storage si présent
      if (facture?.reference_societe) {
        try {
          let bucket = "factures";
          let filePath = facture.reference_societe;

          // Gérer les anciens formats d'URL
          if (filePath.includes("candidats-files")) {
            bucket = "candidats-files";
            const match = filePath.match(/candidats-files\/(.+)$/);
            if (match) {
              filePath = match[1];
            }
          }

          await supabase.storage.from(bucket).remove([filePath]);
        } catch (storageError) {
          console.error("Erreur lors de la suppression du fichier:", storageError);
          // Continue même si la suppression du fichier échoue
        }
      }

      // Supprimer la facture de la base de données
      const { error } = await supabase.from("factures").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Facture supprimée avec succès",
      });

      fetchFactures();
    } catch (error: any) {
      console.error("Erreur lors de la suppression:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la facture",
        variant: "destructive",
      });
    }
  };

  const toggleFactureSelection = (factureId: string) => {
    const newSelection = new Set(selectedFactureIds);
    if (newSelection.has(factureId)) {
      newSelection.delete(factureId);
    } else {
      newSelection.add(factureId);
    }
    setSelectedFactureIds(newSelection);
  };

  const toggleAllFactures = () => {
    if (selectedFactureIds.size === filteredFactures.length && filteredFactures.length > 0) {
      setSelectedFactureIds(new Set());
    } else {
      setSelectedFactureIds(new Set(filteredFactures.map((f) => f.id)));
    }
  };

  // Filtrer les factures par type de fournisseur
  const filteredFactures = useMemo(() => {
    return factures.filter((facture) => {
      if (selectedTypeFournisseur === "all") return true;
      
      // Pour les Services, on filtre exactement
      if (selectedTypeFournisseur === "SERVICES") {
        if (!facture.emetteur_nom) return false;
        const emetteurKey = facture.emetteur_nom.toLowerCase().trim();
        const type = fournisseurTypesMap.get(emetteurKey);
        return type === "SERVICES";
      }
      
      // Pour Généraux : exclure uniquement les Services
      if (selectedTypeFournisseur === "GENERAUX") {
        if (!facture.emetteur_nom) return true;
        const emetteurKey = facture.emetteur_nom.toLowerCase().trim();
        const type = fournisseurTypesMap.get(emetteurKey);
        return type !== "SERVICES";
      }
      
      // Pour les autres filtres (ETAT_ORGANISMES)
      if (!facture.emetteur_nom) return false;
      const emetteurKey = facture.emetteur_nom.toLowerCase().trim();
      const type = fournisseurTypesMap.get(emetteurKey);
      return type === selectedTypeFournisseur;
    });
  }, [factures, selectedTypeFournisseur, fournisseurTypesMap]);

  // Recalculer les statistiques basées sur les factures filtrées
  useEffect(() => {
    const totalHT = filteredFactures.reduce((sum, f) => sum + (f.total_ht || 0), 0);
    const totalTTC = filteredFactures.reduce((sum, f) => sum + (f.total_ttc || 0), 0);
    const totalPayees = filteredFactures.filter((f) => f.statut === "PAYEE").length;
    const totalEnAttente = filteredFactures.filter((f) => f.statut === "VALIDEE").length;

    setStats({
      totalFactures: filteredFactures.length,
      totalHT,
      totalTTC,
      totalPayees,
      totalEnAttente,
    });
  }, [filteredFactures]);

  const downloadSelectedFactures = async () => {
    if (selectedFactureIds.size === 0) {
      toast({
        title: "Aucune facture sélectionnée",
        description: "Veuillez sélectionner au moins une facture à télécharger",
        variant: "destructive",
      });
      return;
    }

    setIsDownloading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const factureId of Array.from(selectedFactureIds)) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-facture-pdf`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ facture_id: factureId }),
        });

        if (!response.ok) throw new Error("Erreur lors de la génération du PDF");

        const blob = await response.blob();
        const facture = factures.find((f) => f.id === factureId);

        // Nettoyer les noms pour le fichier
        const cleanName = (name: string) => name.replace(/[^a-zA-Z0-9-_]/g, "_");
        const emetteur = cleanName(facture?.emetteur_nom || "Emetteur");
        const destinataire = cleanName(facture?.destinataire_nom || "Destinataire");
        const filename = `${facture?.numero_facture || factureId}_${emetteur}_${destinataire}.pdf`;

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        successCount++;

        // Petit délai entre chaque téléchargement pour éviter de bloquer le navigateur
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Erreur lors du téléchargement de la facture ${factureId}:`, error);
        errorCount++;
      }
    }

    setIsDownloading(false);

    if (successCount > 0) {
      toast({
        title: "Téléchargement terminé",
        description: `${successCount} facture(s) téléchargée(s)${errorCount > 0 ? `, ${errorCount} erreur(s)` : ""}`,
      });
    } else {
      toast({
        title: "Erreur",
        description: "Impossible de télécharger les factures",
        variant: "destructive",
      });
    }

    setSelectedFactureIds(new Set());
  };

  const columns: ColumnDef<Facture>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            filteredFactures.length > 0 &&
            selectedFactureIds.size === filteredFactures.length
          }
          onCheckedChange={() => toggleAllFactures()}
          aria-label="Tout sélectionner"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedFactureIds.has(row.original.id)}
          onCheckedChange={() => toggleFactureSelection(row.original.id)}
          aria-label="Sélectionner la ligne"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "numero_facture",
      header: "N° Facture",
      cell: ({ row }) => <span className="font-medium">{row.getValue("numero_facture")}</span>,
    },
    {
      accessorKey: "date_emission",
      header: "Date émission",
      cell: ({ row }) => {
        const dateValue = row.getValue("date_emission");
        if (!dateValue) return <span>-</span>;
        try {
          return <span>{format(new Date(dateValue as string), "dd/MM/yyyy", { locale: fr })}</span>;
        } catch {
          return <span>-</span>;
        }
      },
    },
    {
      accessorKey: "emetteur_nom",
      header: "Fournisseur",
      cell: ({ row }) => {
        const emetteurNom = row.getValue("emetteur_nom") as string;
        const exists = existingFournisseurs.has(emetteurNom?.toLowerCase().trim());
        
        return (
          <div className="flex items-center gap-2">
            {exists ? (
              <div title="Fournisseur existant">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              </div>
            ) : (
              <div title="Fournisseur à créer">
                <AlertCircle className="h-4 w-4 text-orange-600 flex-shrink-0" />
              </div>
            )}
            <span>{emetteurNom}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "type_fournisseur",
      header: "Type",
      cell: ({ row }) => {
        const emetteurNom = row.getValue("emetteur_nom") as string;
        const type = fournisseurTypesMap.get(emetteurNom?.toLowerCase().trim());
        
        if (!type) {
          return <span className="text-muted-foreground text-xs">-</span>;
        }
        
        const typeConfig = {
          SERVICES: {
            label: "Services",
            className: "bg-blue-100 text-blue-800 border-blue-200"
          },
          GENERAUX: {
            label: "Généraux",
            className: "bg-purple-100 text-purple-800 border-purple-200"
          },
          ETAT_ORGANISMES: {
            label: "État & Organismes",
            className: "bg-green-100 text-green-800 border-green-200"
          }
        };
        
        const config = typeConfig[type as keyof typeof typeConfig];
        
        return (
          <Badge variant="outline" className={config.className}>
            {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "total_ht",
      header: "Total HT",
      cell: ({ row }) => (
        <span>
          {new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency: "EUR",
          }).format(row.getValue("total_ht") || 0)}
        </span>
      ),
    },
    {
      accessorKey: "total_ttc",
      header: "Total TTC",
      cell: ({ row }) => (
        <span className="font-medium">
          {new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency: "EUR",
          }).format(row.getValue("total_ttc") || 0)}
        </span>
      ),
    },
    {
      accessorKey: "statut",
      header: "Statut",
      cell: ({ row }) => {
        const statut = row.getValue("statut") as string;
        const colors = {
          BROUILLON: "bg-gray-100 text-gray-800",
          VALIDEE: "bg-blue-100 text-blue-800",
          PAYEE: "bg-green-100 text-green-800",
          ANNULEE: "bg-red-100 text-red-800",
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[statut as keyof typeof colors]}`}>
            {statut}
          </span>
        );
      },
    },
    {
      accessorKey: "numero_rapprochement",
      header: "Rapprochement",
      cell: ({ row }) => {
        const numero = row.getValue("numero_rapprochement") as string;
        return (
          <div className="flex items-center gap-2">
            {numero ? (
              <>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {numero}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setSelectedFacture(row.original);
                    setOpenRapprochementDialog(true);
                  }}
                  title="Voir les détails du rapprochement"
                >
                  <Link className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground text-xs">Non rapproché</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "numero_ligne_rapprochement",
      header: "N° Ligne Rapprochement",
      cell: ({ row }) => {
        const numeroLigne = row.getValue("numero_ligne_rapprochement") as string;
        return numeroLigne ? (
          <Badge 
            variant="outline" 
            className="font-mono cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => {
              setSelectedNumeroLigne(numeroLigne);
              setOpenDetailRapprochementDialog(true);
            }}
            title="Cliquer pour voir les détails"
          >
            {numeroLigne}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedFacture(row.original);
              setOpenViewDialog(true);
            }}
            title="Visualiser"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedFacture(row.original);
              setOpenEditDialog(true);
            }}
            title="Modifier"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setFournisseurInitialData({
                raison_sociale: row.original.emetteur_nom,
                adresse: row.original.emetteur_adresse,
                telephone: row.original.emetteur_telephone,
                email: row.original.emetteur_email,
              });
              setOpenCreateFournisseur(true);
            }}
            title="Créer fournisseur"
            className={
              existingFournisseurs.has(row.original.emetteur_nom?.toLowerCase().trim())
                ? "opacity-50 cursor-not-allowed"
                : ""
            }
            disabled={existingFournisseurs.has(row.original.emetteur_nom?.toLowerCase().trim())}
          >
            <UserPlus className="h-4 w-4 text-blue-600" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(row.original.id)} title="Supprimer">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: filteredFactures,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    autoResetPageIndex: false,
    globalFilterFn: (row, columnId, filterValue) => {
      const search = filterValue.toLowerCase();
      return (
        row.original.numero_facture?.toLowerCase().includes(search) ||
        row.original.emetteur_nom?.toLowerCase().includes(search)
      );
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      pagination,
    },
  });

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingDown className="h-8 w-8 text-red-600" />
            Factures d'Achat
          </h1>
          <p className="text-muted-foreground mt-1">Gérez vos factures fournisseurs et suivez vos paiements</p>
        </div>
        <div className="flex gap-2">
          {selectedFactureIds.size > 0 && (
            <Button onClick={downloadSelectedFactures} disabled={isDownloading} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              {isDownloading ? "Téléchargement..." : `Télécharger (${selectedFactureIds.size})`}
            </Button>
          )}

          <Button
            onClick={() => setOpenExtractionDialog(true)}
            variant="outline"
            className="border-purple-600 text-purple-600 hover:bg-purple-50"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Extraction IA
          </Button>

          <Button
            onClick={() => {
              setSelectedFacture(null);
              setOpenAddDialog(true);
            }}
            className="bg-red-600 hover:bg-red-700"
          >
            <Plus className="mr-2 h-4 w-4" /> Nouvelle facture d'achat
          </Button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total factures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFactures}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total HT</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("fr-FR", {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 0,
              }).format(stats.totalHT)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total TTC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("fr-FR", {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 0,
              }).format(stats.totalTTC)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Payées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.totalPayees}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.totalEnAttente}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center py-4 gap-4">
        <Input
          placeholder="Rechercher par numéro ou fournisseur..."
          value={globalFilter ?? ""}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="max-w-sm"
        />

        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les années</SelectItem>
            {availableYears.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={selectedYear === "all"}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Mois" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les mois</SelectItem>
            <SelectItem value="1">Janvier</SelectItem>
            <SelectItem value="2">Février</SelectItem>
            <SelectItem value="3">Mars</SelectItem>
            <SelectItem value="4">Avril</SelectItem>
            <SelectItem value="5">Mai</SelectItem>
            <SelectItem value="6">Juin</SelectItem>
            <SelectItem value="7">Juillet</SelectItem>
            <SelectItem value="8">Août</SelectItem>
            <SelectItem value="9">Septembre</SelectItem>
            <SelectItem value="10">Octobre</SelectItem>
            <SelectItem value="11">Novembre</SelectItem>
            <SelectItem value="12">Décembre</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedTypeFournisseur} onValueChange={setSelectedTypeFournisseur}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type fournisseur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="SERVICES">Services</SelectItem>
            <SelectItem value="GENERAUX">Généraux</SelectItem>
            <SelectItem value="ETAT_ORGANISMES">État & Organismes</SelectItem>
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Colonnes
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {loading ? "Chargement..." : "Aucune facture d'achat trouvée"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Précédent
        </Button>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Suivant
        </Button>
      </div>

      <AddFactureAchatDialog
        open={openAddDialog}
        onOpenChange={setOpenAddDialog}
        onSuccess={() => {
          fetchFactures();
          setOpenAddDialog(false);
        }}
      />

      {selectedFacture && (
        <>
          <EditFactureAchatDialog
            open={openEditDialog}
            onOpenChange={setOpenEditDialog}
            onSuccess={() => {
              fetchFactures();
              setOpenEditDialog(false);
            }}
            facture={selectedFacture}
          />

          <ViewFactureDialog open={openViewDialog} onOpenChange={setOpenViewDialog} facture={selectedFacture} />
        </>
      )}
      <ExtractionFactureDialog
        open={openExtractionDialog}
        onOpenChange={setOpenExtractionDialog}
        onSuccess={() => {
          fetchFactures();
          setOpenExtractionDialog(false);
        }}
      />

      <CreateFournisseurQuickDialog
        open={openCreateFournisseur}
        onOpenChange={setOpenCreateFournisseur}
        onSuccess={() => {
          toast({
            title: "Succès",
            description: "Fournisseur créé avec succès",
          });
          setOpenCreateFournisseur(false);
          setFournisseurInitialData(undefined);
          fetchFournisseurs(); // Recharger la liste des fournisseurs
        }}
        initialData={fournisseurInitialData}
      />

      {selectedFacture && (
        <>
          <FactureRapprochementDialog
            open={openRapprochementDialog}
            onOpenChange={setOpenRapprochementDialog}
            factureId={selectedFacture.id}
            factureNumero={selectedFacture.numero_facture}
            onSuccess={fetchFactures}
          />
        </>
      )}

      {selectedNumeroLigne && (
        <RapprochementDetailDialog
          open={openDetailRapprochementDialog}
          onOpenChange={setOpenDetailRapprochementDialog}
          numeroLigne={selectedNumeroLigne}
        />
      )}
    </div>
  );
}
