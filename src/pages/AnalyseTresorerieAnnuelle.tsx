import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Download, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, getDate } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const MOIS_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

interface DetailParActivite {
  activite: string;
  montant: number;
  details: Array<{ libelle: string; montant: number; date: string }>;
}

interface MoisAnalyse {
  mois: number;
  moisLabel: string;
  soldeCompte: number;
  ventesParActivite: DetailParActivite[];
  achatsServicesParActivite: DetailParActivite[];
  chargesSalaires: number;
  chargesSociales: number;
  achatsGenerauxParActivite: DetailParActivite[];
  abonnementsParActivite: DetailParActivite[];
  totalVentes: number;
  totalAchatsServices: number;
  totalAchatsGeneraux: number;
  totalAbonnements: number;
  totalCharges: number;
}

// Fonction pour calculer le taux de TVA
const getTauxTva = (tvaStr: string | null): number => {
  if (!tvaStr) return 0;
  const tvaLower = tvaStr.toLowerCase().trim();
  if (tvaLower.includes("exon")) return 0;
  const tvaMatch = tvaStr.match(/(\d+(?:[.,]\d+)?)\s*%?/);
  if (tvaMatch) return parseFloat(tvaMatch[1].replace(",", "."));
  if (tvaLower.includes("normal")) return 20;
  if (tvaLower.includes("reduit") || tvaLower.includes("réduit")) return 5.5;
  if (tvaLower.includes("interm")) return 10;
  return 0;
};

// Fonction pour calculer HT depuis TTC
const calculerHT = (ttc: number, tauxTva: number): number => {
  return ttc / (1 + tauxTva / 100);
};

