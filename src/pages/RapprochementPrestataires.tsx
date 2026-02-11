import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, Search, CheckCircle, Clock, AlertTriangle, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import * as XLSX from "xlsx";

// Types
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

interface LigneRapprochement {
  prestataire: string;
  client: string;
  mois: number;
  annee: number;
  moisLabel: string;
  factureAchatId: string;
  numeroFactureAchat: string;
  achatTTC: number;
  achatRapproche: boolean;
  factureVenteId: string | null;
  numeroFactureVente: string | null;
  venteTTC: number;
  venteRapprochee: boolean;
  statutPaiement: "payable" | "en_attente";
}

type SortKey = keyof LigneRapprochement;
type SortDir = "asc" | "desc";

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

  // Filters
  const [filterMois, setFilterMois] = useState<string>("all");
  const [filterAnnee, setFilterAnnee] = useState<string>(String(new Date().getFullYear()));
  const [filterPrestataire, setFilterPrestataire] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("mois");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 25;

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
        supabase
          .from("clients")
          .select("id, raison_sociale"),
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

  // Build the reconciliation lines using contracts to link achats → prestataire → client → ventes
  const lignes = useMemo<LigneRapprochement[]>(() => {
    // Build contract lookup: fournisseur_services_id → client info
    // A fournisseur contract links a fournisseur (with prestataires) to a client (client_lie_id)
    const fournisseurToClients = new Map<string, { clientId: string; clientNom: string }[]>();
    const prestataireToClients = new Map<string, { clientId: string; clientNom: string }[]>();

    for (const c of contrats) {
      if (c.type === "FOURNISSEUR_SERVICES" && c.client_lie_id && c.client_lie) {
        const clientInfo = { clientId: c.client_lie.id, clientNom: c.client_lie.raison_sociale };
        
        // Map by fournisseur_services_id
        if (c.fournisseur_services_id) {
          if (!fournisseurToClients.has(c.fournisseur_services_id)) fournisseurToClients.set(c.fournisseur_services_id, []);
          const existing = fournisseurToClients.get(c.fournisseur_services_id)!;
          if (!existing.some(e => e.clientId === clientInfo.clientId)) existing.push(clientInfo);
        }
        
        // Map by prestataire_id
        if (c.prestataire_id) {
          if (!prestataireToClients.has(c.prestataire_id)) prestataireToClients.set(c.prestataire_id, []);
          const existing = prestataireToClients.get(c.prestataire_id)!;
          if (!existing.some(e => e.clientId === clientInfo.clientId)) existing.push(clientInfo);
        }
      }
    }

    // Also build a name-based lookup for fournisseurs and prestataires
    const fournisseurNomToClients = new Map<string, { clientId: string; clientNom: string }[]>();
    for (const c of contrats) {
      if (c.type === "FOURNISSEUR_SERVICES" && c.client_lie_id && c.client_lie) {
        const clientInfo = { clientId: c.client_lie.id, clientNom: c.client_lie.raison_sociale };
        
        if (c.fournisseur_services?.raison_sociale) {
          const nom = c.fournisseur_services.raison_sociale.toUpperCase();
          if (!fournisseurNomToClients.has(nom)) fournisseurNomToClients.set(nom, []);
          const existing = fournisseurNomToClients.get(nom)!;
          if (!existing.some(e => e.clientId === clientInfo.clientId)) existing.push(clientInfo);
        }
        if (c.prestataire) {
          const nom = `${c.prestataire.nom} ${c.prestataire.prenom}`.toUpperCase().trim();
          if (!fournisseurNomToClients.has(nom)) fournisseurNomToClients.set(nom, []);
          const existing = fournisseurNomToClients.get(nom)!;
          if (!existing.some(e => e.clientId === clientInfo.clientId)) existing.push(clientInfo);
          // Also by nom only
          const nomOnly = c.prestataire.nom.toUpperCase().trim();
          if (!fournisseurNomToClients.has(nomOnly)) fournisseurNomToClients.set(nomOnly, []);
          const existingNom = fournisseurNomToClients.get(nomOnly)!;
          if (!existingNom.some(e => e.clientId === clientInfo.clientId)) existingNom.push(clientInfo);
        }
      }
    }

    // Index sales by client_id + period
    const ventesByClientPeriod = new Map<string, FactureRow[]>();
    // Also index by client name + period as fallback
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

    const result: LigneRapprochement[] = [];

    for (const achat of facturesAchats) {
      const d = new Date(achat.date_emission);
      const mois = d.getMonth() + 1;
      const annee = d.getFullYear();
      const prestataire = achat.emetteur_nom;
      const achatRapproche = !!achat.numero_rapprochement || achat.statut === "PAYEE";
      const period = `${annee}-${mois}`;

      // Find client(s) linked via contracts
      let linkedClients: { clientId: string; clientNom: string }[] = [];

      // 1. Try by fournisseur_id on the invoice
      if (achat.fournisseur_id && fournisseurToClients.has(achat.fournisseur_id)) {
        linkedClients = fournisseurToClients.get(achat.fournisseur_id)!;
      }
      // 2. Try by emetteur_id as prestataire
      if (linkedClients.length === 0 && achat.emetteur_id && prestataireToClients.has(achat.emetteur_id)) {
        linkedClients = prestataireToClients.get(achat.emetteur_id)!;
      }
      // 3. Fallback: try by emetteur_nom
      if (linkedClients.length === 0) {
        const nomUpper = prestataire.toUpperCase().trim();
        if (fournisseurNomToClients.has(nomUpper)) {
          linkedClients = fournisseurNomToClients.get(nomUpper)!;
        }
      }

      if (linkedClients.length > 0) {
        // For each linked client, find matching sales invoice
        for (const { clientId, clientNom } of linkedClients) {
          // Try by client ID first
          let matchedVentes = ventesByClientPeriod.get(`${clientId}|${period}`) || [];
          // Fallback by client name
          if (matchedVentes.length === 0) {
            matchedVentes = ventesByClientNomPeriod.get(`${clientNom.toUpperCase()}|${period}`) || [];
          }

          const bestVente = matchedVentes.length > 0 ? matchedVentes[0] : null;
          const venteRapprochee = bestVente ? (!!bestVente.numero_rapprochement || bestVente.statut === "PAYEE") : false;

          result.push({
            prestataire,
            client: clientNom,
            mois,
            annee,
            moisLabel: MONTHS[mois - 1],
            factureAchatId: achat.id,
            numeroFactureAchat: achat.numero_facture,
            achatTTC: achat.total_ttc || 0,
            achatRapproche,
            factureVenteId: bestVente?.id || null,
            numeroFactureVente: bestVente?.numero_facture || null,
            venteTTC: bestVente?.total_ttc || 0,
            venteRapprochee,
            statutPaiement: venteRapprochee ? "payable" : "en_attente",
          });
        }
      } else {
        // No contract link found
        result.push({
          prestataire,
          client: "-",
          mois,
          annee,
          moisLabel: MONTHS[mois - 1],
          factureAchatId: achat.id,
          numeroFactureAchat: achat.numero_facture,
          achatTTC: achat.total_ttc || 0,
          achatRapproche,
          factureVenteId: null,
          numeroFactureVente: null,
          venteTTC: 0,
          venteRapprochee: false,
          statutPaiement: "en_attente",
        });
      }
    }

    return result;
  }, [facturesAchats, facturesVentes, contrats, clients]);

  // Get unique values for filters
  const uniquePrestataires = useMemo(() => [...new Set(lignes.map(l => l.prestataire))].sort(), [lignes]);
  const uniqueClients = useMemo(() => [...new Set(lignes.map(l => l.client).filter(c => c !== "-"))].sort(), [lignes]);
  const uniqueAnnees = useMemo(() => [...new Set(lignes.map(l => String(l.annee)))].sort().reverse(), [lignes]);

  // Filtered + sorted
  const filteredLignes = useMemo(() => {
    let filtered = lignes;
    if (filterAnnee !== "all") filtered = filtered.filter(l => String(l.annee) === filterAnnee);
    if (filterMois !== "all") filtered = filtered.filter(l => String(l.mois) === filterMois);
    if (filterPrestataire !== "all") filtered = filtered.filter(l => l.prestataire === filterPrestataire);
    if (filterClient !== "all") filtered = filtered.filter(l => l.client === filterClient);
    if (filterStatut !== "all") filtered = filtered.filter(l => l.statutPaiement === filterStatut);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(l =>
        l.prestataire.toLowerCase().includes(s) ||
        l.client.toLowerCase().includes(s) ||
        l.numeroFactureAchat.toLowerCase().includes(s) ||
        (l.numeroFactureVente || "").toLowerCase().includes(s)
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    return filtered;
  }, [lignes, filterAnnee, filterMois, filterPrestataire, filterClient, filterStatut, searchTerm, sortKey, sortDir]);

  // Paginated
  const paginatedLignes = useMemo(() => filteredLignes.slice(page * pageSize, (page + 1) * pageSize), [filteredLignes, page]);
  const totalPages = Math.ceil(filteredLignes.length / pageSize);

  // KPIs
  const kpis = useMemo(() => {
    const totalAchat = filteredLignes.reduce((s, l) => s + l.achatTTC, 0);
    const totalVente = filteredLignes.reduce((s, l) => s + l.venteTTC, 0);
    const totalPayable = filteredLignes.filter(l => l.statutPaiement === "payable").reduce((s, l) => s + l.achatTTC, 0);
    const totalEnAttente = filteredLignes.filter(l => l.statutPaiement === "en_attente").reduce((s, l) => s + l.achatTTC, 0);
    const marge = totalVente - totalAchat;
    return { totalAchat, totalVente, totalPayable, totalEnAttente, marge };
  }, [filteredLignes]);

  // Chart data - monthly
  const monthlyChartData = useMemo(() => {
    const map = new Map<string, { mois: string; ventes: number; achats: number; marge: number }>();
    for (const l of filteredLignes) {
      const key = `${l.annee}-${String(l.mois).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, { mois: `${MONTHS[l.mois - 1].substring(0, 3)} ${l.annee}`, ventes: 0, achats: 0, marge: 0 });
      const entry = map.get(key)!;
      entry.achats += l.achatTTC;
      entry.ventes += l.venteTTC;
      entry.marge = entry.ventes - entry.achats;
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [filteredLignes]);

  // Chart data - by prestataire
  const prestataireChartData = useMemo(() => {
    const map = new Map<string, { prestataire: string; payable: number; enAttente: number }>();
    for (const l of filteredLignes) {
      if (!map.has(l.prestataire)) map.set(l.prestataire, { prestataire: l.prestataire, payable: 0, enAttente: 0 });
      const entry = map.get(l.prestataire)!;
      if (l.statutPaiement === "payable") entry.payable += l.achatTTC;
      else entry.enAttente += l.achatTTC;
    }
    return [...map.values()].sort((a, b) => (b.payable + b.enAttente) - (a.payable + a.enAttente)).slice(0, 15);
  }, [filteredLignes]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(0);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const fmt = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);

  const handleExportExcel = () => {
    const rows = filteredLignes.map(l => ({
      Mois: l.moisLabel,
      Année: l.annee,
      Client: l.client,
      Prestataire: l.prestataire,
      "N° Facture Achat": l.numeroFactureAchat,
      "Achat TTC": Number(l.achatTTC.toFixed(2)),
      "Achat Rapproché": l.achatRapproche ? "Oui" : "Non",
      "N° Facture Vente": l.numeroFactureVente || "",
      "Vente TTC": Number(l.venteTTC.toFixed(2)),
      "Vente Rapprochée": l.venteRapprochee ? "Oui" : "Non",
      "Statut Paiement": l.statutPaiement === "payable" ? "Payable" : "En attente encaissement",
    }));
    // Add totals
    rows.push({} as any);
    rows.push({ Mois: "TOTAUX", Année: 0, Client: "", Prestataire: "", "N° Facture Achat": "", "Achat TTC": Number(kpis.totalAchat.toFixed(2)), "Achat Rapproché": "", "N° Facture Vente": "", "Vente TTC": Number(kpis.totalVente.toFixed(2)), "Vente Rapprochée": "", "Statut Paiement": "" } as any);
    rows.push({ Mois: "Marge Brute", Année: 0, Client: "", Prestataire: "", "N° Facture Achat": "", "Achat TTC": 0, "Achat Rapproché": "", "N° Facture Vente": "", "Vente TTC": Number(kpis.marge.toFixed(2)), "Vente Rapprochée": "", "Statut Paiement": "" } as any);

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
        <Button onClick={handleExportExcel} disabled={filteredLignes.length === 0} variant="outline" size="sm">
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
              <Input placeholder="Rechercher..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(0); }} className="pl-9 h-9" />
            </div>
            <Select value={filterAnnee} onValueChange={v => { setFilterAnnee(v); setPage(0); }}>
              <SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {uniqueAnnees.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterMois} onValueChange={v => { setFilterMois(v); setPage(0); }}>
              <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Mois" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les mois</SelectItem>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPrestataire} onValueChange={v => { setFilterPrestataire(v); setPage(0); }}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Prestataire" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous prestataires</SelectItem>
                {uniquePrestataires.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterClient} onValueChange={v => { setFilterClient(v); setPage(0); }}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Client" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous clients</SelectItem>
                {uniqueClients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatut} onValueChange={v => { setFilterStatut(v); setPage(0); }}>
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

      {/* Table */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base">Détail par facture ({filteredLignes.length} lignes)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  {[
                    { key: "moisLabel" as SortKey, label: "Mois" },
                    { key: "annee" as SortKey, label: "Année" },
                    { key: "client" as SortKey, label: "Client" },
                    { key: "prestataire" as SortKey, label: "Prestataire" },
                    { key: "numeroFactureAchat" as SortKey, label: "N° Fact. Achat" },
                    { key: "achatTTC" as SortKey, label: "Achat TTC" },
                    { key: "achatRapproche" as SortKey, label: "Achat Rapp." },
                    { key: "numeroFactureVente" as SortKey, label: "N° Fact. Vente" },
                    { key: "venteTTC" as SortKey, label: "Vente TTC" },
                    { key: "venteRapprochee" as SortKey, label: "Vente Rapp." },
                    { key: "statutPaiement" as SortKey, label: "Statut" },
                  ].map(col => (
                    <TableHead key={col.key} className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort(col.key)}>
                      <div className="flex items-center gap-1">
                        {col.label}
                        <SortIcon col={col.key} />
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLignes.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Aucune donnée</TableCell></TableRow>
                ) : (
                  paginatedLignes.map((l, i) => (
                    <TableRow key={`${l.factureAchatId}-${i}`}>
                      <TableCell className="text-xs">{l.moisLabel}</TableCell>
                      <TableCell className="text-xs">{l.annee}</TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate" title={l.client}>{l.client}</TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate" title={l.prestataire}>{l.prestataire}</TableCell>
                      <TableCell className="text-xs font-mono">{l.numeroFactureAchat}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{fmt(l.achatTTC)}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={l.achatRapproche ? "default" : "secondary"} className={`text-[10px] ${l.achatRapproche ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}`}>
                          {l.achatRapproche ? "Oui" : "Non"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{l.numeroFactureVente || "-"}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{l.venteTTC > 0 ? fmt(l.venteTTC) : "-"}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={l.venteRapprochee ? "default" : "secondary"} className={`text-[10px] ${l.venteRapprochee ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}`}>
                          {l.venteRapprochee ? "Oui" : "Non"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {l.statutPaiement === "payable" ? (
                          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px]">
                            <CheckCircle className="h-3 w-3 mr-1" /> Payable
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-400 text-amber-600 text-[10px]">
                            <Clock className="h-3 w-3 mr-1" /> En attente
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Page {page + 1} sur {totalPages} ({filteredLignes.length} résultats)
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(0)}>«</Button>
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</Button>
              </div>
            </div>
          )}
          {/* Totals */}
          <div className="flex items-center justify-end gap-6 px-4 py-3 border-t bg-muted/30 text-sm font-medium">
            <span>Total Achats TTC: <strong>{fmt(kpis.totalAchat)}</strong></span>
            <span>Total Ventes TTC: <strong>{fmt(kpis.totalVente)}</strong></span>
            <span className={kpis.marge >= 0 ? "text-emerald-600" : "text-red-600"}>Marge: <strong>{fmt(kpis.marge)}</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly chart */}
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

        {/* By prestataire chart */}
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
