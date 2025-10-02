import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, FileText, Eye, Pencil, Copy, Trash2, TrendingUp } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AddFactureDialog from "@/components/AddFactureDialog";
import EditFactureDialog from "@/components/EditFactureDialog";
import ViewFactureDialog from "@/components/ViewFactureDialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface Facture {
  id: string;
  numero_facture: string;
  type_facture: 'VENTES' | 'ACHATS';
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
  statut: 'BROUILLON' | 'VALIDEE' | 'PAYEE' | 'ANNULEE';
  created_at: string;
  updated_at: string;
  created_by?: string;
  lignes?: FactureLigne[];
}

export interface FactureLigne {
  id?: string;
  facture_id?: string;
  ordre: number;
  description: string;
  quantite: number;
  prix_unitaire_ht: number;
  prix_ht: number;
  taux_tva: number;
  montant_tva?: number;
  prix_ttc?: number;
}

export default function FacturesVentes() {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(false);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [availableYears, setAvailableYears] = useState<string[]>([]);
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
  }, [selectedYear, selectedMonth]);

  const fetchFactures = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('factures')
        .select('*')
        .eq('type_facture', 'VENTES');

      // Filtrer par année et mois si sélectionné
      if (selectedYear !== "all") {
        const yearNum = parseInt(selectedYear);
        
        if (selectedMonth !== "all") {
          // Filtrer par année ET mois
          const monthNum = parseInt(selectedMonth);
          const startDate = new Date(yearNum, monthNum - 1, 1).toISOString().split('T')[0];
          const endDate = new Date(yearNum, monthNum, 0).toISOString().split('T')[0];
          query = query.gte('date_emission', startDate).lte('date_emission', endDate);
        } else {
          // Filtrer par année uniquement
          const startDate = `${yearNum}-01-01`;
          const endDate = `${yearNum}-12-31`;
          query = query.gte('date_emission', startDate).lte('date_emission', endDate);
        }
      }

      const { data, error } = await query.order('date_emission', { ascending: false });

      if (error) throw error;
      
      const facturesData = (data || []).map(f => ({
        ...f,
        type_facture: f.type_facture as 'VENTES' | 'ACHATS',
        statut: f.statut as 'BROUILLON' | 'VALIDEE' | 'PAYEE' | 'ANNULEE',
      }));
      
      // Extraire les années disponibles
      const years = new Set<string>();
      facturesData.forEach(f => {
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
      const totalPayees = facturesData.filter(f => f.statut === 'PAYEE').length;
      const totalEnAttente = facturesData.filter(f => f.statut === 'VALIDEE').length;
      
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
        description: "Impossible de charger les factures de vente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (facture: Facture) => {
    try {
      const { data: lignes, error: lignesError } = await supabase
        .from('facture_lignes')
        .select('*')
        .eq('facture_id', facture.id)
        .order('ordre');

      if (lignesError) throw lignesError;

      const newFacture = {
        ...facture,
        id: undefined,
        numero_facture: undefined,
        statut: 'BROUILLON' as const,
        date_emission: new Date().toISOString().split('T')[0],
        created_at: undefined,
        updated_at: undefined,
        lignes: lignes?.map(l => ({
          ...l,
          id: undefined,
          facture_id: undefined,
        }))
      };

      setSelectedFacture(newFacture as any);
      setOpenAddDialog(true);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de copier la facture",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette facture ?")) return;

    try {
      const { error } = await supabase
        .from('factures')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Facture supprimée avec succès",
      });

      fetchFactures();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la facture",
        variant: "destructive",
      });
    }
  };

  const columns: ColumnDef<Facture>[] = [
    {
      accessorKey: "numero_facture",
      header: "N° Facture",
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("numero_facture")}</span>
      ),
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
      accessorKey: "destinataire_nom",
      header: "Client",
    },
    {
      accessorKey: "total_ht",
      header: "Total HT",
      cell: ({ row }) => (
        <span>
          {new Intl.NumberFormat('fr-FR', { 
            style: 'currency', 
            currency: 'EUR' 
          }).format(row.getValue("total_ht") || 0)}
        </span>
      ),
    },
    {
      accessorKey: "total_ttc",
      header: "Total TTC",
      cell: ({ row }) => (
        <span className="font-medium">
          {new Intl.NumberFormat('fr-FR', { 
            style: 'currency', 
            currency: 'EUR' 
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
          BROUILLON: 'bg-gray-100 text-gray-800',
          VALIDEE: 'bg-blue-100 text-blue-800',
          PAYEE: 'bg-green-100 text-green-800',
          ANNULEE: 'bg-red-100 text-red-800',
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[statut as keyof typeof colors]}`}>
            {statut}
          </span>
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
            onClick={() => handleCopy(row.original)}
            title="Copier"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(row.original.id)}
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: factures,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  });

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-green-600" />
            Factures de Vente
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos factures clients et suivez vos paiements
          </p>
        </div>
        <Button 
          onClick={() => {
            setSelectedFacture(null);
            setOpenAddDialog(true);
          }}
          className="bg-green-600 hover:bg-green-700"
        >
          <Plus className="mr-2 h-4 w-4" /> Nouvelle facture de vente
        </Button>
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
              {new Intl.NumberFormat('fr-FR', { 
                style: 'currency', 
                currency: 'EUR',
                maximumFractionDigits: 0
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
              {new Intl.NumberFormat('fr-FR', { 
                style: 'currency', 
                currency: 'EUR',
                maximumFractionDigits: 0
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
          placeholder="Rechercher par numéro ou client..."
          value={(table.getColumn("numero_facture")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("numero_facture")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les années</SelectItem>
            {availableYears.map(year => (
              <SelectItem key={year} value={year}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select 
          value={selectedMonth} 
          onValueChange={setSelectedMonth}
          disabled={selectedYear === "all"}
        >
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
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
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
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {loading ? "Chargement..." : "Aucune facture de vente trouvée"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Précédent
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Suivant
        </Button>
      </div>

      <AddFactureDialog 
        open={openAddDialog} 
        onOpenChange={setOpenAddDialog}
        onSuccess={fetchFactures}
        initialData={selectedFacture}
      />
      
      {selectedFacture && (
        <>
          <EditFactureDialog
            open={openEditDialog}
            onOpenChange={setOpenEditDialog}
            facture={selectedFacture}
            onSuccess={fetchFactures}
          />
          
          <ViewFactureDialog
            open={openViewDialog}
            onOpenChange={setOpenViewDialog}
            facture={selectedFacture}
          />
        </>
      )}
    </div>
  );
}