export default function AnalyseTresorerieAnnuelle() {
  const currentYear = new Date().getFullYear();
  const [annee, setAnnee] = useState(currentYear);
  const [expandedMonths, setExpandedMonths] = useState<number[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Récupérer les activités
  const { data: activites = [] } = useQuery({
    queryKey: ["param-activites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("param_activite")
        .select("code, libelle")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  // Factures de ventes (par date échéance)
  const { data: facturesVentes = [] } = useQuery({
    queryKey: ["analyse-tresorerie-ventes", annee],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("factures")
        .select("id, numero_facture, destinataire_nom, total_ht, date_echeance, activite")
        .eq("type_facture", "VENTES")
        .gte("date_echeance", `${annee}-01-01`)
        .lte("date_echeance", `${annee}-12-31`);
      if (error) throw error;
      return data || [];
    },
  });

  // Factures achats services (par date échéance)
  const { data: facturesAchatsServices = [] } = useQuery({
    queryKey: ["analyse-tresorerie-achats-services", annee],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("factures")
        .select("id, numero_facture, emetteur_nom, total_ht, date_echeance, activite")
        .eq("type_facture", "ACHATS_SERVICES")
        .gte("date_echeance", `${annee}-01-01`)
        .lte("date_echeance", `${annee}-12-31`);
      if (error) throw error;
      return data || [];
    },
  });

  // Factures achats généraux (par date émission = mois en cours)
  const { data: facturesAchatsGeneraux = [] } = useQuery({
    queryKey: ["analyse-tresorerie-achats-generaux", annee],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("factures")
        .select(`
          id, numero_facture, emetteur_nom, emetteur_id, total_ht, date_emission,
          fournisseur_general:fournisseurs_generaux(activite)
        `)
        .eq("type_facture", "ACHATS_GENERAUX")
        .gte("date_emission", `${annee}-01-01`)
        .lte("date_emission", `${annee}-12-31`);
      if (error) throw error;
      return data || [];
    },
  });

  // Abonnements (lignes rapprochement par date transaction = mois en cours)
  const { data: lignesAbonnements = [] } = useQuery({
    queryKey: ["analyse-tresorerie-abonnements", annee],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lignes_rapprochement")
        .select(`
          id,
          transaction_date,
          transaction_libelle,
          transaction_credit,
          transaction_debit,
          transaction_montant,
          total_ht,
          total_tva,
          total_ttc,
          abonnement:abonnements_partenaires(id, nom, activite, type, tva)
        `)
        .not("abonnement_id", "is", null)
        .gte("transaction_date", `${annee}-01-01`)
        .lte("transaction_date", `${annee}-12-31`);
      if (error) throw error;
      return data || [];
    },
  });

  // Charges salariales - depuis charges_salaries
  const { data: chargesSalaries = [] } = useQuery({
    queryKey: ["analyse-tresorerie-charges-salaries", annee],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("charges_salaries")
        .select(`
          id,
          date_paiement,
          montant,
          type_charge,
          rapprochement:rapprochements_bancaires(transaction_credit, transaction_debit)
        `)
        .gte("date_paiement", `${annee}-01-01`)
        .lte("date_paiement", `${annee}-12-31`);
      if (error) throw error;
      return data || [];
    },
  });

  // Paiements déclarations charges sociales
  const { data: paiementsCharges = [] } = useQuery({
    queryKey: ["analyse-tresorerie-paiements-charges", annee],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paiements_declarations_charges")
        .select(`
          id,
          date_paiement,
          montant,
          declaration:declarations_charges_sociales(type_charge, nom)
        `)
        .gte("date_paiement", `${annee}-01-01`)
        .lte("date_paiement", `${annee}-12-31`);
      if (error) throw error;
      return data || [];
    },
  });

  // Fonction pour déterminer la date effective des charges
  const getDateEffective = (datePaiement: string, typeCharge: string): Date => {
    const date = new Date(datePaiement);
    const jour = getDate(date);
    // Pour SALAIRE: si jour entre 1 et 15, mois précédent
    if (typeCharge === "SALAIRE" && jour >= 1 && jour <= 15) {
      return subMonths(date, 1);
    }
    return date;
  };

  // Fonction pour déterminer si c'est un crédit (remboursement)
  const isCredit = (charge: any): boolean => {
    if (charge.rapprochement) {
      return (Number(charge.rapprochement.transaction_credit) || 0) > 0;
    }
    return Number(charge.montant) < 0;
  };

  // Calcul des données mensuelles
  const moisAnalyses = useMemo(() => {
    const result: MoisAnalyse[] = [];
    let soldeRoulant = 0;

    for (let mois = 0; mois < 12; mois++) {
      const debut = startOfMonth(new Date(annee, mois, 1));
      const fin = endOfMonth(new Date(annee, mois, 1));

      // VENTES par activité (date échéance)
      const ventesMois = facturesVentes.filter(f => {
        const date = new Date(f.date_echeance);
        return date >= debut && date <= fin;
      });
      const ventesParActivite = groupByActivite(ventesMois, "destinataire_nom", activites);
      const totalVentes = ventesMois.reduce((sum, f) => sum + Number(f.total_ht || 0), 0);

      // ACHATS SERVICES par activité (date échéance)
      const achatsServicesMois = facturesAchatsServices.filter(f => {
        const date = new Date(f.date_echeance);
        return date >= debut && date <= fin;
      });
      const achatsServicesParActivite = groupByActivite(achatsServicesMois, "emetteur_nom", activites);
      const totalAchatsServices = achatsServicesMois.reduce((sum, f) => sum + Number(f.total_ht || 0), 0);

      // ACHATS GENERAUX par activité (date émission = mois en cours)
      const achatsGenerauxMois = facturesAchatsGeneraux.filter(f => {
        const date = new Date(f.date_emission);
        return date >= debut && date <= fin;
      });
      const achatsGenerauxParActivite = groupByActiviteFournisseur(achatsGenerauxMois, activites);
      const totalAchatsGeneraux = achatsGenerauxMois.reduce((sum, f) => sum + Number(f.total_ht || 0), 0);

      // ABONNEMENTS par activité (date transaction = mois en cours)
      const abonnementsMois = lignesAbonnements.filter((lr: any) => {
        const date = new Date(lr.transaction_date);
        return date >= debut && date <= fin;
      });
      const abonnementsParActivite = groupByActiviteAbonnement(abonnementsMois, activites);
      const totalAbonnements = abonnementsMois.reduce((sum, lr: any) => {
        if (lr.total_ht !== null) return sum + Math.abs(Number(lr.total_ht));
        const ttc = lr.total_ttc ?? 
          (Number(lr.transaction_credit) > 0 ? lr.transaction_credit : lr.transaction_debit) ??
          Math.abs(Number(lr.transaction_montant) || 0);
        const tauxTva = getTauxTva(lr.abonnement?.tva);
        return sum + calculerHT(Number(ttc), tauxTva);
      }, 0);

      // CHARGES SALAIRES (mois effectif)
      const chargesSalairesMois = chargesSalaries.filter((c: any) => {
        const typeCharge = c.type_charge || "SALAIRE";
        const dateEff = getDateEffective(c.date_paiement, typeCharge);
        return dateEff >= debut && dateEff <= fin && typeCharge === "SALAIRE";
      });
      const totalChargesSalaires = chargesSalairesMois.reduce((sum, c: any) => {
        const montant = Math.abs(Number(c.montant));
        return sum + (isCredit(c) ? -montant : montant);
      }, 0);

      // CHARGES SOCIALES (mois effectif) - autres types que SALAIRE
      const chargesSocialesMois = [
        ...chargesSalaries.filter((c: any) => {
          const typeCharge = c.type_charge || "";
          const dateEff = getDateEffective(c.date_paiement, typeCharge);
          return dateEff >= debut && dateEff <= fin && typeCharge !== "SALAIRE";
        }),
        ...paiementsCharges.filter((c: any) => {
          const dateEff = getDateEffective(c.date_paiement, c.declaration?.type_charge || "");
          return dateEff >= debut && dateEff <= fin;
        }),
      ];
      const totalChargesSociales = chargesSocialesMois.reduce((sum, c: any) => {
        return sum + Math.abs(Number(c.montant || 0));
      }, 0);

      // Calcul du solde
      const totalCharges = totalChargesSalaires + totalChargesSociales;
      const fluxMois = totalVentes - totalAchatsServices - totalAchatsGeneraux - totalAbonnements - totalCharges;
      soldeRoulant += fluxMois;

      result.push({
        mois,
        moisLabel: MOIS_LABELS[mois],
        soldeCompte: soldeRoulant,
        ventesParActivite,
        achatsServicesParActivite,
        chargesSalaires: totalChargesSalaires,
        chargesSociales: totalChargesSociales,
        achatsGenerauxParActivite,
        abonnementsParActivite,
        totalVentes,
        totalAchatsServices,
        totalAchatsGeneraux,
        totalAbonnements,
        totalCharges,
      });
    }

    return result;
  }, [annee, facturesVentes, facturesAchatsServices, facturesAchatsGeneraux, 
      lignesAbonnements, chargesSalaries, paiementsCharges, activites]);

  // Fonction pour grouper par activité
  function groupByActivite(items: any[], partenaireField: string, activites: any[]): DetailParActivite[] {
    const map = new Map<string, DetailParActivite>();
    
    items.forEach(item => {
      const activiteCode = item.activite || "AUTRE";
      const activiteLabel = activites.find(a => a.code === activiteCode)?.libelle || activiteCode;
      
      if (!map.has(activiteCode)) {
        map.set(activiteCode, { activite: activiteLabel, montant: 0, details: [] });
      }
      
      const entry = map.get(activiteCode)!;
      const montant = Number(item.total_ht || 0);
      entry.montant += montant;
      entry.details.push({
        libelle: item[partenaireField] || item.numero_facture || "—",
        montant,
        date: item.date_echeance || item.date_emission,
      });
    });

    return Array.from(map.values()).sort((a, b) => b.montant - a.montant);
  }

  // Fonction pour grouper achats généraux par activité fournisseur
  function groupByActiviteFournisseur(items: any[], activites: any[]): DetailParActivite[] {
    const map = new Map<string, DetailParActivite>();
    
    items.forEach(item => {
      const activiteCode = (item.fournisseur_general as any)?.activite || item.activite || "AUTRE";
      const activiteLabel = activites.find(a => a.code === activiteCode)?.libelle || activiteCode;
      
      if (!map.has(activiteCode)) {
        map.set(activiteCode, { activite: activiteLabel, montant: 0, details: [] });
      }
      
      const entry = map.get(activiteCode)!;
      const montant = Number(item.total_ht || 0);
      entry.montant += montant;
      entry.details.push({
        libelle: item.emetteur_nom || item.numero_facture || "—",
        montant,
        date: item.date_emission,
      });
    });

    return Array.from(map.values()).sort((a, b) => b.montant - a.montant);
  }

  // Fonction pour grouper abonnements par activité
  function groupByActiviteAbonnement(items: any[], activites: any[]): DetailParActivite[] {
    const map = new Map<string, DetailParActivite>();
    
    items.forEach(item => {
      const activiteCode = item.abonnement?.activite || "AUTRE";
      const activiteLabel = activites.find(a => a.code === activiteCode)?.libelle || activiteCode;
      
      if (!map.has(activiteCode)) {
        map.set(activiteCode, { activite: activiteLabel, montant: 0, details: [] });
      }
      
      const entry = map.get(activiteCode)!;
      
      let montant: number;
      if (item.total_ht !== null) {
        montant = Math.abs(Number(item.total_ht));
      } else {
        const ttc = item.total_ttc ?? 
          (Number(item.transaction_credit) > 0 ? item.transaction_credit : item.transaction_debit) ??
          Math.abs(Number(item.transaction_montant) || 0);
        const tauxTva = getTauxTva(item.abonnement?.tva);
        montant = calculerHT(Number(ttc), tauxTva);
      }
      
      entry.montant += montant;
      entry.details.push({
        libelle: item.abonnement?.nom || item.transaction_libelle || "—",
        montant,
        date: item.transaction_date,
      });
    });

    return Array.from(map.values()).sort((a, b) => b.montant - a.montant);
  }

  const toggleMonth = (monthIndex: number) => {
    setExpandedMonths(prev =>
      prev.includes(monthIndex)
        ? prev.filter(m => m !== monthIndex)
        : [...prev, monthIndex]
    );
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

  // Export Excel
  const exportExcel = () => {
    const rows: any[] = [];
    
    moisAnalyses.forEach(m => {
      rows.push({
        "Mois": m.moisLabel,
        "Catégorie": "SOLDE DU COMPTE",
        "Activité": "",
        "Montant HT": m.soldeCompte,
      });
      
      m.ventesParActivite.forEach(v => {
        rows.push({
          "Mois": m.moisLabel,
          "Catégorie": "VENTES SERVICES",
          "Activité": v.activite,
          "Montant HT": v.montant,
        });
      });
      
      m.achatsServicesParActivite.forEach(a => {
        rows.push({
          "Mois": m.moisLabel,
          "Catégorie": "ACHATS SERVICES",
          "Activité": a.activite,
          "Montant HT": a.montant,
        });
      });
      
      rows.push({
        "Mois": m.moisLabel,
        "Catégorie": "CHARGES SALAIRES",
        "Activité": "",
        "Montant HT": m.chargesSalaires,
      });
      
      rows.push({
        "Mois": m.moisLabel,
        "Catégorie": "CHARGES SOCIALES",
        "Activité": "",
        "Montant HT": m.chargesSociales,
      });
      
      m.achatsGenerauxParActivite.forEach(a => {
        rows.push({
          "Mois": m.moisLabel,
          "Catégorie": "ACHATS GÉNÉRAUX",
          "Activité": a.activite,
          "Montant HT": a.montant,
        });
      });
      
      m.abonnementsParActivite.forEach(a => {
        rows.push({
          "Mois": m.moisLabel,
          "Catégorie": "ABONNEMENTS",
          "Activité": a.activite,
          "Montant HT": a.montant,
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analyse Trésorerie");
    XLSX.writeFile(wb, `analyse_tresorerie_${annee}.xlsx`);
    toast.success("Export Excel réussi");
  };

  // Stats globales
  const stats = useMemo(() => ({
    totalVentes: moisAnalyses.reduce((s, m) => s + m.totalVentes, 0),
    totalAchatsServices: moisAnalyses.reduce((s, m) => s + m.totalAchatsServices, 0),
    totalAchatsGeneraux: moisAnalyses.reduce((s, m) => s + m.totalAchatsGeneraux, 0),
    totalAbonnements: moisAnalyses.reduce((s, m) => s + m.totalAbonnements, 0),
    totalCharges: moisAnalyses.reduce((s, m) => s + m.totalCharges, 0),
    totalSalaires: moisAnalyses.reduce((s, m) => s + m.chargesSalaires, 0),
    totalChargesSociales: moisAnalyses.reduce((s, m) => s + m.chargesSociales, 0),
    soldeFinal: moisAnalyses[11]?.soldeCompte || 0,
  }), [moisAnalyses]);

  const isLoading = !activites.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analyse de Trésorerie</h1>
          <p className="text-muted-foreground">Vue détaillée par mois et par activité</p>
        </div>
        <div className="flex gap-4">
          <Select value={annee.toString()} onValueChange={(v) => setAnnee(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={exportExcel}>
            <Download className="h-4 w-4 mr-2" />
            Exporter Excel
          </Button>
        </div>
      </div>

      {/* KPIs annuels */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Ventes</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(stats.totalVentes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Achats Services</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(stats.totalAchatsServices)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Charges Salariales</p>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(stats.totalCharges)}</p>
            <div className="mt-2 pt-2 border-t border-border text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Salaires</span>
                <span className="font-medium">{formatCurrency(stats.totalSalaires)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Charges sociales</span>
                <span className="font-medium">{formatCurrency(stats.totalChargesSociales)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Achats Généraux</p>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(stats.totalAchatsGeneraux)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Abonnements</p>
            <p className="text-xl font-bold text-purple-600">{formatCurrency(stats.totalAbonnements)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Solde Final</p>
            <p className={`text-xl font-bold ${stats.soldeFinal >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(stats.soldeFinal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tableau mensuel */}
      <Card>
        <CardHeader>
          <CardTitle>Détail Mensuel</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Mois</TableHead>
                <TableHead className="text-right">Ventes</TableHead>
                <TableHead className="text-right">Achats Services</TableHead>
                <TableHead className="text-right">Charges Sal.</TableHead>
                <TableHead className="text-right">Achats Gén.</TableHead>
                <TableHead className="text-right">Abonnements</TableHead>
                <TableHead className="text-right">Solde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {moisAnalyses.map((m, index) => (
                <Collapsible key={m.mois} asChild open={expandedMonths.includes(index)}>
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleMonth(index)}
                      >
                        <TableCell className="font-medium flex items-center gap-2">
                          {expandedMonths.includes(index) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          {m.moisLabel}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-medium">
                          {formatCurrency(m.totalVentes)}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {formatCurrency(m.totalAchatsServices)}
                        </TableCell>
                        <TableCell className="text-right text-orange-600">
                          {formatCurrency(m.totalCharges)}
                        </TableCell>
                        <TableCell className="text-right text-amber-600">
                          {formatCurrency(m.totalAchatsGeneraux)}
                        </TableCell>
                        <TableCell className="text-right text-purple-600">
                          {formatCurrency(m.totalAbonnements)}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${m.soldeCompte >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {formatCurrency(m.soldeCompte)}
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-4">
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {/* Ventes par activité */}
                            <DetailSection 
                              title="Ventes Services" 
                              data={m.ventesParActivite}
                              colorClass="text-green-600"
                              sectionKey={`${index}-ventes`}
                              expanded={expandedSections[`${index}-ventes`]}
                              onToggle={() => toggleSection(`${index}-ventes`)}
                            />
                            
                            {/* Achats Services par activité */}
                            <DetailSection 
                              title="Achats Services" 
                              data={m.achatsServicesParActivite}
                              colorClass="text-red-600"
                              sectionKey={`${index}-achats-services`}
                              expanded={expandedSections[`${index}-achats-services`]}
                              onToggle={() => toggleSection(`${index}-achats-services`)}
                            />
                            
                            {/* Charges salariales */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-orange-600">Charges Salariales</h4>
                              <div className="text-sm space-y-1">
                                <div className="flex justify-between">
                                  <span>Salaires</span>
                                  <span>{formatCurrency(m.chargesSalaires)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Charges sociales</span>
                                  <span>{formatCurrency(m.chargesSociales)}</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Achats Généraux par activité */}
                            <DetailSection 
                              title="Achats Généraux" 
                              data={m.achatsGenerauxParActivite}
                              colorClass="text-amber-600"
                              sectionKey={`${index}-achats-generaux`}
                              expanded={expandedSections[`${index}-achats-generaux`]}
                              onToggle={() => toggleSection(`${index}-achats-generaux`)}
                            />
                            
                            {/* Abonnements par activité */}
                            <DetailSection 
                              title="Abonnements" 
                              data={m.abonnementsParActivite}
                              colorClass="text-purple-600"
                              sectionKey={`${index}-abonnements`}
                              expanded={expandedSections[`${index}-abonnements`]}
                              onToggle={() => toggleSection(`${index}-abonnements`)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Composant pour afficher les détails par activité
function DetailSection({ 
  title, 
  data, 
  colorClass,
  sectionKey,
  expanded,
  onToggle,
}: { 
  title: string; 
  data: DetailParActivite[]; 
  colorClass: string;
  sectionKey: string;
  expanded?: boolean;
  onToggle: () => void;
}) {
  const formatCurrency = (value: number) =>
    value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

  if (data.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className={`font-semibold ${colorClass}`}>{title}</h4>
        <p className="text-sm text-muted-foreground italic">Aucune donnée</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className={`font-semibold ${colorClass}`}>{title}</h4>
      <div className="text-sm space-y-1">
        {data.map((item, i) => (
          <Collapsible key={i} open={expanded}>
            <CollapsibleTrigger 
              className="flex justify-between w-full hover:bg-muted/50 px-1 rounded cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
            >
              <span className="flex items-center gap-1">
                {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {item.activite}
              </span>
              <span className="font-medium">{formatCurrency(item.montant)}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pl-4 pt-1 space-y-0.5 text-xs text-muted-foreground">
                {item.details.slice(0, 5).map((d, j) => (
                  <div key={j} className="flex justify-between">
                    <span className="truncate max-w-[150px]">{d.libelle}</span>
                    <span>{formatCurrency(d.montant)}</span>
                  </div>
                ))}
                {item.details.length > 5 && (
                  <div className="italic">+ {item.details.length - 5} autres...</div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
