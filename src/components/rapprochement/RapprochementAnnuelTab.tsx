import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, Calendar, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface LigneAnnuelle {
  id: string;
  numero_ligne: string;
  transaction_date: string;
  transaction_libelle: string;
  transaction_debit: number;
  transaction_credit: number;
  transaction_montant: number;
  fournisseur_detecte_nom: string | null;
  fournisseur_detecte_type: string | null;
  fournisseur_detecte_id: string | null;
  total_ht: number | null;
  total_tva: number | null;
  total_ttc: number | null;
  abonnement_id: string | null;
  declaration_charge_id: string | null;
  facture_id: string | null;
  numero_facture: string | null;
  notes: string | null;
  statut: string;
  fichier_rapprochement_id: string | null;
}

interface Partenaire {
  id: string;
  nom: string;
  type: string;
}

const TYPE_LABELS: Record<string, string> = {
  client: "Client",
  prestataire: "Prestataire",
  salarie: "Salarié",
  general: "Fournisseur général",
  services: "Fournisseur services",
  etat: "Fournisseur État",
  banque: "Banque",
  independant: "Indépendant",
};

const formatMontant = (val: number | null | undefined): string => {
  if (val == null || val === 0) return "-";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(val);
};

export default function RapprochementAnnuelTab() {
  const [annee, setAnnee] = useState<number>(new Date().getFullYear());
  const [lignes, setLignes] = useState<LigneAnnuelle[]>([]);
  const [loading, setLoading] = useState(false);
  const [partenaires, setPartenaires] = useState<Partenaire[]>([]);
  const [selectedPartenaire, setSelectedPartenaire] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>("transaction_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const { toast } = useToast();

  const anneesDisponibles = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => current - i);
  }, []);

  useEffect(() => {
    loadLignes();
  }, [annee]);

  const loadLignes = async () => {
    setLoading(true);
    try {
      const dateDebut = `${annee}-01-01`;
      const dateFin = `${annee}-12-31`;

      const { data, error } = await supabase
        .from("lignes_rapprochement")
        .select("id, numero_ligne, transaction_date, transaction_libelle, transaction_debit, transaction_credit, transaction_montant, fournisseur_detecte_nom, fournisseur_detecte_type, fournisseur_detecte_id, total_ht, total_tva, total_ttc, abonnement_id, declaration_charge_id, facture_id, numero_facture, notes, statut, fichier_rapprochement_id")
        .gte("transaction_date", dateDebut)
        .lte("transaction_date", dateFin)
        .order("transaction_date", { ascending: true });

      if (error) throw error;

      const rows = (data || []) as LigneAnnuelle[];
      setLignes(rows);

      // Extraire les partenaires uniques
      const partMap = new Map<string, Partenaire>();
      for (const l of rows) {
        if (l.fournisseur_detecte_nom) {
          const key = `${l.fournisseur_detecte_nom}__${l.fournisseur_detecte_type || ""}`;
          if (!partMap.has(key)) {
            partMap.set(key, {
              id: l.fournisseur_detecte_id || key,
              nom: l.fournisseur_detecte_nom,
              type: l.fournisseur_detecte_type || "",
            });
          }
        }
      }
      setPartenaires(
        Array.from(partMap.values()).sort((a, b) => a.nom.localeCompare(b.nom))
      );
      setCurrentPage(1);
    } catch (err) {
      console.error("Erreur chargement lignes annuelles:", err);
      toast({ title: "Erreur", description: "Impossible de charger les opérations", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredLignes = useMemo(() => {
    let result = lignes;

    if (selectedPartenaire !== "all") {
      result = result.filter((l) => {
        const key = `${l.fournisseur_detecte_nom}__${l.fournisseur_detecte_type || ""}`;
        return key === selectedPartenaire || l.fournisseur_detecte_id === selectedPartenaire;
      });
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(
        (l) =>
          l.transaction_libelle?.toLowerCase().includes(search) ||
          l.numero_ligne?.toLowerCase().includes(search) ||
          l.fournisseur_detecte_nom?.toLowerCase().includes(search)
      );
    }

    if (sortColumn) {
      result = [...result].sort((a, b) => {
        let va: any = (a as any)[sortColumn];
        let vb: any = (b as any)[sortColumn];
        if (typeof va === "string") va = va.toLowerCase();
        if (typeof vb === "string") vb = vb.toLowerCase();
        if (va == null) return 1;
        if (vb == null) return -1;
        if (va < vb) return sortDirection === "asc" ? -1 : 1;
        if (va > vb) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [lignes, selectedPartenaire, searchTerm, sortColumn, sortDirection]);

  const totals = useMemo(() => {
    return filteredLignes.reduce(
      (acc, l) => ({
        debit: acc.debit + (Number(l.transaction_debit) || 0),
        credit: acc.credit + (Number(l.transaction_credit) || 0),
        ht: acc.ht + (Number(l.total_ht) || 0),
        tva: acc.tva + (Number(l.total_tva) || 0),
        ttc: acc.ttc + (Number(l.total_ttc) || 0),
      }),
      { debit: 0, credit: 0, ht: 0, tva: 0, ttc: 0 }
    );
  }, [filteredLignes]);

  const totalPages = Math.ceil(filteredLignes.length / itemsPerPage);
  const paginatedLignes = filteredLignes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortColumn !== col) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const handleExport = () => {
    const rows = filteredLignes.map((l) => ({
      Date: l.transaction_date,
      "N° Ligne": l.numero_ligne,
      Libellé: l.transaction_libelle,
      Débit: Number(l.transaction_debit) || 0,
      Crédit: Number(l.transaction_credit) || 0,
      "N° Facture": l.numero_facture || "",
      Partenaire: l.fournisseur_detecte_nom || "",
      "Type Partenaire": TYPE_LABELS[l.fournisseur_detecte_type || ""] || l.fournisseur_detecte_type || "",
      "Total HT": Number(l.total_ht) || 0,
      "Total TVA": Number(l.total_tva) || 0,
      "Total TTC": Number(l.total_ttc) || 0,
      Statut: l.statut,
      Notes: l.notes || "",
    }));

    // Ajouter ligne de total
    rows.push({
      Date: "",
      "N° Ligne": "",
      Libellé: "TOTAL",
      Débit: totals.debit,
      Crédit: totals.credit,
      "N° Facture": "",
      Partenaire: "",
      "Type Partenaire": "",
      "Total HT": totals.ht,
      "Total TVA": totals.tva,
      "Total TTC": totals.ttc,
      Statut: "",
      Notes: "",
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Opérations ${annee}`);
    XLSX.writeFile(wb, `rapprochement_annuel_${annee}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={String(annee)} onValueChange={(v) => setAnnee(Number(v))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anneesDisponibles.map((a) => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-[400px]">
              <Select value={selectedPartenaire} onValueChange={(v) => { setSelectedPartenaire(v); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les partenaires" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les partenaires</SelectItem>
                  {partenaires.map((p) => (
                    <SelectItem key={`${p.nom}__${p.type}`} value={`${p.nom}__${p.type}`}>
                      {p.nom} {p.type ? `(${TYPE_LABELS[p.type] || p.type})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative flex-1 min-w-[150px] max-w-[300px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-9"
              />
            </div>

            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              Export Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Débit</p>
            <p className="text-lg font-bold text-red-600">{formatMontant(totals.debit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Crédit</p>
            <p className="text-lg font-bold text-green-600">{formatMontant(totals.credit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total HT</p>
            <p className="text-lg font-bold">{formatMontant(totals.ht)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total TVA</p>
            <p className="text-lg font-bold">{formatMontant(totals.tva)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total TTC</p>
            <p className="text-lg font-bold">{formatMontant(totals.ttc)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Info count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredLignes.length} opération{filteredLignes.length > 1 ? "s" : ""} en {annee}
          {selectedPartenaire !== "all" && ` — Filtre partenaire actif`}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Lignes par page:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border">
        <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[90px] cursor-pointer" onClick={() => handleSort("transaction_date")}>
                  <div className="flex items-center gap-1">Date <SortIcon col="transaction_date" /></div>
                </TableHead>
                <TableHead className="w-[120px]">N° Ligne</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("transaction_libelle")}>
                  <div className="flex items-center gap-1">Libellé <SortIcon col="transaction_libelle" /></div>
                </TableHead>
                <TableHead className="w-[100px] text-right cursor-pointer" onClick={() => handleSort("transaction_debit")}>
                  <div className="flex items-center justify-end gap-1">Débit <SortIcon col="transaction_debit" /></div>
                </TableHead>
                <TableHead className="w-[100px] text-right cursor-pointer" onClick={() => handleSort("transaction_credit")}>
                  <div className="flex items-center justify-end gap-1">Crédit <SortIcon col="transaction_credit" /></div>
                </TableHead>
                <TableHead className="w-[120px] cursor-pointer" onClick={() => handleSort("numero_facture")}>
                  <div className="flex items-center gap-1">N° Facture <SortIcon col="numero_facture" /></div>
                </TableHead>
                <TableHead className="w-[150px] cursor-pointer" onClick={() => handleSort("fournisseur_detecte_nom")}>
                  <div className="flex items-center gap-1">Partenaire <SortIcon col="fournisseur_detecte_nom" /></div>
                </TableHead>
                <TableHead className="w-[120px]">Type</TableHead>
                <TableHead className="w-[100px] text-right cursor-pointer" onClick={() => handleSort("total_ht")}>
                  <div className="flex items-center justify-end gap-1">HT <SortIcon col="total_ht" /></div>
                </TableHead>
                <TableHead className="w-[90px] text-right cursor-pointer" onClick={() => handleSort("total_tva")}>
                  <div className="flex items-center justify-end gap-1">TVA <SortIcon col="total_tva" /></div>
                </TableHead>
                <TableHead className="w-[100px] text-right cursor-pointer" onClick={() => handleSort("total_ttc")}>
                  <div className="flex items-center justify-end gap-1">TTC <SortIcon col="total_ttc" /></div>
                </TableHead>
                <TableHead className="w-[80px]">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                   <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : paginatedLignes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                    Aucune opération trouvée pour {annee}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLignes.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{l.transaction_date}</TableCell>
                    <TableCell className="text-xs font-mono">{l.numero_ligne}</TableCell>
                    <TableCell className="text-xs max-w-[250px] truncate" title={l.transaction_libelle}>
                      {l.transaction_libelle}
                    </TableCell>
                    <TableCell className="text-xs text-right text-red-600">
                      {Number(l.transaction_debit) > 0 ? formatMontant(Number(l.transaction_debit)) : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-right text-green-600">
                      {Number(l.transaction_credit) > 0 ? formatMontant(Number(l.transaction_credit)) : "-"}
                    </TableCell>
                    <TableCell className="text-xs font-mono truncate max-w-[120px]" title={l.numero_facture || ""}>
                      {l.numero_facture || "-"}
                    </TableCell>
                    <TableCell className="text-xs truncate max-w-[150px]" title={l.fournisseur_detecte_nom || ""}>
                      {l.fournisseur_detecte_nom || "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {l.fournisseur_detecte_type ? (
                        <Badge variant="outline" className="text-[10px]">
                          {TYPE_LABELS[l.fournisseur_detecte_type] || l.fournisseur_detecte_type}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-right">{formatMontant(Number(l.total_ht))}</TableCell>
                    <TableCell className="text-xs text-right">{formatMontant(Number(l.total_tva))}</TableCell>
                    <TableCell className="text-xs text-right">{formatMontant(Number(l.total_ttc))}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          l.statut === "RAPPROCHE" ? "bg-green-100 text-green-800" :
                          l.statut === "PARTIEL" ? "bg-yellow-100 text-yellow-800" :
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {l.statut === "RAPPROCHE" ? "Rapproché" :
                         l.statut === "PARTIEL" ? "Partiel" :
                         l.statut === "EN_ATTENTE" ? "En attente" :
                         l.statut}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {/* Ligne de total */}
              {!loading && paginatedLignes.length > 0 && (
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={3} className="text-xs">
                    TOTAL ({filteredLignes.length} lignes)
                  </TableCell>
                  <TableCell className="text-xs text-right text-red-600">{formatMontant(totals.debit)}</TableCell>
                  <TableCell className="text-xs text-right text-green-600">{formatMontant(totals.credit)}</TableCell>
                  <TableCell colSpan={3}></TableCell>
                  <TableCell className="text-xs text-right font-bold">{formatMontant(totals.ht)}</TableCell>
                  <TableCell className="text-xs text-right font-bold">{formatMontant(totals.tva)}</TableCell>
                  <TableCell className="text-xs text-right font-bold">{formatMontant(totals.ttc)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} sur {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(1)}>
              ««
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
              «
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              »
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>
              »»
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
