import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, DollarSign, Percent } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

interface KPI {
  caMois: number;
  margeMois: number;
  caAnnuel: number;
  margeAnnuelle: number;
  tauxMarge: number;
}

interface TopClient {
  id: string;
  raison_sociale: string;
  ca: number;
}

interface TopPrestataire {
  id: string;
  nom: string;
  prenom: string;
  montant: number;
}

export default function DashboardFinancier() {
  const [loading, setLoading] = useState(true);
  const [anneeSelectionnee, setAnneeSelectionnee] = useState(new Date().getFullYear());
  const [moisSelectionne, setMoisSelectionne] = useState<number | null>(null);
  const [kpis, setKpis] = useState<KPI>({
    caMois: 0,
    margeMois: 0,
    caAnnuel: 0,
    margeAnnuelle: 0,
    tauxMarge: 0,
  });
  const [caMensuel, setCaMensuel] = useState<any[]>([]);
  const [margeMensuelle, setMargeMensuelle] = useState<any[]>([]);
  const [repartitionCA, setRepartitionCA] = useState<any[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [topPrestataires, setTopPrestataires] = useState<TopPrestataire[]>([]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--chart-1))', 'hsl(var(--chart-2))'];

  useEffect(() => {
    loadData();
  }, [anneeSelectionnee, moisSelectionne]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadKPIs(),
        loadCAMensuel(),
        loadMargeMensuelle(),
        loadRepartitionCA(),
        loadTopClients(),
        loadTopPrestataires(),
      ]);
    } catch (error) {
      console.error("Erreur chargement données:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadKPIs = async () => {
    const debutAnnee = moisSelectionne !== null 
      ? startOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
      : startOfYear(new Date(anneeSelectionnee, 0, 1));
    const finAnnee = moisSelectionne !== null
      ? endOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
      : endOfYear(new Date(anneeSelectionnee, 11, 31));
    const debutMois = moisSelectionne !== null
      ? startOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
      : startOfMonth(new Date());
    const finMois = moisSelectionne !== null
      ? endOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
      : endOfMonth(new Date());

    // CA et ventes
    const { data: facturesAnnee } = await supabase
      .from("factures")
      .select("total_ht")
      .gte("date_emission", format(debutAnnee, "yyyy-MM-dd"))
      .lte("date_emission", format(finAnnee, "yyyy-MM-dd"));

    const { data: facturesMois } = await supabase
      .from("factures")
      .select("total_ht")
      .gte("date_emission", format(debutMois, "yyyy-MM-dd"))
      .lte("date_emission", format(finMois, "yyyy-MM-dd"));

    // Achats
    const { data: achatsAnnee } = await supabase
      .from("factures")
      .select("total_ht")
      .eq("type_facture", "ACHATS")
      .gte("date_emission", format(debutAnnee, "yyyy-MM-dd"))
      .lte("date_emission", format(finAnnee, "yyyy-MM-dd"));

    const { data: achatsMois } = await supabase
      .from("factures")
      .select("total_ht")
      .eq("type_facture", "ACHATS")
      .gte("date_emission", format(debutMois, "yyyy-MM-dd"))
      .lte("date_emission", format(finMois, "yyyy-MM-dd"));

    const caAnnuel = facturesAnnee?.reduce((sum, f) => sum + Number(f.total_ht || 0), 0) || 0;
    const caMois = facturesMois?.reduce((sum, f) => sum + Number(f.total_ht || 0), 0) || 0;
    const achatsAnnuels = achatsAnnee?.reduce((sum, f) => sum + Number(f.total_ht || 0), 0) || 0;
    const achatsMensuels = achatsMois?.reduce((sum, f) => sum + Number(f.total_ht || 0), 0) || 0;

    const margeAnnuelle = caAnnuel - achatsAnnuels;
    const margeMois = caMois - achatsMensuels;
    const tauxMarge = caAnnuel > 0 ? (margeAnnuelle / caAnnuel) * 100 : 0;

    setKpis({
      caMois,
      margeMois,
      caAnnuel,
      margeAnnuelle,
      tauxMarge,
    });
  };

  const loadCAMensuel = async () => {
    const data = [];
    for (let mois = 0; mois < 12; mois++) {
      const debut = startOfMonth(new Date(anneeSelectionnee, mois, 1));
      const fin = endOfMonth(new Date(anneeSelectionnee, mois, 1));

      const { data: factures } = await supabase
        .from("factures")
        .select("total_ht")
        .gte("date_emission", format(debut, "yyyy-MM-dd"))
        .lte("date_emission", format(fin, "yyyy-MM-dd"));

      const ca = factures?.reduce((sum, f) => sum + Number(f.total_ht || 0), 0) || 0;

      data.push({
        mois: format(debut, "MMM", { locale: fr }),
        ca: Math.round(ca),
      });
    }
    setCaMensuel(data);
  };

  const loadMargeMensuelle = async () => {
    const data = [];
    for (let mois = 0; mois < 12; mois++) {
      const debut = startOfMonth(new Date(anneeSelectionnee, mois, 1));
      const fin = endOfMonth(new Date(anneeSelectionnee, mois, 1));

      const { data: factures } = await supabase
        .from("factures")
        .select("total_ht")
        .gte("date_emission", format(debut, "yyyy-MM-dd"))
        .lte("date_emission", format(fin, "yyyy-MM-dd"));

      const { data: achats } = await supabase
        .from("factures")
        .select("total_ht")
        .eq("type_facture", "ACHATS")
        .gte("date_emission", format(debut, "yyyy-MM-dd"))
        .lte("date_emission", format(fin, "yyyy-MM-dd"));

      const ca = factures?.reduce((sum, f) => sum + Number(f.total_ht || 0), 0) || 0;
      const achat = achats?.reduce((sum, f) => sum + Number(f.total_ht || 0), 0) || 0;
      const marge = ca - achat;

      data.push({
        mois: format(debut, "MMM", { locale: fr }),
        marge: Math.round(marge),
      });
    }
    setMargeMensuelle(data);
  };

  const loadRepartitionCA = async () => {
    const debutAnnee = moisSelectionne !== null 
      ? startOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
      : startOfYear(new Date(anneeSelectionnee, 0, 1));
    const finAnnee = moisSelectionne !== null
      ? endOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
      : endOfYear(new Date(anneeSelectionnee, 11, 31));

    const { data: factures, error } = await supabase
      .from("factures")
      .select("total_ht, mission_id, missions(type_mission)")
      .gte("date_emission", format(debutAnnee, "yyyy-MM-dd"))
      .lte("date_emission", format(finAnnee, "yyyy-MM-dd"))
      .neq("type_facture", "ACHATS");

    if (error) {
      console.error("Erreur loadRepartitionCA:", error);
    }

    const repartition: Record<string, number> = {};
    factures?.forEach((f: any) => {
      const type = f.missions?.type_mission || "Ventes diverses";
      repartition[type] = (repartition[type] || 0) + Number(f.total_ht || 0);
    });

    const data = Object.entries(repartition)
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
      }))
      .filter(item => item.value > 0);

    setRepartitionCA(data);
  };

  const loadTopClients = async () => {
    const debutAnnee = moisSelectionne !== null 
      ? startOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
      : startOfYear(new Date(anneeSelectionnee, 0, 1));
    const finAnnee = moisSelectionne !== null
      ? endOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
      : endOfYear(new Date(anneeSelectionnee, 11, 31));

    const { data: factures, error } = await supabase
      .from("factures")
      .select("client_id, total_ht, clients(raison_sociale)")
      .gte("date_emission", format(debutAnnee, "yyyy-MM-dd"))
      .lte("date_emission", format(finAnnee, "yyyy-MM-dd"))
      .neq("type_facture", "ACHATS")
      .not("client_id", "is", null);

    if (error) {
      console.error("Erreur loadTopClients:", error);
    }

    const caParClient: Record<string, { raison_sociale: string; ca: number }> = {};
    factures?.forEach((f: any) => {
      if (f.client_id && f.clients?.raison_sociale) {
        if (!caParClient[f.client_id]) {
          caParClient[f.client_id] = { raison_sociale: f.clients.raison_sociale, ca: 0 };
        }
        caParClient[f.client_id].ca += Number(f.total_ht || 0);
      }
    });

    const top = Object.entries(caParClient)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 5);

    setTopClients(top);
  };

  const loadTopPrestataires = async () => {
    const debutAnnee = moisSelectionne !== null 
      ? startOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
      : startOfYear(new Date(anneeSelectionnee, 0, 1));
    const finAnnee = moisSelectionne !== null
      ? endOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
      : endOfYear(new Date(anneeSelectionnee, 11, 31));

    const { data: achats, error } = await supabase
      .from("factures")
      .select("fournisseur_id, total_ht, prestataires(nom, prenom)")
      .eq("type_facture", "ACHATS")
      .gte("date_emission", format(debutAnnee, "yyyy-MM-dd"))
      .lte("date_emission", format(finAnnee, "yyyy-MM-dd"))
      .not("fournisseur_id", "is", null);

    if (error) {
      console.error("Erreur loadTopPrestataires:", error);
    }

    const montantParPrestataire: Record<string, { nom: string; prenom: string; montant: number }> = {};
    achats?.forEach((a: any) => {
      if (a.fournisseur_id && a.prestataires) {
        if (!montantParPrestataire[a.fournisseur_id]) {
          montantParPrestataire[a.fournisseur_id] = {
            nom: a.prestataires.nom,
            prenom: a.prestataires.prenom,
            montant: 0,
          };
        }
        montantParPrestataire[a.fournisseur_id].montant += Number(a.total_ht || 0);
      }
    });

    const top = Object.entries(montantParPrestataire)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.montant - a.montant)
      .slice(0, 5);

    setTopPrestataires(top);
  };

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
        <h1 className="text-3xl font-bold">Dashboard Financier</h1>
        <div className="flex gap-4">
          <select
            value={anneeSelectionnee}
            onChange={(e) => setAnneeSelectionnee(Number(e.target.value))}
            className="border rounded-md px-4 py-2 bg-background"
          >
            {[2023, 2024, 2025].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <select
            value={moisSelectionne ?? ""}
            onChange={(e) => setMoisSelectionne(e.target.value ? Number(e.target.value) : null)}
            className="border rounded-md px-4 py-2 bg-background"
          >
            <option value="">Toute l'année</option>
            {[
              { value: 0, label: "Janvier" },
              { value: 1, label: "Février" },
              { value: 2, label: "Mars" },
              { value: 3, label: "Avril" },
              { value: 4, label: "Mai" },
              { value: 5, label: "Juin" },
              { value: 6, label: "Juillet" },
              { value: 7, label: "Août" },
              { value: 8, label: "Septembre" },
              { value: 9, label: "Octobre" },
              { value: 10, label: "Novembre" },
              { value: 11, label: "Décembre" },
            ].map((mois) => (
              <option key={mois.value} value={mois.value}>
                {mois.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA du Mois</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.caMois.toLocaleString("fr-FR")} €</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marge du Mois</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.margeMois.toLocaleString("fr-FR")} €</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA Annuel</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.caAnnuel.toLocaleString("fr-FR")} €</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marge Annuelle</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.margeAnnuelle.toLocaleString("fr-FR")} €</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de Marge</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.tauxMarge.toFixed(1)} %</div>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques principaux */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>CA Mensuel {anneeSelectionnee}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={caMensuel}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mois" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="ca" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marge Mensuelle {anneeSelectionnee}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={margeMensuelle}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mois" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="marge" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Répartition et Tops */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Répartition CA par Activité</CardTitle>
          </CardHeader>
          <CardContent>
            {repartitionCA.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={repartitionCA} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {repartitionCA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Aucune donnée disponible</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topClients.length > 0 ? (
                topClients.map((client, index) => (
                  <div key={client.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-muted-foreground">#{index + 1}</span>
                      <span className="text-sm">{client.raison_sociale}</span>
                    </div>
                    <span className="font-bold">{client.ca.toLocaleString("fr-FR")} €</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée disponible</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Prestataires</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topPrestataires.length > 0 ? (
                topPrestataires.map((prestataire, index) => (
                  <div key={prestataire.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-muted-foreground">#{index + 1}</span>
                      <span className="text-sm">
                        {prestataire.prenom} {prestataire.nom}
                      </span>
                    </div>
                    <span className="font-bold">{prestataire.montant.toLocaleString("fr-FR")} €</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée disponible</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
