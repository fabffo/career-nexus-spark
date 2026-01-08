import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, DollarSign, Percent } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth, subMonths, getDate } from "date-fns";
import { fr } from "date-fns/locale";

interface KPI {
  ca: number;
  achatServices: number;
  achat: number;
  abonnements: number;
  chargesSociales: number;
  margeBrute: number;
  margeNette: number;
  tauxMargeBrute: number;
  tauxMargeNette: number;
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

// Calculer le dernier mois terminé par défaut
const getDefaultMonth = (): { year: number; month: number } => {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  const currentYear = now.getFullYear();
  
  // Si on est en janvier, le dernier mois terminé est décembre de l'année précédente
  if (currentMonth === 0) {
    return { year: currentYear - 1, month: 11 }; // Décembre
  }
  // Sinon, c'est le mois précédent de l'année courante
  return { year: currentYear, month: currentMonth - 1 };
};

const defaultPeriod = getDefaultMonth();

export default function DashboardFinancier() {
  const [loading, setLoading] = useState(true);
  const [anneeSelectionnee, setAnneeSelectionnee] = useState(defaultPeriod.year);
  const [moisSelectionne, setMoisSelectionne] = useState<number | null>(defaultPeriod.month);
  const [kpis, setKpis] = useState<KPI>({
    ca: 0,
    achatServices: 0,
    achat: 0,
    abonnements: 0,
    chargesSociales: 0,
    margeBrute: 0,
    margeNette: 0,
    tauxMargeBrute: 0,
    tauxMargeNette: 0,
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
    const debut = moisSelectionne !== null 
      ? startOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
      : startOfYear(new Date(anneeSelectionnee, 0, 1));
    const fin = moisSelectionne !== null
      ? endOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
      : endOfYear(new Date(anneeSelectionnee, 11, 31));

    // CA = Factures de ventes
    const { data: facturesVentes } = await supabase
      .from("factures")
      .select("total_ht")
      .neq("type_facture", "ACHATS")
      .gte("date_emission", format(debut, "yyyy-MM-dd"))
      .lte("date_emission", format(fin, "yyyy-MM-dd"));

    // Toutes les factures d'achat avec vérification fournisseurs de services et prestataires
    const { data: toutesFacturesAchats } = await supabase
      .from("factures")
      .select(`
        total_ht, 
        emetteur_nom,
        emetteur_id
      `)
      .eq("type_facture", "ACHATS")
      .gte("date_emission", format(debut, "yyyy-MM-dd"))
      .lte("date_emission", format(fin, "yyyy-MM-dd"));

    // Récupérer tous les types de fournisseurs pour identification correcte
    const { data: fournisseursServices } = await supabase
      .from("fournisseurs_services")
      .select("raison_sociale");
    
    const { data: fournisseursGeneraux } = await supabase
      .from("fournisseurs_generaux")
      .select("raison_sociale");
    
    const { data: fournisseursEtatOrganismes } = await supabase
      .from("fournisseurs_etat_organismes")
      .select("raison_sociale");

    // Créer une map des types de fournisseurs (même logique que FacturesAchats)
    const fournisseurTypesMap = new Map<string, string>();
    
    fournisseursServices?.forEach(f => {
      if (f.raison_sociale) {
        fournisseurTypesMap.set(f.raison_sociale.toLowerCase().trim(), "SERVICES");
      }
    });
    
    fournisseursGeneraux?.forEach(f => {
      if (f.raison_sociale) {
        fournisseurTypesMap.set(f.raison_sociale.toLowerCase().trim(), "GENERAUX");
      }
    });
    
    fournisseursEtatOrganismes?.forEach(f => {
      if (f.raison_sociale) {
        fournisseurTypesMap.set(f.raison_sociale.toLowerCase().trim(), "ETAT_ORGANISMES");
      }
    });

    // Abonnements - uniquement ceux de type CHARGE
    const { data: paiementsAbonnements } = await supabase
      .from("paiements_abonnements")
      .select("montant, abonnement:abonnements_partenaires!inner(type)")
      .eq("abonnement.type", "CHARGE")
      .gte("date_paiement", format(debut, "yyyy-MM-dd"))
      .lte("date_paiement", format(fin, "yyyy-MM-dd"));

    // Charges sociales - basées sur la date effective (pas la date de paiement)
    const { data: paiementsCharges } = await supabase
      .from("paiements_declarations_charges")
      .select(`
        id,
        date_paiement,
        montant,
        declaration:declarations_charges_sociales(type_charge)
      `);

    // Fonction pour calculer la date effective
    const getDateEffective = (datePaiement: string, typeCharge?: string, chargeId?: string, allCharges?: any[]): Date => {
      const date = new Date(datePaiement);
      const jour = getDate(date);
      
      // Pour RETRAITE: M-1 pour 1ère ligne, M-2 pour 2ème, M-3 pour 3ème
      if (typeCharge === "RETRAITE" && allCharges && chargeId) {
        const retraitesSameDate = allCharges
          .filter((c: any) => c.declaration?.type_charge === "RETRAITE" && c.date_paiement === datePaiement)
          .sort((a: any, b: any) => a.id.localeCompare(b.id));
        const index = retraitesSameDate.findIndex((c: any) => c.id === chargeId);
        const rang = index >= 0 ? index + 1 : 1;
        return subMonths(date, rang);
      }
      // Pour SALAIRE: si jour entre 1 et 15, mois précédent
      if (typeCharge === "SALAIRE" && jour >= 1 && jour <= 15) {
        return subMonths(date, 1);
      }
      return date;
    };

    // Filtrer les charges par date effective
    const chargesFiltered = paiementsCharges?.filter((c: any) => {
      const dateEff = getDateEffective(c.date_paiement, c.declaration?.type_charge, c.id, paiementsCharges);
      return dateEff >= debut && dateEff <= fin;
    }) || [];

    const ca = facturesVentes?.reduce((sum, f) => sum + Number(f.total_ht || 0), 0) || 0;
    
    // Séparer achat services et autres achats (même logique que FacturesAchats)
    let achatServices = 0;
    let autresAchatsTotal = 0;
    
    toutesFacturesAchats?.forEach((f: any) => {
      const montant = Number(f.total_ht || 0);
      if (!f.emetteur_nom) {
        autresAchatsTotal += montant;
        return;
      }
      
      const emetteurKey = f.emetteur_nom.toLowerCase().trim();
      const typeFournisseur = fournisseurTypesMap.get(emetteurKey);
      
      // Les achats SERVICES sont comptés séparément
      if (typeFournisseur === "SERVICES") {
        achatServices += montant;
      } else {
        // GENERAUX, ETAT_ORGANISMES et non identifiés vont dans autres achats
        autresAchatsTotal += montant;
      }
    });
    
    const abonnementsTotal = paiementsAbonnements?.reduce((sum, p) => sum + Number(p.montant || 0), 0) || 0;
    
    // Total des charges sociales filtrées par date effective
    const chargesTotal = chargesFiltered.reduce(
      (sum, c: any) => sum + Math.abs(Number(c.montant || 0)),
      0
    );
    
    // Achat = uniquement les factures d'achat généraux (hors services)
    const achat = autresAchatsTotal;
    const margeBrute = ca - achatServices;
    // Marge nette = Marge brute - Achat - Abonnements - Charges sociales
    const margeNette = margeBrute - achat - abonnementsTotal - chargesTotal;
    const tauxMargeBrute = ca > 0 ? (margeBrute / ca) * 100 : 0;
    const tauxMargeNette = ca > 0 ? (margeNette / ca) * 100 : 0;

    setKpis({
      ca,
      achatServices,
      achat,
      abonnements: abonnementsTotal,
      chargesSociales: chargesTotal,
      margeBrute,
      margeNette,
      tauxMargeBrute,
      tauxMargeNette,
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
        .neq("type_facture", "ACHATS")
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
      .select("total_ht, activite")
      .eq("type_facture", "VENTES")
      .gte("date_emission", format(debutAnnee, "yyyy-MM-dd"))
      .lte("date_emission", format(finAnnee, "yyyy-MM-dd"));

    if (error) {
      console.error("Erreur loadRepartitionCA:", error);
    }

    const repartition: Record<string, number> = {};
    factures?.forEach((f: any) => {
      const activite = f.activite || "Autres";
      repartition[activite] = (repartition[activite] || 0) + Number(f.total_ht || 0);
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
      .select("destinataire_id, destinataire_nom, total_ht")
      .eq("type_facture", "VENTES")
      .gte("date_emission", format(debutAnnee, "yyyy-MM-dd"))
      .lte("date_emission", format(finAnnee, "yyyy-MM-dd"));

    if (error) {
      console.error("Erreur loadTopClients:", error);
    }

    // Grouper par nom du client (pas par ID car certaines factures n'ont pas de destinataire_id)
    const caParClient: Record<string, { raison_sociale: string; ca: number }> = {};
    factures?.forEach((f: any) => {
      if (f.destinataire_nom) {
        const nomNormalise = f.destinataire_nom.trim().toUpperCase();
        if (!caParClient[nomNormalise]) {
          caParClient[nomNormalise] = { raison_sociale: f.destinataire_nom, ca: 0 };
        }
        caParClient[nomNormalise].ca += Number(f.total_ht || 0);
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
      .select("emetteur_nom, total_ht")
      .eq("type_facture", "ACHATS")
      .gte("date_emission", format(debutAnnee, "yyyy-MM-dd"))
      .lte("date_emission", format(finAnnee, "yyyy-MM-dd"));

    if (error) {
      console.error("Erreur loadTopPrestataires:", error);
    }

    // Grouper par nom du fournisseur
    const montantParPrestataire: Record<string, { nom: string; prenom: string; montant: number }> = {};
    achats?.forEach((a: any) => {
      if (a.emetteur_nom) {
        const nomNormalise = a.emetteur_nom.trim().toUpperCase();
        if (!montantParPrestataire[nomNormalise]) {
          montantParPrestataire[nomNormalise] = {
            prenom: '',
            nom: a.emetteur_nom,
            montant: 0,
          };
        }
        montantParPrestataire[nomNormalise].montant += Number(a.total_ht || 0);
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.ca.toLocaleString("fr-FR")} €</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Achat Services</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.achatServices.toLocaleString("fr-FR")} €</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marge Brute</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.margeBrute.toLocaleString("fr-FR")} €</div>
            <p className="text-xs text-muted-foreground">
              {kpis.tauxMargeBrute.toFixed(1)} %
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Achat</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.achat.toLocaleString("fr-FR")} €</div>
            <p className="text-xs text-muted-foreground">Factures généraux</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abonnements</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.abonnements.toLocaleString("fr-FR")} €</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Charges Sociales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.chargesSociales.toLocaleString("fr-FR")} €</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marge Nette</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.margeNette.toLocaleString("fr-FR")} €</div>
            <p className="text-xs text-muted-foreground">
              {kpis.tauxMargeNette.toFixed(1)} %
            </p>
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
