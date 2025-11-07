import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface LigneAnalyse {
  id: string;
  type: "VENTE" | "ACHAT";
  date: string;
  numero: string;
  partenaire: string;
  activite: string;
  montant_ht: number;
  montant_ttc: number;
  tva: number;
  marge?: number;
}

export default function AnalyseFinanciere() {
  const [loading, setLoading] = useState(true);
  const [lignes, setLignes] = useState<LigneAnalyse[]>([]);
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [mois, setMois] = useState<number | "all">("all");
  const [typeActivite, setTypeActivite] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [prestataireFilter, setPrestataireFilter] = useState<string>("all");

  const [clients, setClients] = useState<any[]>([]);
  const [prestataires, setPrestataires] = useState<any[]>([]);
  const [activites, setActivites] = useState<string[]>([]);

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadData();
  }, [annee, mois, typeActivite, clientFilter, prestataireFilter]);

  const loadFilters = async () => {
    const { data: clientsData } = await supabase.from("clients").select("id, raison_sociale").order("raison_sociale");
    const { data: prestData } = await supabase.from("prestataires").select("id, nom, prenom").order("nom");
    const { data: missionsData } = await supabase.from("missions").select("type_mission").not("type_mission", "is", null);

    setClients(clientsData || []);
    setPrestataires(prestData || []);

    const uniqueActivites = [...new Set(missionsData?.map((m) => m.type_mission).filter(Boolean))];
    setActivites(uniqueActivites as string[]);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const lignesData: LigneAnalyse[] = [];

      // Factures de vente
      const queryVentesBase: any = supabase
        .from("factures")
        .select("id, numero_facture, date_emission, total_ht, total_ttc, total_tva, clients(raison_sociale), missions(type_mission)")
        .eq("type_facture", "VENTES")
        .gte("date_emission", `${annee}-01-01`)
        .lte("date_emission", `${annee}-12-31`);

      let queryVentes = queryVentesBase;

      if (mois !== "all") {
        const moisStr = String(mois).padStart(2, "0");
        queryVentes = queryVentes
          .gte("date_emission", `${annee}-${moisStr}-01`)
          .lte("date_emission", `${annee}-${moisStr}-31`);
      }

      if (clientFilter !== "all") {
        queryVentes = queryVentes.eq("client_id", clientFilter);
      }

      const { data: ventes } = await queryVentes;

      ventes?.forEach((v: any) => {
        const activiteFacture = v.missions?.type_mission || "Autre";
        if (typeActivite === "all" || activiteFacture === typeActivite) {
          lignesData.push({
            id: v.id,
            type: "VENTE",
            date: v.date_emission,
            numero: v.numero_facture,
            partenaire: v.clients?.raison_sociale || "—",
            activite: activiteFacture,
            montant_ht: Number(v.total_ht || 0),
            montant_ttc: Number(v.total_ttc || 0),
            tva: Number(v.total_tva || 0),
          });
        }
      });

      // Factures d'achat
      const queryAchatsBase: any = supabase
        .from("factures")
        .select("id, numero_facture, date_emission, total_ht, total_ttc, total_tva, prestataires(nom, prenom)")
        .eq("type_facture", "ACHATS")
        .gte("date_emission", `${annee}-01-01`)
        .lte("date_emission", `${annee}-12-31`);

      let queryAchats = queryAchatsBase;

      if (mois !== "all") {
        const moisStr = String(mois).padStart(2, "0");
        queryAchats = queryAchats
          .gte("date_emission", `${annee}-${moisStr}-01`)
          .lte("date_emission", `${annee}-${moisStr}-31`);
      }

      if (prestataireFilter !== "all") {
        queryAchats = queryAchats.eq("fournisseur_id", prestataireFilter);
      }

      const { data: achats } = await queryAchats;

      achats?.forEach((a: any) => {
        if (typeActivite === "all" || typeActivite === "Autre") {
          lignesData.push({
            id: a.id,
            type: "ACHAT",
            date: a.date_emission,
            numero: a.numero_facture || "—",
            partenaire: a.prestataires ? `${a.prestataires.prenom} ${a.prestataires.nom}` : "—",
            activite: "Achat",
            montant_ht: Number(a.total_ht || 0),
            montant_ttc: Number(a.total_ttc || 0),
            tva: Number(a.total_tva || 0),
          });
        }
      });

      // Calcul de la marge
      const totalVentes = lignesData.filter((l) => l.type === "VENTE").reduce((sum, l) => sum + l.montant_ht, 0);
      const totalAchats = lignesData.filter((l) => l.type === "ACHAT").reduce((sum, l) => sum + l.montant_ht, 0);
      const margeGlobale = totalVentes - totalAchats;

      lignesData.forEach((ligne) => {
        if (ligne.type === "VENTE") {
          ligne.marge = ligne.montant_ht;
        } else {
          ligne.marge = -ligne.montant_ht;
        }
      });

      setLignes(lignesData);
    } catch (error) {
      console.error("Erreur chargement données:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      lignes.map((l) => ({
        Type: l.type,
        Date: format(new Date(l.date), "dd/MM/yyyy"),
        Numéro: l.numero,
        Partenaire: l.partenaire,
        Activité: l.activite,
        "Montant HT": l.montant_ht,
        "Montant TTC": l.montant_ttc,
        TVA: l.tva,
        Marge: l.marge,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analyse Financière");
    XLSX.writeFile(wb, `analyse_financiere_${annee}.xlsx`);
    toast.success("Export Excel réussi");
  };

  const columns: ColumnDef<LigneAnalyse>[] = [
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <span
          className={`px-2 py-1 rounded text-xs font-semibold ${
            row.original.type === "VENTE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {row.original.type}
        </span>
      ),
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => format(new Date(row.original.date), "dd/MM/yyyy"),
    },
    {
      accessorKey: "numero",
      header: "N° Facture",
    },
    {
      accessorKey: "partenaire",
      header: "Partenaire",
    },
    {
      accessorKey: "activite",
      header: "Activité",
    },
    {
      accessorKey: "montant_ht",
      header: "Montant HT",
      cell: ({ row }) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(row.original.montant_ht),
    },
    {
      accessorKey: "montant_ttc",
      header: "Montant TTC",
      cell: ({ row }) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(row.original.montant_ttc),
    },
    {
      accessorKey: "tva",
      header: "TVA",
      cell: ({ row }) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(row.original.tva),
    },
    {
      accessorKey: "marge",
      header: "Marge",
      cell: ({ row }) => {
        const marge = row.original.marge || 0;
        return (
          <span className={marge >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
            {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(marge)}
          </span>
        );
      },
    },
  ];

  const totalVentes = lignes.filter((l) => l.type === "VENTE").reduce((sum, l) => sum + l.montant_ht, 0);
  const totalAchats = lignes.filter((l) => l.type === "ACHAT").reduce((sum, l) => sum + l.montant_ht, 0);
  const margeTotal = totalVentes - totalAchats;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Analyse Financière Détaillée</h1>
        <Button onClick={exportExcel}>
          <Download className="h-4 w-4 mr-2" />
          Exporter Excel
        </Button>
      </div>

      {/* Filtres */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-card p-4 rounded-lg border">
        <div>
          <label className="text-sm font-medium mb-2 block">Année</label>
          <select value={annee} onChange={(e) => setAnnee(Number(e.target.value))} className="w-full border rounded-md px-3 py-2 bg-background">
            {[2023, 2024, 2025].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Mois</label>
          <select value={mois} onChange={(e) => setMois(e.target.value === "all" ? "all" : Number(e.target.value))} className="w-full border rounded-md px-3 py-2 bg-background">
            <option value="all">Tous</option>
            {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((nom, index) => (
              <option key={index + 1} value={index + 1}>
                {nom}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Activité</label>
          <select value={typeActivite} onChange={(e) => setTypeActivite(e.target.value)} className="w-full border rounded-md px-3 py-2 bg-background">
            <option value="all">Toutes</option>
            {activites.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Client</label>
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="w-full border rounded-md px-3 py-2 bg-background">
            <option value="all">Tous</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.raison_sociale}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Prestataire</label>
          <select value={prestataireFilter} onChange={(e) => setPrestataireFilter(e.target.value)} className="w-full border rounded-md px-3 py-2 bg-background">
            <option value="all">Tous</option>
            {prestataires.map((p) => (
              <option key={p.id} value={p.id}>
                {p.prenom} {p.nom}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <div className="text-sm text-muted-foreground">Total Ventes</div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-400">{totalVentes.toLocaleString("fr-FR")} €</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
          <div className="text-sm text-muted-foreground">Total Achats</div>
          <div className="text-2xl font-bold text-red-700 dark:text-red-400">{totalAchats.toLocaleString("fr-FR")} €</div>
        </div>
        <div className={`p-4 rounded-lg border ${margeTotal >= 0 ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"}`}>
          <div className="text-sm text-muted-foreground">Marge Totale</div>
          <div className={`text-2xl font-bold ${margeTotal >= 0 ? "text-blue-700 dark:text-blue-400" : "text-orange-700 dark:text-orange-400"}`}>{margeTotal.toLocaleString("fr-FR")} €</div>
        </div>
      </div>

      {/* Tableau */}
      <DataTable columns={columns} data={lignes} />
    </div>
  );
}
