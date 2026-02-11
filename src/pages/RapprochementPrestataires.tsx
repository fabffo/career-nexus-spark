import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download, Search, CheckCircle, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";

interface FactureRow {
  id: string;
  numero_facture: string;
  type_facture: string;
  emetteur_nom: string;
  emetteur_type: string;
  emetteur_id: string | null;
  destinataire_nom: string;
  destinataire_type: string;
  destinataire_id: string | null;
  fournisseur_id: string | null;
  date_emission: string;
  total_ht: number | null;
  total_ttc: number | null;
  numero_rapprochement: string | null;
  statut: string | null;
  activite: string | null;
}

interface ContratRow {
  id: string;
  type: string;
  client_lie_id: string | null;
  fournisseur_services_id: string | null;
  prestataire_id: string | null;
  statut: string;
  client_lie?: { id: string; raison_sociale: string } | null;
  fournisseur_services?: { id: string; raison_sociale: string } | null;
  prestataire?: { id: string; nom: string; prenom: string } | null;
}

interface GroupeRapprochement {
  key: string;
  prestataire: string;
  client: string;
  mois: number;
  annee: number;
  moisLabel: string;
  achats: { id: string; numero: string; ttc: number; rapproche: boolean }[];
  ventes: { id: string; numero: string; ttc: number; rapprochee: boolean }[];
  totalAchatTTC: number;
  totalVenteTTC: number;
  allVentesRapprochees: boolean;
  statutPaiement: "payable" | "en_attente";
}

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export default function RapprochementPrestataires() {
  const { toast } = useToast();
  const [facturesAchats, setFacturesAchats] = useState<FactureRow[]>([]);
  const [facturesVentes, setFacturesVentes] = useState<FactureRow[]>([]);
  const [contrats, setContrats] = useState<ContratRow[]>([]);
  const [clients, setClients] = useState<{ id: string; raison_sociale: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterMois, setFilterMois] = useState<string>("all");
  const [filterAnnee, setFilterAnnee] = useState<string>(String(new Date().getFullYear()));
  const [filterPrestataire, setFilterPrestataire] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [achatsRes, ventesRes, contratsRes, clientsRes] = await Promise.all([
        supabase
          .from("factures")
          .select("id, numero_facture, type_facture, emetteur_nom, emetteur_type, emetteur_id, destinataire_nom, destinataire_type, destinataire_id, fournisseur_id, date_emission, total_ht, total_ttc, numero_rapprochement, statut, activite")
          .in("type_facture", ["ACHATS_SERVICES"])
          .order("date_emission", { ascending: false }),
        supabase
          .from("factures")
          .select("id, numero_facture, type_facture, emetteur_nom, emetteur_type, emetteur_id, destinataire_nom, destinataire_type, destinataire_id, fournisseur_id, date_emission, total_ht, total_ttc, numero_rapprochement, statut, activite")
          .eq("type_facture", "VENTES")
          .order("date_emission", { ascending: false }),
        (supabase as any)
          .from("contrats")
          .select(`
            id, type, statut, client_lie_id, fournisseur_services_id, prestataire_id,
            client_lie:client_lie_id(id, raison_sociale),
            fournisseur_services:fournisseurs_services(id, raison_sociale),
            prestataire:prestataires(id, nom, prenom)
          `)
          .in("type", ["FOURNISSEUR_SERVICES", "CLIENT"])
          .in("statut", ["ACTIF", "TERMINE"]),
        supabase.from("clients").select("id, raison_sociale"),
      ]);

      if (achatsRes.error) throw achatsRes.error;
      if (ventesRes.error) throw ventesRes.error;
      if (contratsRes.error) throw contratsRes.error;
      if (clientsRes.error) throw clientsRes.error;

      setFacturesAchats((achatsRes.data || []) as FactureRow[]);
      setFacturesVentes((ventesRes.data || []) as FactureRow[]);
      setContrats((contratsRes.data || []) as ContratRow[]);
      setClients(clientsRes.data || []);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Build grouped reconciliation data
  const groupes = useMemo<GroupeRapprochement[]>(() => {
    // Contract lookups
    const fournisseurToClients = new Map<string, { clientId: string; clientNom: string }[]>();
    const prestataireToClients = new Map<string, { clientId: string; clientNom: string }[]>();
    const fournisseurNomToClients = new Map<string, { clientId: string; clientNom: string }[]>();

    const addToMap = (map: Map<string, { clientId: string; clientNom: string }[]>, key: string, info: { clientId: string; clientNom: string }) => {
      if (!map.has(key)) map.set(key, []);
      const arr = map.get(key)!;
      if (!arr.some(e => e.clientId === info.clientId)) arr.push(info);
    };

    for (const c of contrats) {
      if (c.type === "FOURNISSEUR_SERVICES" && c.client_lie_id && c.client_lie) {
        const info = { clientId: c.client_lie.id, clientNom: c.client_lie.raison_sociale };
        if (c.fournisseur_services_id) addToMap(fournisseurToClients, c.fournisseur_services_id, info);
        if (c.prestataire_id) addToMap(prestataireToClients, c.prestataire_id, info);
        if (c.fournisseur_services?.raison_sociale) addToMap(fournisseurNomToClients, c.fournisseur_services.raison_sociale.toUpperCase(), info);
        if (c.prestataire) {
          addToMap(fournisseurNomToClients, `${c.prestataire.nom} ${c.prestataire.prenom}`.toUpperCase().trim(), info);
          addToMap(fournisseurNomToClients, c.prestataire.nom.toUpperCase().trim(), info);
        }
      }
    }

    // Index ventes by clientId+period and clientNom+period
    const ventesByClientPeriod = new Map<string, FactureRow[]>();
    const ventesByClientNomPeriod = new Map<string, FactureRow[]>();
    for (const v of facturesVentes) {
      const d = new Date(v.date_emission);
      const period = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (v.destinataire_id) {
        const key = `${v.destinataire_id}|${period}`;
        if (!ventesByClientPeriod.has(key)) ventesByClientPeriod.set(key, []);
        ventesByClientPeriod.get(key)!.push(v);
      }
      const keyNom = `${v.destinataire_nom.toUpperCase()}|${period}`;
      if (!ventesByClientNomPeriod.has(keyNom)) ventesByClientNomPeriod.set(keyNom, []);
      ventesByClientNomPeriod.get(keyNom)!.push(v);
    }

    // Group achats by (prestataire, client, period) - deduplicate
    const groupMap = new Map<string, GroupeRapprochement>();
    const usedVenteIds = new Set<string>();

    for (const achat of facturesAchats) {
      const d = new Date(achat.date_emission);
      const mois = d.getMonth() + 1;
      const annee = d.getFullYear();
      const prestataire = achat.emetteur_nom;
      const period = `${annee}-${mois}`;
      const rapproche = !!achat.numero_rapprochement || achat.statut === "PAYEE";

      // Find linked clients
      let linkedClients: { clientId: string; clientNom: string }[] = [];
      if (achat.fournisseur_id && fournisseurToClients.has(achat.fournisseur_id))
        linkedClients = fournisseurToClients.get(achat.fournisseur_id)!;
      if (!linkedClients.length && achat.emetteur_id && prestataireToClients.has(achat.emetteur_id))
        linkedClients = prestataireToClients.get(achat.emetteur_id)!;
      if (!linkedClients.length) {
        const nomUpper = prestataire.toUpperCase().trim();
        if (fournisseurNomToClients.has(nomUpper)) linkedClients = fournisseurNomToClients.get(nomUpper)!;
      }

      const targets = linkedClients.length > 0 ? linkedClients : [{ clientId: "", clientNom: "-" }];

      for (const { clientId, clientNom } of targets) {
        const groupKey = `${prestataire}|${clientNom}|${period}`;

        if (!groupMap.has(groupKey)) {
          // Find ventes for this client+period
          let matchedVentes = clientId ? (ventesByClientPeriod.get(`${clientId}|${period}`) || []) : [];
          if (!matchedVentes.length && clientNom !== "-") {
            matchedVentes = ventesByClientNomPeriod.get(`${clientNom.toUpperCase()}|${period}`) || [];
          }
          // Deduplicate ventes
          const uniqueVentes = matchedVentes.filter(v => !usedVenteIds.has(v.id));
          uniqueVentes.forEach(v => usedVenteIds.add(v.id));

          groupMap.set(groupKey, {
            key: groupKey,
            prestataire,
            client: clientNom,
            mois,
            annee,
            moisLabel: MONTHS[mois - 1],
            achats: [],
            ventes: uniqueVentes.map(v => ({
              id: v.id,
              numero: v.numero_facture,
              ttc: v.total_ttc || 0,
              rapprochee: !!v.numero_rapprochement || v.statut === "PAYEE",
            })),
            totalAchatTTC: 0,
            totalVenteTTC: uniqueVentes.reduce((s, v) => s + (v.total_ttc || 0), 0),
            allVentesRapprochees: uniqueVentes.length > 0 && uniqueVentes.every(v => !!v.numero_rapprochement || v.statut === "PAYEE"),
            statutPaiement: "en_attente",
          });
        }

        const group = groupMap.get(groupKey)!;
        // Add achat if not already present
        if (!group.achats.some(a => a.id === achat.id)) {
          group.achats.push({ id: achat.id, numero: achat.numero_facture, ttc: achat.total_ttc || 0, rapproche });
          group.totalAchatTTC += achat.total_ttc || 0;
        }
      }
    }

    // Finalize statut
    for (const g of groupMap.values()) {
      g.statutPaiement = g.allVentesRapprochees ? "payable" : "en_attente";
    }

    return [...groupMap.values()].sort((a, b) => {
      if (a.annee !== b.annee) return a.annee - b.annee;
      if (a.mois !== b.mois) return a.mois - b.mois;
      return a.prestataire.localeCompare(b.prestataire);
    });
  }, [facturesAchats, facturesVentes, contrats, clients]);

  const uniquePrestataires = useMemo(() => [...new Set(groupes.map(g => g.prestataire))].sort(), [groupes]);
  const uniqueClients = useMemo(() => [...new Set(groupes.map(g => g.client).filter(c => c !== "-"))].sort(), [groupes]);
  const uniqueAnnees = useMemo(() => [...new Set(groupes.map(g => String(g.annee)))].sort().reverse(), [groupes]);

  const filteredGroupes = useMemo(() => {
    let filtered = groupes;
    if (filterAnnee !== "all") filtered = filtered.filter(g => String(g.annee) === filterAnnee);
    if (filterMois !== "all") filtered = filtered.filter(g => String(g.mois) === filterMois);
    if (filterPrestataire !== "all") filtered = filtered.filter(g => g.prestataire === filterPrestataire);
    if (filterClient !== "all") filtered = filtered.filter(g => g.client === filterClient);
    if (filterStatut !== "all") filtered = filtered.filter(g => g.statutPaiement === filterStatut);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(g =>
        g.prestataire.toLowerCase().includes(s) ||
        g.client.toLowerCase().includes(s) ||
        g.achats.some(a => a.numero.toLowerCase().includes(s)) ||
        g.ventes.some(v => v.numero.toLowerCase().includes(s))
      );
    }
    return filtered;
  }, [groupes, filterAnnee, filterMois, filterPrestataire, filterClient, filterStatut, searchTerm]);

  const kpis = useMemo(() => {
    const totalAchat = filteredGroupes.reduce((s, g) => s + g.totalAchatTTC, 0);
    const totalVente = filteredGroupes.reduce((s, g) => s + g.totalVenteTTC, 0);
    const totalPayable = filteredGroupes.filter(g => g.statutPaiement === "payable").reduce((s, g) => s + g.totalAchatTTC, 0);
    const totalEnAttente = filteredGroupes.filter(g => g.statutPaiement === "en_attente").reduce((s, g) => s + g.totalAchatTTC, 0);
    return { totalAchat, totalVente, totalPayable, totalEnAttente, marge: totalVente - totalAchat };
  }, [filteredGroupes]);

  const monthlyChartData = useMemo(() => {
    const map = new Map<string, { mois: string; ventes: number; achats: number; marge: number }>();
    for (const g of filteredGroupes) {
      const key = `${g.annee}-${String(g.mois).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, { mois: `${MONTHS[g.mois - 1].substring(0, 3)} ${g.annee}`, ventes: 0, achats: 0, marge: 0 });
      const e = map.get(key)!;
      e.achats += g.totalAchatTTC;
      e.ventes += g.totalVenteTTC;
      e.marge = e.ventes - e.achats;
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filteredGroupes]);

  const prestataireChartData = useMemo(() => {
    const map = new Map<string, { prestataire: string; payable: number; enAttente: number }>();
    for (const g of filteredGroupes) {
      if (!map.has(g.prestataire)) map.set(g.prestataire, { prestataire: g.prestataire, payable: 0, enAttente: 0 });
      const e = map.get(g.prestataire)!;
      if (g.statutPaiement === "payable") e.payable += g.totalAchatTTC;
      else e.enAttente += g.totalAchatTTC;
    }
    return [...map.values()].sort((a, b) => (b.payable + b.enAttente) - (a.payable + a.enAttente)).slice(0, 15);
  }, [filteredGroupes]);

  const fmt = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

  const handleExportExcel = () => {
    const rows: any[] = [];
    for (const g of filteredGroupes) {
      const maxLines = Math.max(g.achats.length, g.ventes.length, 1);
      for (let i = 0; i < maxLines; i++) {
        const a = g.achats[i];
        const v = g.ventes[i];
        rows.push({
          Mois: i === 0 ? g.moisLabel : "",
          Année: i === 0 ? g.annee : "",
          Client: i === 0 ? g.client : "",
          Prestataire: i === 0 ? g.prestataire : "",
          "N° Facture Achat": a?.numero || "",
          "Achat TTC": a ? Number(a.ttc.toFixed(2)) : "",
          "Achat Rapproché": a ? (a.rapproche ? "Oui" : "Non") : "",
          "N° Facture Vente": v?.numero || "",
          "Vente TTC": v ? Number(v.ttc.toFixed(2)) : "",
          "Vente Rapprochée": v ? (v.rapprochee ? "Oui" : "Non") : "",
          Statut: i === 0 ? (g.statutPaiement === "payable" ? "Payable" : "En attente") : "",
        });
      }
    }
    rows.push({});
    rows.push({ Mois: "TOTAUX", "Achat TTC": Number(kpis.totalAchat.toFixed(2)), "Vente TTC": Number(kpis.totalVente.toFixed(2)) });
    rows.push({ Mois: "Marge Brute", "Vente TTC": Number(kpis.marge.toFixed(2)) });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapprochement Prestataires");
    XLSX.writeFile(wb, `rapprochement_prestataires_${filterAnnee}.xlsx`);
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
          <h1 className="text-2xl font-bold">Rapprochement Prestataires</h1>
          <p className="text-sm text-muted-foreground">Pilotage des paiements prestataires en fonction des encaissements clients</p>
        </div>
        <Button onClick={handleExportExcel} disabled={filteredGroupes.length === 0} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total Payable</p>
                <p className="text-lg font-bold text-emerald-600">{fmt(kpis.totalPayable)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-xs text-muted-foreground">En Attente</p>
                <p className="text-lg font-bold text-amber-600">{fmt(kpis.totalEnAttente)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total Achats TTC</p>
                <p className="text-lg font-bold">{fmt(kpis.totalAchat)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total Ventes TTC</p>
                <p className="text-lg font-bold">{fmt(kpis.totalVente)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-5 w-5 ${kpis.marge >= 0 ? "text-emerald-500" : "text-red-500"}`} />
              <div>
                <p className="text-xs text-muted-foreground">Marge Brute</p>
                <p className={`text-lg font-bold ${kpis.marge >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(kpis.marge)}</p>
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
            <Select value={filterPrestataire} onValueChange={setFilterPrestataire}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Prestataire" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous prestataires</SelectItem>
                {uniquePrestataires.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
                <SelectItem value="payable">Payable</SelectItem>
                <SelectItem value="en_attente">En attente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grouped detail: two side-by-side tables per group */}
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
                    {g.moisLabel} {g.annee} — <span className="text-primary">{g.client}</span> — {g.prestataire}
                  </CardTitle>
                  {g.statutPaiement === "payable" ? (
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px]">
                      <CheckCircle className="h-3 w-3 mr-1" /> Payable
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-400 text-amber-600 text-[10px]">
                      <Clock className="h-3 w-3 mr-1" /> En attente
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span>Achats: <strong>{fmt(g.totalAchatTTC)}</strong></span>
                  <span>Ventes: <strong>{fmt(g.totalVenteTTC)}</strong></span>
                  <span className={g.totalVenteTTC - g.totalAchatTTC >= 0 ? "text-emerald-600" : "text-red-600"}>
                    Marge: <strong>{fmt(g.totalVenteTTC - g.totalAchatTTC)}</strong>
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
                {/* Achats table */}
                <div>
                  <div className="px-4 py-2 bg-muted/30 border-b">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Factures d'Achat ({g.achats.length})</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">N° Facture</TableHead>
                        <TableHead className="text-xs text-right">Montant TTC</TableHead>
                        <TableHead className="text-xs text-center">Rapproché</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.achats.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">Aucune facture</TableCell></TableRow>
                      ) : g.achats.map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs font-mono">{a.numero}</TableCell>
                          <TableCell className="text-xs text-right font-medium">{fmt(a.ttc)}</TableCell>
                          <TableCell className="text-xs text-center">
                            <Badge variant={a.rapproche ? "default" : "secondary"} className={`text-[10px] ${a.rapproche ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}`}>
                              {a.rapproche ? "Oui" : "Non"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Ventes table */}
                <div>
                  <div className="px-4 py-2 bg-muted/30 border-b">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Factures de Vente ({g.ventes.length})</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">N° Facture</TableHead>
                        <TableHead className="text-xs text-right">Montant TTC</TableHead>
                        <TableHead className="text-xs text-center">Rapprochée</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.ventes.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">Aucune facture</TableCell></TableRow>
                      ) : g.ventes.map(v => (
                        <TableRow key={v.id}>
                          <TableCell className="text-xs font-mono">{v.numero}</TableCell>
                          <TableCell className="text-xs text-right font-medium">{fmt(v.ttc)}</TableCell>
                          <TableCell className="text-xs text-center">
                            <Badge variant={v.rapprochee ? "default" : "secondary"} className={`text-[10px] ${v.rapprochee ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}`}>
                              {v.rapprochee ? "Oui" : "Non"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Global totals */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-end gap-6 text-sm font-medium">
            <span>Total Achats TTC: <strong>{fmt(kpis.totalAchat)}</strong></span>
            <span>Total Ventes TTC: <strong>{fmt(kpis.totalVente)}</strong></span>
            <span className={kpis.marge >= 0 ? "text-emerald-600" : "text-red-600"}>Marge: <strong>{fmt(kpis.marge)}</strong></span>
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
                  <Bar dataKey="ventes" name="Ventes TTC" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="achats" name="Achats TTC" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="marge" name="Marge" fill="hsl(142, 76%, 36%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Aucune donnée</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base">Statut par prestataire</CardTitle>
          </CardHeader>
          <CardContent>
            {prestataireChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={prestataireChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="prestataire" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="payable" name="Payable" fill="hsl(142, 76%, 36%)" stackId="a" />
                  <Bar dataKey="enAttente" name="En attente" fill="hsl(38, 92%, 50%)" stackId="a" />
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
