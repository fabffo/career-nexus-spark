import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";
import { format, addMonths, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

type FluxType = "VENTES" | "ACHATS_SERVICES" | "ABONNEMENTS" | "ACHATS_GENERAUX";

interface FluxMensuel {
  id: string;
  type: FluxType;
  categorie: string;
  partenaire: string;
  montant: number;
  dateEcheance: string;
  isReel: boolean;
  isReporte: boolean;
  sourceAnnee?: number;
}

interface MoisTresorerie {
  mois: Date;
  soldeInitial: number;
  ventes: FluxMensuel[];
  achatsServices: FluxMensuel[];
  abonnements: FluxMensuel[];
  achatsGeneraux: FluxMensuel[];
  totalVentes: number;
  totalAchatsServices: number;
  totalAbonnements: number;
  totalAchatsGeneraux: number;
  soldeFinal: number;
}

const MOIS_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export default function PrevisionTresorerie() {
  const currentYear = new Date().getFullYear();
  const [annee, setAnnee] = useState(currentYear);
  const [soldeInitialAnnee, setSoldeInitialAnnee] = useState<number>(0);
  const [expandedMonths, setExpandedMonths] = useState<number[]>([]);

  // Récupérer les factures de ventes
  const { data: facturesVentes = [] } = useQuery({
    queryKey: ["factures-ventes-prevision", annee],
    queryFn: async () => {
      const startDate = `${annee}-01-01`;
      const endDate = `${annee}-12-31`;
      
      const { data, error } = await supabase
        .from("factures")
        .select("id, numero_facture, destinataire_nom, total_ttc, date_echeance, statut")
        .eq("type_facture", "VENTES")
        .gte("date_echeance", startDate)
        .lte("date_echeance", endDate)
        .order("date_echeance");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Récupérer les factures d'achats de services
  const { data: facturesAchatsServices = [] } = useQuery({
    queryKey: ["factures-achats-services-prevision", annee],
    queryFn: async () => {
      const startDate = `${annee}-01-01`;
      const endDate = `${annee}-12-31`;
      
      const { data, error } = await supabase
        .from("factures")
        .select("id, numero_facture, emetteur_nom, total_ttc, date_echeance, statut")
        .eq("type_facture", "ACHATS_SERVICES")
        .gte("date_echeance", startDate)
        .lte("date_echeance", endDate)
        .order("date_echeance");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Récupérer les factures d'achats généraux
  const { data: facturesAchatsGeneraux = [] } = useQuery({
    queryKey: ["factures-achats-generaux-prevision", annee],
    queryFn: async () => {
      const startDate = `${annee}-01-01`;
      const endDate = `${annee}-12-31`;
      
      const { data, error } = await supabase
        .from("factures")
        .select("id, numero_facture, emetteur_nom, total_ttc, date_echeance, statut")
        .eq("type_facture", "ACHATS_GENERAUX")
        .gte("date_echeance", startDate)
        .lte("date_echeance", endDate)
        .order("date_echeance");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Récupérer les abonnements actifs
  const { data: abonnements = [] } = useQuery({
    queryKey: ["abonnements-prevision"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("abonnements_partenaires")
        .select("id, nom, montant_mensuel, jour_prelevement, nature, tva, actif")
        .eq("actif", true)
        .order("nom");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Récupérer les paiements abonnements de l'année précédente pour le report
  const { data: paiementsAbonnementsAnneePrecedente = [] } = useQuery({
    queryKey: ["paiements-abonnements-report", annee - 1],
    queryFn: async () => {
      const startDate = `${annee - 1}-01-01`;
      const endDate = `${annee - 1}-12-31`;
      
      const { data, error } = await supabase
        .from("paiements_abonnements")
        .select(`
          id, 
          date_paiement, 
          montant,
          abonnement:abonnements_partenaires(id, nom, nature)
        `)
        .gte("date_paiement", startDate)
        .lte("date_paiement", endDate)
        .order("date_paiement");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Récupérer les achats généraux de l'année précédente pour le report
  const { data: achatsGenerauxAnneePrecedente = [] } = useQuery({
    queryKey: ["achats-generaux-report", annee - 1],
    queryFn: async () => {
      const startDate = `${annee - 1}-01-01`;
      const endDate = `${annee - 1}-12-31`;
      
      const { data, error } = await supabase
        .from("factures")
        .select("id, numero_facture, emetteur_nom, total_ttc, date_echeance")
        .eq("type_facture", "ACHATS_GENERAUX")
        .gte("date_echeance", startDate)
        .lte("date_echeance", endDate)
        .order("date_echeance");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Récupérer les paiements abonnements de l'année en cours (pour marquer comme réel)
  const { data: paiementsAbonnementsAnnee = [] } = useQuery({
    queryKey: ["paiements-abonnements-annee", annee],
    queryFn: async () => {
      const startDate = `${annee}-01-01`;
      const endDate = `${annee}-12-31`;
      
      const { data, error } = await supabase
        .from("paiements_abonnements")
        .select(`
          id, 
          date_paiement, 
          montant,
          abonnement:abonnements_partenaires(id, nom, nature)
        `)
        .gte("date_paiement", startDate)
        .lte("date_paiement", endDate)
        .order("date_paiement");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Calculer les données mensuelles
  const moisTresorerie = useMemo(() => {
    const result: MoisTresorerie[] = [];
    let soldeActuel = soldeInitialAnnee;

    for (let mois = 0; mois < 12; mois++) {
      const moisDate = new Date(annee, mois, 1);
      const moisDebut = startOfMonth(moisDate);
      const moisFin = endOfMonth(moisDate);

      // Ventes du mois
      const ventesFlux: FluxMensuel[] = facturesVentes
        .filter(f => {
          const dateEcheance = parseISO(f.date_echeance);
          return dateEcheance >= moisDebut && dateEcheance <= moisFin;
        })
        .map(f => ({
          id: f.id,
          type: "VENTES" as FluxType,
          categorie: "Facture vente",
          partenaire: f.destinataire_nom,
          montant: f.total_ttc || 0,
          dateEcheance: f.date_echeance,
          isReel: f.statut === "PAYEE",
          isReporte: false,
        }));

      // Achats de services du mois
      const achatsServicesFlux: FluxMensuel[] = facturesAchatsServices
        .filter(f => {
          const dateEcheance = parseISO(f.date_echeance);
          return dateEcheance >= moisDebut && dateEcheance <= moisFin;
        })
        .map(f => ({
          id: f.id,
          type: "ACHATS_SERVICES" as FluxType,
          categorie: "Facture achat service",
          partenaire: f.emetteur_nom,
          montant: f.total_ttc || 0,
          dateEcheance: f.date_echeance,
          isReel: f.statut === "PAYEE",
          isReporte: false,
        }));

      // Abonnements du mois - basés sur les paiements réels de l'année en cours
      const abonnementsReelsMois = paiementsAbonnementsAnnee
        .filter(p => {
          const datePaiement = parseISO(p.date_paiement);
          return datePaiement >= moisDebut && datePaiement <= moisFin;
        })
        .map(p => ({
          id: p.id,
          type: "ABONNEMENTS" as FluxType,
          categorie: (p.abonnement as any)?.nature || "Abonnement",
          partenaire: (p.abonnement as any)?.nom || "Inconnu",
          montant: p.montant,
          dateEcheance: p.date_paiement,
          isReel: true,
          isReporte: false,
        }));

      // Reports des abonnements de l'année précédente
      const abonnementsReportesMois = paiementsAbonnementsAnneePrecedente
        .filter(p => {
          const datePaiement = parseISO(p.date_paiement);
          return datePaiement.getMonth() === mois;
        })
        .filter(p => {
          // Ne pas ajouter si un paiement réel existe déjà pour cet abonnement ce mois
          const abonnementId = (p.abonnement as any)?.id;
          return !abonnementsReelsMois.some(ar => 
            (ar as any).abonnement?.id === abonnementId
          );
        })
        .map(p => ({
          id: `report-${p.id}`,
          type: "ABONNEMENTS" as FluxType,
          categorie: (p.abonnement as any)?.nature || "Abonnement",
          partenaire: (p.abonnement as any)?.nom || "Inconnu",
          montant: p.montant,
          dateEcheance: `${annee}-${String(mois + 1).padStart(2, '0')}-${p.date_paiement.split('-')[2]}`,
          isReel: false,
          isReporte: true,
          sourceAnnee: annee - 1,
        }));

      const abonnementsFlux = [...abonnementsReelsMois, ...abonnementsReportesMois];

      // Achats généraux du mois - factures réelles
      const achatsGenerauxReelsMois: FluxMensuel[] = facturesAchatsGeneraux
        .filter(f => {
          const dateEcheance = parseISO(f.date_echeance);
          return dateEcheance >= moisDebut && dateEcheance <= moisFin;
        })
        .map(f => ({
          id: f.id,
          type: "ACHATS_GENERAUX" as FluxType,
          categorie: "Achat général",
          partenaire: f.emetteur_nom,
          montant: f.total_ttc || 0,
          dateEcheance: f.date_echeance,
          isReel: f.statut === "PAYEE",
          isReporte: false,
        }));

      // Reports des achats généraux de l'année précédente
      const achatsGenerauxReportesMois = achatsGenerauxAnneePrecedente
        .filter(f => {
          const dateEcheance = parseISO(f.date_echeance);
          return dateEcheance.getMonth() === mois;
        })
        .filter(f => {
          // Ne pas ajouter si une facture réelle existe déjà pour ce fournisseur ce mois
          return !achatsGenerauxReelsMois.some(ar => 
            ar.partenaire === f.emetteur_nom && 
            Math.abs(ar.montant - (f.total_ttc || 0)) < 0.01
          );
        })
        .map(f => ({
          id: `report-${f.id}`,
          type: "ACHATS_GENERAUX" as FluxType,
          categorie: "Achat général (report)",
          partenaire: f.emetteur_nom,
          montant: f.total_ttc || 0,
          dateEcheance: `${annee}-${String(mois + 1).padStart(2, '0')}-${f.date_echeance.split('-')[2]}`,
          isReel: false,
          isReporte: true,
          sourceAnnee: annee - 1,
        }));

      const achatsGenerauxFlux = [...achatsGenerauxReelsMois, ...achatsGenerauxReportesMois];

      // Calculer les totaux
      const totalVentes = ventesFlux.reduce((sum, f) => sum + f.montant, 0);
      const totalAchatsServices = achatsServicesFlux.reduce((sum, f) => sum + f.montant, 0);
      const totalAbonnements = abonnementsFlux.reduce((sum, f) => sum + f.montant, 0);
      const totalAchatsGeneraux = achatsGenerauxFlux.reduce((sum, f) => sum + f.montant, 0);

      const soldeFinal = soldeActuel + totalVentes - totalAchatsServices - totalAbonnements - totalAchatsGeneraux;

      result.push({
        mois: moisDate,
        soldeInitial: soldeActuel,
        ventes: ventesFlux,
        achatsServices: achatsServicesFlux,
        abonnements: abonnementsFlux,
        achatsGeneraux: achatsGenerauxFlux,
        totalVentes,
        totalAchatsServices,
        totalAbonnements,
        totalAchatsGeneraux,
        soldeFinal,
      });

      soldeActuel = soldeFinal;
    }

    return result;
  }, [
    annee,
    soldeInitialAnnee,
    facturesVentes,
    facturesAchatsServices,
    facturesAchatsGeneraux,
    paiementsAbonnementsAnnee,
    paiementsAbonnementsAnneePrecedente,
    achatsGenerauxAnneePrecedente,
  ]);

  // Statistiques globales
  const stats = useMemo(() => {
    const totalVentesAnnee = moisTresorerie.reduce((sum, m) => sum + m.totalVentes, 0);
    const totalAchatsServicesAnnee = moisTresorerie.reduce((sum, m) => sum + m.totalAchatsServices, 0);
    const totalAbonnementsAnnee = moisTresorerie.reduce((sum, m) => sum + m.totalAbonnements, 0);
    const totalAchatsGenerauxAnnee = moisTresorerie.reduce((sum, m) => sum + m.totalAchatsGeneraux, 0);
    const soldeFinalAnnee = moisTresorerie[11]?.soldeFinal || 0;
    const moisEnRisque = moisTresorerie.filter(m => m.soldeFinal < 0).length;
    const moisMinimum = moisTresorerie.reduce((min, m) => m.soldeFinal < min.soldeFinal ? m : min, moisTresorerie[0]);

    return {
      totalVentesAnnee,
      totalAchatsServicesAnnee,
      totalAbonnementsAnnee,
      totalAchatsGenerauxAnnee,
      soldeFinalAnnee,
      moisEnRisque,
      moisMinimum,
      fluxNet: totalVentesAnnee - totalAchatsServicesAnnee - totalAbonnementsAnnee - totalAchatsGenerauxAnnee,
    };
  }, [moisTresorerie]);

  const toggleMonth = (monthIndex: number) => {
    setExpandedMonths(prev =>
      prev.includes(monthIndex)
        ? prev.filter(m => m !== monthIndex)
        : [...prev, monthIndex]
    );
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Prévision de Trésorerie</h1>
          <p className="text-muted-foreground">
            Vision à 12 mois avec comparatif Prévision / Réalisé
          </p>
        </div>
      </div>

      {/* Paramètres */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Paramètres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Année</Label>
              <Select
                value={annee.toString()}
                onValueChange={(v) => setAnnee(parseInt(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Solde initial (01/01/{annee})</Label>
              <Input
                type="number"
                value={soldeInitialAnnee}
                onChange={(e) => setSoldeInitialAnnee(parseFloat(e.target.value) || 0)}
                className="w-40"
                placeholder="0.00"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Encaissements</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats.totalVentesAnnee)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Décaissements</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(
                    stats.totalAchatsServicesAnnee +
                    stats.totalAbonnementsAnnee +
                    stats.totalAchatsGenerauxAnnee
                  )}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Solde fin {annee}</p>
                <p className={`text-2xl font-bold ${stats.soldeFinalAnnee >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(stats.soldeFinalAnnee)}
                </p>
              </div>
              {stats.soldeFinalAnnee >= 0 ? (
                <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-red-500 opacity-50" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Mois à risque</p>
                <p className={`text-2xl font-bold ${stats.moisEnRisque === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.moisEnRisque}
                </p>
              </div>
              <AlertTriangle className={`h-8 w-8 opacity-50 ${stats.moisEnRisque === 0 ? 'text-green-500' : 'text-red-500'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Légende */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-500">Réel</Badge>
              <span>Flux confirmé/payé</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Prévisionnel</Badge>
              <span>Flux à venir</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Reporté</Badge>
              <span>Basé sur année précédente</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tableau mensuel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tableau de Trésorerie Mensuel</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Mois</TableHead>
                  <TableHead className="text-right">Solde Initial</TableHead>
                  <TableHead className="text-right text-green-600">+ Ventes</TableHead>
                  <TableHead className="text-right text-red-600">- Achats Services</TableHead>
                  <TableHead className="text-right text-red-600">- Abonnements</TableHead>
                  <TableHead className="text-right text-red-600">- Achats Généraux</TableHead>
                  <TableHead className="text-right font-bold">Solde Final</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {moisTresorerie.map((moisData, index) => (
                  <Collapsible
                    key={index}
                    open={expandedMonths.includes(index)}
                    onOpenChange={() => toggleMonth(index)}
                    asChild
                  >
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow 
                          className={`cursor-pointer hover:bg-muted/50 ${moisData.soldeFinal < 0 ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                        >
                          <TableCell className="font-medium">
                            {MOIS_LABELS[index]}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(moisData.soldeInitial)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            +{formatCurrency(moisData.totalVentes)}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            -{formatCurrency(moisData.totalAchatsServices)}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            -{formatCurrency(moisData.totalAbonnements)}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            -{formatCurrency(moisData.totalAchatsGeneraux)}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${moisData.soldeFinal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(moisData.soldeFinal)}
                          </TableCell>
                          <TableCell>
                            {expandedMonths.includes(index) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <TableRow>
                          <TableCell colSpan={8} className="p-0">
                            <div className="bg-muted/30 p-4 space-y-4">
                              {/* Détail Ventes */}
                              {moisData.ventes.length > 0 && (
                                <div>
                                  <h4 className="font-medium text-green-600 mb-2">Ventes ({moisData.ventes.length})</h4>
                                  <div className="space-y-1">
                                    {moisData.ventes.map((flux) => (
                                      <div key={flux.id} className="flex items-center justify-between text-sm p-2 bg-background rounded">
                                        <div className="flex items-center gap-2">
                                          <span>{flux.partenaire}</span>
                                          {flux.isReel ? (
                                            <Badge variant="default" className="bg-green-500 text-xs">Payée</Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-xs">À venir</Badge>
                                          )}
                                        </div>
                                        <span className="text-green-600">+{formatCurrency(flux.montant)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Détail Achats Services */}
                              {moisData.achatsServices.length > 0 && (
                                <div>
                                  <h4 className="font-medium text-red-600 mb-2">Achats Services ({moisData.achatsServices.length})</h4>
                                  <div className="space-y-1">
                                    {moisData.achatsServices.map((flux) => (
                                      <div key={flux.id} className="flex items-center justify-between text-sm p-2 bg-background rounded">
                                        <div className="flex items-center gap-2">
                                          <span>{flux.partenaire}</span>
                                          {flux.isReel ? (
                                            <Badge variant="default" className="bg-green-500 text-xs">Payée</Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-xs">À venir</Badge>
                                          )}
                                        </div>
                                        <span className="text-red-600">-{formatCurrency(flux.montant)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Détail Abonnements */}
                              {moisData.abonnements.length > 0 && (
                                <div>
                                  <h4 className="font-medium text-red-600 mb-2">Abonnements ({moisData.abonnements.length})</h4>
                                  <div className="space-y-1">
                                    {moisData.abonnements.map((flux) => (
                                      <div key={flux.id} className="flex items-center justify-between text-sm p-2 bg-background rounded">
                                        <div className="flex items-center gap-2">
                                          <span>{flux.partenaire}</span>
                                          <span className="text-muted-foreground text-xs">({flux.categorie})</span>
                                          {flux.isReel ? (
                                            <Badge variant="default" className="bg-green-500 text-xs">Payé</Badge>
                                          ) : flux.isReporte ? (
                                            <Badge variant="secondary" className="text-xs">Report {flux.sourceAnnee}</Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-xs">Prévu</Badge>
                                          )}
                                        </div>
                                        <span className="text-red-600">-{formatCurrency(flux.montant)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Détail Achats Généraux */}
                              {moisData.achatsGeneraux.length > 0 && (
                                <div>
                                  <h4 className="font-medium text-red-600 mb-2">Achats Généraux ({moisData.achatsGeneraux.length})</h4>
                                  <div className="space-y-1">
                                    {moisData.achatsGeneraux.map((flux) => (
                                      <div key={flux.id} className="flex items-center justify-between text-sm p-2 bg-background rounded">
                                        <div className="flex items-center gap-2">
                                          <span>{flux.partenaire}</span>
                                          {flux.isReel ? (
                                            <Badge variant="default" className="bg-green-500 text-xs">Payée</Badge>
                                          ) : flux.isReporte ? (
                                            <Badge variant="secondary" className="text-xs">Report {flux.sourceAnnee}</Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-xs">À venir</Badge>
                                          )}
                                        </div>
                                        <span className="text-red-600">-{formatCurrency(flux.montant)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Si aucun flux */}
                              {moisData.ventes.length === 0 && 
                               moisData.achatsServices.length === 0 && 
                               moisData.abonnements.length === 0 && 
                               moisData.achatsGeneraux.length === 0 && (
                                <div className="text-center text-muted-foreground py-4">
                                  <Info className="h-5 w-5 inline mr-2" />
                                  Aucun flux prévu pour ce mois
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Synthèse par catégorie */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ventes de Services</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-600">{formatCurrency(stats.totalVentesAnnee)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {facturesVentes.length} facture(s) - Non reporté
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Achats de Services</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-red-600">{formatCurrency(stats.totalAchatsServicesAnnee)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {facturesAchatsServices.length} facture(s) - Non reporté
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Abonnements</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-red-600">{formatCurrency(stats.totalAbonnementsAnnee)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {abonnements.length} abonnement(s) actif(s) - Report auto
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Achats Généraux</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-red-600">{formatCurrency(stats.totalAchatsGenerauxAnnee)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {facturesAchatsGeneraux.length} facture(s) - Report auto
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
