import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Eye, Pencil, Trash2, ArrowUpDown, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AddDevisDialog from "@/components/AddDevisDialog";
import EditDevisDialog from "@/components/EditDevisDialog";
import ViewDevisDialog from "@/components/ViewDevisDialog";
import type { Devis } from "@/types/devis";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

const statutColors: Record<string, string> = {
  ENCOURS: "bg-yellow-100 text-yellow-800",
  REALISE: "bg-green-100 text-green-800",
  ANNULE: "bg-red-100 text-red-800",
};

const statutLabels: Record<string, string> = {
  ENCOURS: "En cours",
  REALISE: "Réalisé",
  ANNULE: "Annulé",
};

export default function DevisPage() {
  const [devisList, setDevisList] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(false);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedDevis, setSelectedDevis] = useState<Devis | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedStatut, setSelectedStatut] = useState<string>("all");
  const [transforming, setTransforming] = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchDevis(); }, [selectedStatut]);

  const fetchDevis = async () => {
    setLoading(true);
    try {
      let query = supabase.from('devis').select('*').order('created_at', { ascending: false });
      if (selectedStatut !== "all") query = query.eq('statut', selectedStatut);
      const { data, error } = await query;
      if (error) throw error;
      setDevisList((data || []).map(d => ({ ...d, statut: d.statut as any })));
    } catch (error: any) {
      toast({ title: "Erreur", description: "Impossible de charger les devis", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce devis ?")) return;
    try {
      const { error } = await supabase.from('devis').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Succès", description: "Devis supprimé" });
      fetchDevis();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleTransformToFacture = async (devis: Devis) => {
    if (devis.statut === 'REALISE') {
      toast({ title: "Déjà transformé", description: "Ce devis a déjà été transformé en facture", variant: "destructive" });
      return;
    }
    if (!confirm(`Transformer le devis ${devis.numero_devis} en facture de vente ?`)) return;

    setTransforming(true);
    try {
      // 1. Get devis lignes
      const { data: lignes, error: lignesError } = await supabase
        .from('devis_lignes').select('*').eq('devis_id', devis.id).order('ordre');
      if (lignesError) throw lignesError;

      // 2. Generate facture number
      const { data: numFacture } = await supabase.rpc('get_next_facture_numero', { p_type_facture: 'VENTES' });

      // 3. Create facture
      const { data: factureData, error: factureError } = await supabase
        .from('factures')
        .insert({
          numero_facture: numFacture || `FAC-FROM-${devis.numero_devis}`,
          type_facture: 'VENTES',
          date_emission: new Date().toISOString().split('T')[0],
          date_echeance: devis.date_echeance,
          emetteur_type: devis.emetteur_type,
          emetteur_id: devis.emetteur_id || null,
          emetteur_nom: devis.emetteur_nom,
          emetteur_adresse: devis.emetteur_adresse || null,
          emetteur_telephone: devis.emetteur_telephone || null,
          emetteur_email: devis.emetteur_email || null,
          destinataire_type: devis.destinataire_type,
          destinataire_id: devis.destinataire_id || null,
          destinataire_nom: devis.destinataire_nom,
          destinataire_adresse: devis.destinataire_adresse || null,
          destinataire_telephone: devis.destinataire_telephone || null,
          destinataire_email: devis.destinataire_email || null,
          total_ht: devis.total_ht,
          total_tva: devis.total_tva,
          total_ttc: devis.total_ttc,
          informations_paiement: devis.informations_paiement || null,
          reference_societe: devis.reference_societe || null,
          activite: devis.activite || null,
          statut: 'BROUILLON',
        })
        .select()
        .single();

      if (factureError) throw factureError;

      // 4. Copy lignes to facture_lignes
      if (lignes && lignes.length > 0) {
        const factureLignes = lignes.map((l: any) => ({
          facture_id: factureData.id,
          ordre: l.ordre,
          description: l.description,
          quantite: l.quantite,
          prix_unitaire_ht: l.prix_unitaire_ht,
          prix_ht: l.prix_ht,
          taux_tva: l.taux_tva,
          montant_tva: l.montant_tva || 0,
          prix_ttc: l.prix_ttc || 0,
        }));
        const { error: flError } = await supabase.from('facture_lignes').insert(factureLignes);
        if (flError) throw flError;
      }

      // 5. Update devis status to REALISE and link facture
      const { error: updateError } = await supabase
        .from('devis')
        .update({ statut: 'REALISE', facture_id: factureData.id })
        .eq('id', devis.id);
      if (updateError) throw updateError;

      toast({
        title: "Succès",
        description: `Devis transformé en facture ${factureData.numero_facture}`,
      });
      fetchDevis();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setTransforming(false);
    }
  };

  const stats = {
    total: devisList.length,
    encours: devisList.filter(d => d.statut === 'ENCOURS').length,
    realises: devisList.filter(d => d.statut === 'REALISE').length,
    totalHT: devisList.reduce((s, d) => s + Number(d.total_ht || 0), 0),
  };

  const columns: ColumnDef<Devis>[] = [
    {
      accessorKey: "numero_devis",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 h-auto">
          N° Devis <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
    },
    {
      accessorKey: "date_emission",
      header: "Date émission",
      cell: ({ row }) => {
        try { return format(new Date(row.getValue("date_emission")), "dd/MM/yyyy", { locale: fr }); }
        catch { return row.getValue("date_emission"); }
      },
    },
    {
      accessorKey: "destinataire_nom",
      header: "Client",
    },
    {
      accessorKey: "activite",
      header: "Activité",
    },
    {
      accessorKey: "total_ht",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 h-auto">
          Total HT <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => `${Number(row.getValue("total_ht") || 0).toFixed(2)} €`,
    },
    {
      accessorKey: "total_ttc",
      header: "Total TTC",
      cell: ({ row }) => `${Number(row.getValue("total_ttc") || 0).toFixed(2)} €`,
    },
    {
      accessorKey: "statut",
      header: "Statut",
      cell: ({ row }) => {
        const statut = row.getValue("statut") as string;
        return <Badge className={statutColors[statut] || ""}>{statutLabels[statut] || statut}</Badge>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const devis = row.original;
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedDevis(devis); setOpenViewDialog(true); }}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { setSelectedDevis(devis); setOpenEditDialog(true); }} disabled={devis.statut === 'REALISE'}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="icon" title="Transformer en facture"
              onClick={() => handleTransformToFacture(devis)}
              disabled={devis.statut !== 'ENCOURS' || transforming}
            >
              <ArrowRight className="h-4 w-4 text-primary" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(devis.id)} disabled={devis.statut === 'REALISE'}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: devisList,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, globalFilter },
    onGlobalFilterChange: setGlobalFilter,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Devis</h1>
          <p className="text-muted-foreground">Gestion des devis clients</p>
        </div>
        <Button onClick={() => { setSelectedDevis(null); setOpenAddDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nouveau devis
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total devis</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">En cours</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-yellow-600">{stats.encours}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Réalisés</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{stats.realises}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total HT</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.totalHT.toFixed(2)} €</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Input placeholder="Rechercher..." value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} className="max-w-sm" />
        <Select value={selectedStatut} onValueChange={setSelectedStatut}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="ENCOURS">En cours</SelectItem>
            <SelectItem value="REALISE">Réalisé</SelectItem>
            <SelectItem value="ANNULE">Annulé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id}>
                {hg.headers.map(h => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {loading ? "Chargement..." : "Aucun devis trouvé"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Précédent</Button>
        <span className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} sur {table.getPageCount()}
        </span>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Suivant</Button>
      </div>

      <AddDevisDialog open={openAddDialog} onOpenChange={setOpenAddDialog} onSuccess={fetchDevis} initialData={selectedDevis} />
      <EditDevisDialog open={openEditDialog} onOpenChange={setOpenEditDialog} onSuccess={fetchDevis} devis={selectedDevis} />
      <ViewDevisDialog open={openViewDialog} onOpenChange={setOpenViewDialog} devis={selectedDevis} />
    </div>
  );
}
