import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download, Search, CheckCircle, AlertTriangle, TrendingUp, FileDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";

interface FactureVenteRow {
  id: string;
  numero_facture: string;
  date_emission: string;
  destinataire_nom: string;
  destinataire_id: string | null;
  total_ht: number | null;
  total_ttc: number | null;
  total_tva: number | null;
  numero_rapprochement: string | null;
  statut: string | null;
  activite: string | null;
}

interface GroupeVente {
  key: string;
  client: string;
  mois: number;
  annee: number;
  moisLabel: string;
  factures: { id: string; numero: string; ht: number; tva: number; ttc: number; rapprochee: boolean }[];
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  allRapprochees: boolean;
  statut: "soldé" | "non_soldé";
}

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export default function RapprochementVentes() {
  const { toast } = useToast();
  const [factures, setFactures] = useState<FactureVenteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterMois, setFilterMois] = useState<string>("all");
  const [filterAnnee, setFilterAnnee] = useState<string>(String(new Date().getFullYear()));
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("factures")
        .select("id, numero_facture, date_emission, destinataire_nom, destinataire_id, total_ht, total_ttc, total_tva, numero_rapprochement, statut, activite")
        .eq("type_facture", "VENTES")
        .order("date_emission", { ascending: false });

      if (error) throw error;
      setFactures((data || []) as FactureVenteRow[]);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const groupes = useMemo<GroupeVente[]>(() => {
    const groupMap = new Map<string, GroupeVente>();

    for (const f of factures) {
      const d = new Date(f.date_emission);
      const mois = d.getMonth() + 1;
      const annee = d.getFullYear();
      const client = f.destinataire_nom || "-";
      const key = `${client}|${annee}-${mois}`;
      const rapprochee = !!f.numero_rapprochement || f.statut === "PAYEE";

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          client,
          mois,
          annee,
          moisLabel: MONTHS[mois - 1],
          factures: [],
          totalHT: 0,
          totalTVA: 0,
          totalTTC: 0,
          allRapprochees: true,
          statut: "soldé",
        });
      }

      const group = groupMap.get(key)!;
      group.factures.push({
        id: f.id,
        numero: f.numero_facture,
        ht: f.total_ht || 0,
        tva: f.total_tva || 0,
        ttc: f.total_ttc || 0,
        rapprochee,
      });
      group.totalHT += f.total_ht || 0;
      group.totalTVA += f.total_tva || 0;
      group.totalTTC += f.total_ttc || 0;
    }

    for (const g of groupMap.values()) {
      g.allRapprochees = g.factures.length > 0 && g.factures.every(f => f.rapprochee);
      g.statut = g.allRapprochees ? "soldé" : "non_soldé";
    }

    return [...groupMap.values()].sort((a, b) => {
      if (a.annee !== b.annee) return a.annee - b.annee;
      if (a.mois !== b.mois) return a.mois - b.mois;
      return a.client.localeCompare(b.client);
    });
  }, [factures]);

  const uniqueClients = useMemo(() => [...new Set(groupes.map(g => g.client).filter(c => c !== "-"))].sort(), [groupes]);
  const uniqueAnnees = useMemo(() => [...new Set(groupes.map(g => String(g.annee)))].sort().reverse(), [groupes]);

  const filteredGroupes = useMemo(() => {
    let filtered = groupes;
    if (filterAnnee !== "all") filtered = filtered.filter(g => String(g.annee) === filterAnnee);
    if (filterMois !== "all") filtered = filtered.filter(g => String(g.mois) === filterMois);
    if (filterClient !== "all") filtered = filtered.filter(g => g.client === filterClient);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(g =>
        g.client.toLowerCase().includes(s) ||
        g.factures.some(f => f.numero.toLowerCase().includes(s))
      );
    }

    // Filter invoices within each group based on statut filter
    if (filterStatut !== "all") {
      filtered = filtered.map(g => {
        const filteredFactures = filterStatut === "soldé"
          ? g.factures.filter(f => f.rapprochee)
          : g.factures.filter(f => !f.rapprochee);
        if (filteredFactures.length === 0) return null;
        return {
          ...g,
          factures: filteredFactures,
          totalHT: filteredFactures.reduce((s, f) => s + f.ht, 0),
          totalTVA: filteredFactures.reduce((s, f) => s + f.tva, 0),
          totalTTC: filteredFactures.reduce((s, f) => s + f.ttc, 0),
          statut: filterStatut as "soldé" | "non_soldé",
        };
      }).filter((g): g is GroupeVente => g !== null);
    }

    return filtered;
  }, [groupes, filterAnnee, filterMois, filterClient, filterStatut, searchTerm]);

  const kpis = useMemo(() => {
    const totalHT = filteredGroupes.reduce((s, g) => s + g.totalHT, 0);
    const totalTVA = filteredGroupes.reduce((s, g) => s + g.totalTVA, 0);
    const totalTTC = filteredGroupes.reduce((s, g) => s + g.totalTTC, 0);
    const totalSolde = filteredGroupes.filter(g => g.statut === "soldé").reduce((s, g) => s + g.totalTTC, 0);
    const totalNonSolde = filteredGroupes.filter(g => g.statut === "non_soldé").reduce((s, g) => s + g.totalTTC, 0);
    const nbFactures = filteredGroupes.reduce((s, g) => s + g.factures.length, 0);
    return { totalHT, totalTVA, totalTTC, totalSolde, totalNonSolde, nbFactures };
  }, [filteredGroupes]);

  const fmt = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

  const monthlyChartData = useMemo(() => {
    const map = new Map<string, { mois: string; ht: number; tva: number; ttc: number }>();
    for (const g of filteredGroupes) {
      const key = `${g.annee}-${String(g.mois).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, { mois: `${MONTHS[g.mois - 1].substring(0, 3)} ${g.annee}`, ht: 0, tva: 0, ttc: 0 });
      const e = map.get(key)!;
      e.ht += g.totalHT;
      e.tva += g.totalTVA;
      e.ttc += g.totalTTC;
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filteredGroupes]);

  const clientChartData = useMemo(() => {
    const map = new Map<string, { client: string; solde: number; nonSolde: number }>();
    for (const g of filteredGroupes) {
      if (!map.has(g.client)) map.set(g.client, { client: g.client, solde: 0, nonSolde: 0 });
      const e = map.get(g.client)!;
      if (g.statut === "soldé") e.solde += g.totalTTC;
      else e.nonSolde += g.totalTTC;
    }
    return [...map.values()].sort((a, b) => (b.solde + b.nonSolde) - (a.solde + a.nonSolde)).slice(0, 15);
  }, [filteredGroupes]);

  const handleExportExcel = () => {
    const rows: any[] = [];
    for (const g of filteredGroupes) {
      for (let i = 0; i < Math.max(g.factures.length, 1); i++) {
        const f = g.factures[i];
        rows.push({
          Client: i === 0 ? g.client : "",
          Mois: i === 0 ? g.moisLabel : "",
          Année: i === 0 ? g.annee : "",
          "N° Facture": f?.numero || "",
          "HT": f ? Number(f.ht.toFixed(2)) : "",
          "TVA": f ? Number(f.tva.toFixed(2)) : "",
          "TTC": f ? Number(f.ttc.toFixed(2)) : "",
          "Rapprochée": f ? (f.rapprochee ? "Oui" : "Non") : "",
          Statut: i === 0 ? (g.statut === "soldé" ? "SOLDÉ" : "NON SOLDÉ") : "",
        });
      }
    }
    rows.push({});
    rows.push({ Client: "TOTAUX", "HT": Number(kpis.totalHT.toFixed(2)), "TVA": Number(kpis.totalTVA.toFixed(2)), "TTC": Number(kpis.totalTTC.toFixed(2)) });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapprochement Ventes");
    XLSX.writeFile(wb, `rapprochement_ventes_${filterAnnee}.xlsx`);
  };

  const handleExportCsv = () => {
    const rows: string[] = [];
    rows.push(["Client", "Mois", "Année", "N° Facture", "HT", "TVA", "TTC", "Rapprochée", "Statut"].join(";"));

    for (const g of filteredGroupes) {
      for (let i = 0; i < Math.max(g.factures.length, 1); i++) {
        const f = g.factures[i];
        rows.push([
          i === 0 ? g.client.replace(/;/g, ",") : "",
          i === 0 ? g.moisLabel : "",
          i === 0 ? String(g.annee) : "",
          f?.numero || "",
          f ? f.ht.toFixed(2).replace(".", ",") : "",
          f ? f.tva.toFixed(2).replace(".", ",") : "",
          f ? f.ttc.toFixed(2).replace(".", ",") : "",
          f ? (f.rapprochee ? "Oui" : "Non") : "",
          i === 0 ? (g.statut === "soldé" ? "SOLDÉ" : "NON SOLDÉ") : "",
        ].join(";"));
      }
    }

    const csvContent = "\uFEFF" + rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rapprochement_ventes_${filterAnnee}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Export CSV", description: `${filteredGroupes.length} groupe(s) exporté(s)` });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rapprochement Ventes</h1>
          <p className="text-sm text-muted-foreground">Suivi des factures de vente par client et par période</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExportCsv} disabled={filteredGroupes.length === 0} variant="outline" size="sm">
            <FileDown className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={handleExportExcel} disabled={filteredGroupes.length === 0} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total HT</p>
                <p className="text-lg font-bold">{fmt(kpis.totalHT)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total TTC</p>
                <p className="text-lg font-bold">{fmt(kpis.totalTTC)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground">Soldé</p>
                <p className="text-lg font-bold text-emerald-600">{fmt(kpis.totalSolde)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Non Soldé</p>
                <p className="text-lg font-bold text-red-600">{fmt(kpis.totalNonSolde)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Nb Factures</p>
                <p className="text-lg font-bold">{kpis.nbFactures}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9" />
            </div>
            <Select value={filterAnnee} onValueChange={setFilterAnnee}>
              <SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {uniqueAnnees.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterMois} onValueChange={setFilterMois}>
              <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Mois" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les mois</SelectItem>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Client" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous clients</SelectItem>
                {uniqueClients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatut} onValueChange={setFilterStatut}>
              <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="soldé">Soldé</SelectItem>
                <SelectItem value="non_soldé">Non soldé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grouped detail */}
      {filteredGroupes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Aucune donnée</CardContent>
        </Card>
      ) : (
        filteredGroupes.map(g => (
          <Card key={g.key}>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-sm font-semibold">
                    {g.moisLabel} {g.annee} — <span className="text-primary">{g.client}</span>
                  </CardTitle>
                  {g.statut === "soldé" ? (
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px]">
                      <CheckCircle className="h-3 w-3 mr-1" /> SOLDÉ
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-red-400 text-red-600 text-[10px]">
                      <AlertTriangle className="h-3 w-3 mr-1" /> NON SOLDÉ
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span>HT: <strong>{fmt(g.totalHT)}</strong></span>
                  <span>TVA: <strong>{fmt(g.totalTVA)}</strong></span>
                  <span>TTC: <strong>{fmt(g.totalTTC)}</strong></span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">N° Facture</TableHead>
                    <TableHead className="text-xs text-right">HT</TableHead>
                    <TableHead className="text-xs text-right">TVA</TableHead>
                    <TableHead className="text-xs text-right">TTC</TableHead>
                    <TableHead className="text-xs text-center">Rapprochée</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.factures.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="text-xs font-mono">{f.numero}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{fmt(f.ht)}</TableCell>
                      <TableCell className="text-xs text-right">{fmt(f.tva)}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{fmt(f.ttc)}</TableCell>
                      <TableCell className="text-xs text-center">
                        <Badge variant={f.rapprochee ? "default" : "secondary"} className={`text-[10px] ${f.rapprochee ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}`}>
                          {f.rapprochee ? "Oui" : "Non"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      {/* Global totals */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-end gap-6 text-sm font-medium">
            <span>Total HT: <strong>{fmt(kpis.totalHT)}</strong></span>
            <span>Total TVA: <strong>{fmt(kpis.totalTVA)}</strong></span>
            <span>Total TTC: <strong>{fmt(kpis.totalTTC)}</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base">Évolution mensuelle</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="ht" name="HT" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="ttc" name="TTC" fill="hsl(142, 76%, 36%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Aucune donnée</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base">Statut par client</CardTitle>
          </CardHeader>
          <CardContent>
            {clientChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={clientChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="client" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="solde" name="Soldé" fill="hsl(142, 76%, 36%)" stackId="a" />
                  <Bar dataKey="nonSolde" name="Non soldé" fill="hsl(0, 84%, 60%)" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Aucune donnée</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
