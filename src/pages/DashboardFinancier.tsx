import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, DollarSign, Percent } from "lucide-react";
import { KPIDetailDialog, KPIType } from "@/components/KPIDetailDialog";
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

interface TopMargeNetteClient {
  id: string;
  raison_sociale: string;
  ca: number;
  achatsServices: number;
  margeNette: number;
}

interface RepartitionActivite {
  activite: string;
  margeEuros: number;
  nombreFactures: number;
  nombreContrats: number;
  nombreClients: number;
}

// Calculer l'année du dernier mois terminé par défaut
const getDefaultYear = (): number => {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  const currentYear = now.getFullYear();
  
  // Si on est en janvier, le dernier mois terminé est décembre de l'année précédente
  if (currentMonth === 0) {
    return currentYear - 1;
  }
  return currentYear;
};

export default function DashboardFinancier() {
  const [loading, setLoading] = useState(true);
  const [anneeSelectionnee, setAnneeSelectionnee] = useState(getDefaultYear());
  const [moisSelectionne, setMoisSelectionne] = useState<number | null>(null);
  const [selectedKPI, setSelectedKPI] = useState<KPIType | null>(null);
  const [showKPIDetail, setShowKPIDetail] = useState(false);
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
  const [margeDetaillee, setMargeDetaillee] = useState<any[]>([]);
  const [repartitionCA, setRepartitionCA] = useState<any[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [topMargeNetteClients, setTopMargeNetteClients] = useState<TopMargeNetteClient[]>([]);
  const [repartitionActivites, setRepartitionActivites] = useState<RepartitionActivite[]>([]);
  const [nombreClientsTotal, setNombreClientsTotal] = useState<number>(0);

  const handleKPIClick = (kpiType: KPIType) => {
    setSelectedKPI(kpiType);
    setShowKPIDetail(true);
  };

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
        loadTopMargeNetteClients(),
        loadRepartitionActivites(),
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

    // CA = Factures de ventes uniquement (type_facture = 'VENTES')
    const { data: facturesVentes } = await supabase
      .from("factures")
      .select("total_ht")
      .eq("type_facture", "VENTES")
      .gte("date_emission", format(debut, "yyyy-MM-dd"))
      .lte("date_emission", format(fin, "yyyy-MM-dd"));

    // Factures d'achat SERVICES
    const { data: facturesAchatsServices } = await supabase
      .from("factures")
      .select("total_ht")
      .eq("type_facture", "ACHATS_SERVICES")
      .gte("date_emission", format(debut, "yyyy-MM-dd"))
      .lte("date_emission", format(fin, "yyyy-MM-dd"));

    // Factures d'achat GENERAUX
    const { data: facturesAchatsGeneraux } = await supabase
      .from("factures")
      .select("total_ht")
      .eq("type_facture", "ACHATS_GENERAUX")
      .gte("date_emission", format(debut, "yyyy-MM-dd"))
      .lte("date_emission", format(fin, "yyyy-MM-dd"));

    // Abonnements - uniquement ceux de type CHARGE, calculer HT à partir du TTC
    const { data: paiementsAbonnements } = await supabase
      .from("paiements_abonnements")
      .select("montant, abonnement:abonnements_partenaires!inner(type, tva)")
      .eq("abonnement.type", "CHARGE")
      .gte("date_paiement", format(debut, "yyyy-MM-dd"))
      .lte("date_paiement", format(fin, "yyyy-MM-dd"));
    
    // Fonction pour calculer le montant HT à partir du TTC et du taux TVA
    const calculerMontantHT = (montantTTC: number, tvaStr: string | null): number => {
      if (!tvaStr) return montantTTC;
      
      const tvaMapping: Record<string, number> = {
        'normal': 20, 'normale': 20,
        'reduit': 5.5, 'réduit': 5.5, 'reduite': 5.5, 'réduite': 5.5,
        'intermediaire': 10, 'intermédiaire': 10,
        'super_reduit': 2.1, 'super_réduit': 2.1,
        'exonere': 0, 'exonéré': 0, 'exoneree': 0, 'exonérée': 0,
      };
      
      const tvaLower = tvaStr.toLowerCase().trim();
      let tauxTva = 0;
      
      if (tvaMapping[tvaLower] !== undefined) {
        tauxTva = tvaMapping[tvaLower];
      } else {
        const tvaMatch = tvaStr.match(/(\d+(?:[.,]\d+)?)/);
        tauxTva = tvaMatch ? parseFloat(tvaMatch[1].replace(',', '.')) : 0;
      }
      
      return montantTTC / (1 + tauxTva / 100);
    };

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
    
    // ⭐ Calcul direct depuis les types de facture ACHATS_SERVICES et ACHATS_GENERAUX
    const achatServices = facturesAchatsServices?.reduce((sum, f) => sum + Number(f.total_ht || 0), 0) || 0;
    const achat = facturesAchatsGeneraux?.reduce((sum, f) => sum + Number(f.total_ht || 0), 0) || 0;
    
    const abonnementsTotal = paiementsAbonnements?.reduce((sum, p: any) => {
      const montantHT = calculerMontantHT(Number(p.montant || 0), p.abonnement?.tva);
      return sum + montantHT;
    }, 0) || 0;
    
    // Total des charges sociales filtrées par date effective
    const chargesTotal = chargesFiltered.reduce(
      (sum, c: any) => sum + Math.abs(Number(c.montant || 0)),
      0
    );
    
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

  // Fonction pour calculer le montant HT à partir du TTC et du taux TVA (pour marge mensuelle)
  const calculerMontantHTMarge = (montantTTC: number, tvaStr: string | null): number => {
    if (!tvaStr) return montantTTC;
    
    const tvaMapping: Record<string, number> = {
      'normal': 20, 'normale': 20,
      'reduit': 5.5, 'réduit': 5.5, 'reduite': 5.5, 'réduite': 5.5,
      'intermediaire': 10, 'intermédiaire': 10,
      'super_reduit': 2.1, 'super_réduit': 2.1,
      'exonere': 0, 'exonéré': 0, 'exoneree': 0, 'exonérée': 0,
    };
    
    const tvaLower = tvaStr.toLowerCase().trim();
    let tauxTva = 0;
    
    if (tvaMapping[tvaLower] !== undefined) {
      tauxTva = tvaMapping[tvaLower];
    } else {
      const tvaMatch = tvaStr.match(/(\d+(?:[.,]\d+)?)/);
      tauxTva = tvaMatch ? parseFloat(tvaMatch[1].replace(',', '.')) : 0;
    }
    
    return montantTTC / (1 + tauxTva / 100);
  };

  // Fonction pour calculer la date effective des charges
  const getDateEffectiveMarge = (datePaiement: string, typeCharge?: string, chargeId?: string, allCharges?: any[]): Date => {
    const date = new Date(datePaiement);
    const jour = getDate(date);
    
    if (typeCharge === "RETRAITE" && allCharges && chargeId) {
      const retraitesSameDate = allCharges
        .filter((c: any) => c.declaration?.type_charge === "RETRAITE" && c.date_paiement === datePaiement)
        .sort((a: any, b: any) => a.id.localeCompare(b.id));
      const index = retraitesSameDate.findIndex((c: any) => c.id === chargeId);
      const rang = index >= 0 ? index + 1 : 1;
      return subMonths(date, rang);
    }
    if (typeCharge === "SALAIRE" && jour >= 1 && jour <= 15) {
      return subMonths(date, 1);
    }
    return date;
  };

  const loadMargeMensuelle = async () => {
    const data = [];
    const detailData = [];
    let margeCumulee = 0;

    // Charger toutes les charges sociales une fois
    const { data: paiementsCharges } = await supabase
      .from("paiements_declarations_charges")
      .select(`id, date_paiement, montant, declaration:declarations_charges_sociales(type_charge)`);

    // Charger tous les abonnements une fois
    const { data: paiementsAbonnements } = await supabase
      .from("paiements_abonnements")
      .select("montant, date_paiement, abonnement:abonnements_partenaires!inner(type, tva)")
      .eq("abonnement.type", "CHARGE")
      .gte("date_paiement", `${anneeSelectionnee}-01-01`)
      .lte("date_paiement", `${anneeSelectionnee}-12-31`);
    
    for (let mois = 0; mois < 12; mois++) {
      const debut = startOfMonth(new Date(anneeSelectionnee, mois, 1));
      const fin = endOfMonth(new Date(anneeSelectionnee, mois, 1));

      // CA = Ventes uniquement
      const { data: facturesVentes } = await supabase
        .from("factures")
        .select("total_ht")
        .eq("type_facture", "VENTES")
        .gte("date_emission", format(debut, "yyyy-MM-dd"))
        .lte("date_emission", format(fin, "yyyy-MM-dd"));

      // Achats Services
      const { data: achatsServices } = await supabase
        .from("factures")
        .select("total_ht")
        .eq("type_facture", "ACHATS_SERVICES")
        .gte("date_emission", format(debut, "yyyy-MM-dd"))
        .lte("date_emission", format(fin, "yyyy-MM-dd"));

      // Achats Généraux
      const { data: achatsGeneraux } = await supabase
        .from("factures")
        .select("total_ht")
        .eq("type_facture", "ACHATS_GENERAUX")
        .gte("date_emission", format(debut, "yyyy-MM-dd"))
        .lte("date_emission", format(fin, "yyyy-MM-dd"));

      // Abonnements du mois
      const abonnementsMois = paiementsAbonnements?.filter((p: any) => {
        const datePaiement = new Date(p.date_paiement);
        return datePaiement >= debut && datePaiement <= fin;
      }) || [];

      const abonnementsTotal = abonnementsMois.reduce((sum, p: any) => {
        const montantHT = calculerMontantHTMarge(Number(p.montant || 0), p.abonnement?.tva);
        return sum + montantHT;
      }, 0);

      // Charges sociales du mois (par date effective)
      const chargesFiltered = paiementsCharges?.filter((c: any) => {
        const dateEff = getDateEffectiveMarge(c.date_paiement, c.declaration?.type_charge, c.id, paiementsCharges);
        return dateEff >= debut && dateEff <= fin;
      }) || [];

      const chargesTotal = chargesFiltered.reduce(
        (sum, c: any) => sum + Math.abs(Number(c.montant || 0)),
        0
      );

      const ca = facturesVentes?.reduce((sum, f) => sum + Number(f.total_ht || 0), 0) || 0;
      const achatServicesTotal = achatsServices?.reduce((sum, f) => sum + Number(f.total_ht || 0), 0) || 0;
      const achatGenerauxTotal = achatsGeneraux?.reduce((sum, f) => sum + Number(f.total_ht || 0), 0) || 0;
      
      // Marge nette du mois = CA - Achats Services - Achats Généraux - Abonnements - Charges Sociales
      const margeNetteMois = ca - achatServicesTotal - achatGenerauxTotal - abonnementsTotal - chargesTotal;
      
      // Marge nette cumulée
      margeCumulee += margeNetteMois;

      data.push({
        mois: format(debut, "MMM", { locale: fr }),
        marge: Math.round(margeCumulee),
      });

      // Données détaillées pour le tableau
      detailData.push({
        moisIndex: mois,
        moisLabel: format(debut, "MMMM", { locale: fr }),
        ca: Math.round(ca),
        achatServices: Math.round(achatServicesTotal),
        achatGeneraux: Math.round(achatGenerauxTotal),
        abonnements: Math.round(abonnementsTotal),
        chargesSociales: Math.round(chargesTotal),
        margeNette: Math.round(margeNetteMois),
        margeCumulee: Math.round(margeCumulee),
      });
    }
    setMargeMensuelle(data);
    setMargeDetaillee(detailData);
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
      .slice(0, 10);

    setTopClients(top);
  };

  const loadTopMargeNetteClients = async () => {
    const debutAnnee = moisSelectionne !== null 
      ? startOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
      : startOfYear(new Date(anneeSelectionnee, 0, 1));
    const finAnnee = moisSelectionne !== null
      ? endOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
      : endOfYear(new Date(anneeSelectionnee, 11, 31));

    // 1. Récupérer les factures de ventes par client
    const { data: facturesVentes } = await supabase
      .from("factures")
      .select("destinataire_id, destinataire_nom, total_ht")
      .eq("type_facture", "VENTES")
      .gte("date_emission", format(debutAnnee, "yyyy-MM-dd"))
      .lte("date_emission", format(finAnnee, "yyyy-MM-dd"));

    // 2. Récupérer les factures d'achat de services avec le fournisseur de services
    const { data: facturesAchatsServices } = await supabase
      .from("factures")
      .select("emetteur_id, emetteur_nom, total_ht")
      .eq("type_facture", "ACHATS_SERVICES")
      .gte("date_emission", format(debutAnnee, "yyyy-MM-dd"))
      .lte("date_emission", format(finAnnee, "yyyy-MM-dd"));

    // 3. Récupérer les contrats fournisseurs de services avec leurs clients liés
    const { data: contratsFournisseurs } = await supabase
      .from("contrats")
      .select(`
        fournisseur_services_id,
        client_lie_id,
        client_lie:clients!contrats_client_lie_id_fkey(id, raison_sociale)
      `)
      .eq("type", "FOURNISSEUR_SERVICES")
      .not("fournisseur_services_id", "is", null)
      .not("client_lie_id", "is", null);

    // 4. Récupérer les contrats salariés avec leurs clients liés et charges sociales associées
    const { data: contratsSalaries } = await (supabase as any)
      .from("contrats")
      .select(`
        id,
        salarie_id,
        client_lie_id,
        client_lie:clients!contrats_client_lie_id_fkey(id, raison_sociale)
      `)
      .eq("type", "SALARIE")
      .not("salarie_id", "is", null)
      .not("client_lie_id", "is", null);

    // 5. Récupérer les associations contrats-charges sociales
    const { data: contratsCharges } = await (supabase as any)
      .from("contrats_charges_sociales")
      .select("contrat_id, declaration_charge_id");

    // 6. Récupérer les paiements de charges sociales
    const { data: paiementsCharges } = await supabase
      .from("paiements_declarations_charges")
      .select(`id, date_paiement, montant, declaration_charge_id, declaration:declarations_charges_sociales(type_charge)`)
      .gte("date_paiement", format(debutAnnee, "yyyy-MM-dd"))
      .lte("date_paiement", format(finAnnee, "yyyy-MM-dd"));

    // 7. Récupérer les fournisseurs de services pour faire le lien via le nom
    const { data: fournisseursServices } = await supabase
      .from("fournisseurs_services")
      .select("id, raison_sociale");

    // Créer un mapping fournisseur_services_id -> client_id
    const fournisseurToClientMap: Record<string, { clientId: string; clientNom: string }> = {};
    contratsFournisseurs?.forEach((c: any) => {
      if (c.fournisseur_services_id && c.client_lie_id && c.client_lie) {
        fournisseurToClientMap[c.fournisseur_services_id] = {
          clientId: c.client_lie_id,
          clientNom: c.client_lie.raison_sociale
        };
      }
    });

    // Créer un mapping contrat_id -> client info pour les contrats salariés
    const contratSalarieToClientMap: Record<string, { clientId: string; clientNom: string }> = {};
    contratsSalaries?.forEach((c: any) => {
      if (c.id && c.client_lie_id && c.client_lie) {
        contratSalarieToClientMap[c.id] = {
          clientId: c.client_lie_id,
          clientNom: c.client_lie.raison_sociale
        };
      }
    });

    // Créer un mapping declaration_charge_id -> contrat_id (pour lier les charges aux contrats salariés)
    const chargeToContratMap: Record<string, string[]> = {};
    contratsCharges?.forEach((cc: any) => {
      if (!chargeToContratMap[cc.declaration_charge_id]) {
        chargeToContratMap[cc.declaration_charge_id] = [];
      }
      chargeToContratMap[cc.declaration_charge_id].push(cc.contrat_id);
    });

    // Créer un mapping nom fournisseur -> fournisseur_id
    const nomToFournisseurId: Record<string, string> = {};
    fournisseursServices?.forEach((f: any) => {
      nomToFournisseurId[f.raison_sociale.trim().toUpperCase()] = f.id;
    });

    // Grouper le CA par client (via destinataire_nom)
    const caParClient: Record<string, { raison_sociale: string; ca: number; achatsServices: number; chargesSociales: number }> = {};
    
    facturesVentes?.forEach((f: any) => {
      if (f.destinataire_nom) {
        const nomNormalise = f.destinataire_nom.trim().toUpperCase();
        if (!caParClient[nomNormalise]) {
          caParClient[nomNormalise] = { raison_sociale: f.destinataire_nom, ca: 0, achatsServices: 0, chargesSociales: 0 };
        }
        caParClient[nomNormalise].ca += Number(f.total_ht || 0);
      }
    });

    // Grouper les achats de services par client lié
    facturesAchatsServices?.forEach((f: any) => {
      // Trouver le fournisseur_services_id à partir du nom ou de l'ID
      let fournisseurId = f.emetteur_id;
      
      if (!fournisseurId && f.emetteur_nom) {
        const nomNormalise = f.emetteur_nom.trim().toUpperCase();
        fournisseurId = nomToFournisseurId[nomNormalise];
      }

      if (fournisseurId && fournisseurToClientMap[fournisseurId]) {
        const clientInfo = fournisseurToClientMap[fournisseurId];
        const clientNomNormalise = clientInfo.clientNom.trim().toUpperCase();
        
        if (!caParClient[clientNomNormalise]) {
          caParClient[clientNomNormalise] = { raison_sociale: clientInfo.clientNom, ca: 0, achatsServices: 0, chargesSociales: 0 };
        }
        caParClient[clientNomNormalise].achatsServices += Number(f.total_ht || 0);
      }
    });

    // Grouper les charges sociales par client lié via contrats salariés
    paiementsCharges?.forEach((p: any) => {
      const declarationId = p.declaration_charge_id;
      if (!declarationId) return;

      // Trouver les contrats salariés liés à cette charge
      const contratIds = chargeToContratMap[declarationId] || [];
      
      contratIds.forEach(contratId => {
        const clientInfo = contratSalarieToClientMap[contratId];
        if (clientInfo) {
          const clientNomNormalise = clientInfo.clientNom.trim().toUpperCase();
          
          if (!caParClient[clientNomNormalise]) {
            caParClient[clientNomNormalise] = { raison_sociale: clientInfo.clientNom, ca: 0, achatsServices: 0, chargesSociales: 0 };
          }
          // Répartir la charge entre tous les contrats liés à cette déclaration
          const montantParContrat = Math.abs(Number(p.montant || 0)) / contratIds.length;
          caParClient[clientNomNormalise].chargesSociales += montantParContrat;
        }
      });
    });

    // Calculer la marge nette par client et trier
    // Marge nette client = CA - Achats Services - Charges Sociales liées
    const margesClients = Object.entries(caParClient)
      .map(([id, data]) => ({
        id,
        raison_sociale: data.raison_sociale,
        ca: data.ca,
        achatsServices: data.achatsServices + data.chargesSociales, // On combine dans achatsServices pour l'affichage
        margeNette: data.ca - data.achatsServices - data.chargesSociales
      }))
      .filter(c => c.ca > 0 || c.achatsServices > 0)
      .sort((a, b) => b.margeNette - a.margeNette)
      .slice(0, 10);

    setTopMargeNetteClients(margesClients);
  };

  const loadRepartitionActivites = async () => {
    const debutAnnee = moisSelectionne !== null 
      ? startOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
      : startOfYear(new Date(anneeSelectionnee, 0, 1));
    const finAnnee = moisSelectionne !== null
      ? endOfMonth(new Date(anneeSelectionnee, moisSelectionne, 1))
      : endOfYear(new Date(anneeSelectionnee, 11, 31));

    // 1. Récupérer les factures de ventes avec activité et client
    const { data: facturesVentes } = await supabase
      .from("factures")
      .select("id, total_ht, activite, destinataire_id, destinataire_nom")
      .eq("type_facture", "VENTES")
      .gte("date_emission", format(debutAnnee, "yyyy-MM-dd"))
      .lte("date_emission", format(finAnnee, "yyyy-MM-dd"));

    // 2. Récupérer les factures d'achat de services avec activité
    const { data: facturesAchats } = await supabase
      .from("factures")
      .select("id, total_ht, activite")
      .eq("type_facture", "ACHATS_SERVICES")
      .gte("date_emission", format(debutAnnee, "yyyy-MM-dd"))
      .lte("date_emission", format(finAnnee, "yyyy-MM-dd"));

    // 3. Récupérer les contrats fournisseurs pour Prestation
    const { data: contratsFournisseurs } = await supabase
      .from("contrats")
      .select("id")
      .eq("type", "FOURNISSEUR_SERVICES")
      .eq("statut", "ACTIF")
      .gte("date_debut", format(debutAnnee, "yyyy-MM-dd"))
      .lte("date_debut", format(finAnnee, "yyyy-MM-dd"));

    // 4. Récupérer le nombre de clients
    const { count: nombreClients } = await supabase
      .from("clients")
      .select("*", { count: 'exact', head: true });

    // Calculer par activité avec clients uniques
    const activites: Record<string, { ca: number; achats: number; nbFacturesVentes: number; nbContrats: number; clientsSet: Set<string> }> = {
      'Prestation': { ca: 0, achats: 0, nbFacturesVentes: 0, nbContrats: contratsFournisseurs?.length || 0, clientsSet: new Set() },
      'Formation': { ca: 0, achats: 0, nbFacturesVentes: 0, nbContrats: 0, clientsSet: new Set() },
      'Recrutement': { ca: 0, achats: 0, nbFacturesVentes: 0, nbContrats: 0, clientsSet: new Set() },
    };

    // Agréger les ventes par activité et collecter les clients uniques
    facturesVentes?.forEach((f: any) => {
      const activite = f.activite || 'Prestation';
      const activiteNorm = activite.charAt(0).toUpperCase() + activite.slice(1).toLowerCase();
      const clientId = f.destinataire_id || f.destinataire_nom || 'unknown';
      
      if (activites[activiteNorm]) {
        activites[activiteNorm].ca += Number(f.total_ht || 0);
        activites[activiteNorm].nbFacturesVentes += 1;
        if (clientId) activites[activiteNorm].clientsSet.add(clientId);
      } else if (activiteNorm.includes('Formation')) {
        activites['Formation'].ca += Number(f.total_ht || 0);
        activites['Formation'].nbFacturesVentes += 1;
        if (clientId) activites['Formation'].clientsSet.add(clientId);
      } else if (activiteNorm.includes('Recrutement')) {
        activites['Recrutement'].ca += Number(f.total_ht || 0);
        activites['Recrutement'].nbFacturesVentes += 1;
        if (clientId) activites['Recrutement'].clientsSet.add(clientId);
      } else {
        activites['Prestation'].ca += Number(f.total_ht || 0);
        activites['Prestation'].nbFacturesVentes += 1;
        if (clientId) activites['Prestation'].clientsSet.add(clientId);
      }
    });

    // Agréger les achats par activité
    facturesAchats?.forEach((f: any) => {
      const activite = f.activite || 'Prestation';
      const activiteNorm = activite.charAt(0).toUpperCase() + activite.slice(1).toLowerCase();
      
      if (activites[activiteNorm]) {
        activites[activiteNorm].achats += Number(f.total_ht || 0);
      } else if (activiteNorm.includes('Formation')) {
        activites['Formation'].achats += Number(f.total_ht || 0);
      } else if (activiteNorm.includes('Recrutement')) {
        activites['Recrutement'].achats += Number(f.total_ht || 0);
      } else {
        activites['Prestation'].achats += Number(f.total_ht || 0);
      }
    });

    // Construire le résultat
    const result: RepartitionActivite[] = Object.entries(activites).map(([activite, data]) => ({
      activite,
      margeEuros: Math.round(data.ca - data.achats),
      nombreFactures: data.nbFacturesVentes,
      nombreContrats: data.nbContrats,
      nombreClients: data.clientsSet.size,
    }));

    setRepartitionActivites(result);
    setNombreClientsTotal(nombreClients || 0);
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

      {/* Répartition par Activité */}
      <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Répartition de la Marge par Activité</CardTitle>
            <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
              {nombreClientsTotal} client{nombreClientsTotal > 1 ? 's' : ''} au total
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {repartitionActivites.map((item) => (
              <div 
                key={item.activite} 
                className="bg-card rounded-lg p-4 border shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="text-sm font-medium text-muted-foreground mb-2">{item.activite}</h3>
                <p className="text-xl font-bold text-primary">
                  {item.margeEuros.toLocaleString("fr-FR")} €
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {item.activite === 'Prestation' 
                    ? `${item.nombreContrats} contrat${item.nombreContrats > 1 ? 's' : ''} fournisseur${item.nombreContrats > 1 ? 's' : ''}`
                    : `${item.nombreFactures} facture${item.nombreFactures > 1 ? 's' : ''}`
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.nombreClients} client{item.nombreClients > 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleKPIClick("ca")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.ca.toLocaleString("fr-FR")} €</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleKPIClick("achatServices")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Achat Services</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.achatServices.toLocaleString("fr-FR")} €</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleKPIClick("margeBrute")}>
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

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleKPIClick("achat")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Achat</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.achat.toLocaleString("fr-FR")} €</div>
            <p className="text-xs text-muted-foreground">Factures généraux</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleKPIClick("abonnements")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abonnements</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.abonnements.toLocaleString("fr-FR")} €</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleKPIClick("chargesSociales")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Charges Sociales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.chargesSociales.toLocaleString("fr-FR")} €</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleKPIClick("margeNette")}>
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

      {/* Dialog détail KPI */}
      <KPIDetailDialog
        open={showKPIDetail}
        onOpenChange={setShowKPIDetail}
        kpiType={selectedKPI}
        annee={anneeSelectionnee}
        mois={moisSelectionne}
      />
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
            <CardTitle>Marge Nette Cumulée {anneeSelectionnee}</CardTitle>
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

      {/* Graphique Marge Nette par Mois */}
      <Card>
        <CardHeader>
          <CardTitle>Marge Nette par Mois {anneeSelectionnee}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={margeDetaillee}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="moisLabel" />
              <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
              <Tooltip 
                formatter={(value: number) => [`${value.toLocaleString("fr-FR")} €`]}
                labelFormatter={(label) => label.charAt(0).toUpperCase() + label.slice(1)}
              />
              <Legend />
              <Bar dataKey="margeNette" name="Marge Nette" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

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
            <CardTitle>Top 10 Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {topClients.length > 0 ? (
                topClients.map((client, index) => (
                  <div key={client.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-muted-foreground">#{index + 1}</span>
                      <span className="text-sm truncate max-w-[150px]">{client.raison_sociale}</span>
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
            <CardTitle>Top 10 Marge Nette Client</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {topMargeNetteClients.length > 0 ? (
                topMargeNetteClients.map((client, index) => (
                  <div key={client.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-muted-foreground">#{index + 1}</span>
                      <span className="text-sm truncate max-w-[120px]">{client.raison_sociale}</span>
                    </div>
                    <div className="flex flex-col items-end text-xs">
                      <span className={`font-bold ${client.margeNette >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {client.margeNette.toLocaleString("fr-FR")} €
                      </span>
                      <span className="text-muted-foreground">
                        CA: {client.ca.toLocaleString("fr-FR")} € - Achats: {client.achatsServices.toLocaleString("fr-FR")} €
                      </span>
                    </div>
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
