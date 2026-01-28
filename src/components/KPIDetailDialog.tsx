import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth, subMonths, getDate } from "date-fns";
import { fr } from "date-fns/locale";

export type KPIType = "ca" | "achatServices" | "achat" | "abonnements" | "chargesSociales" | "margeBrute" | "margeNette";

interface KPIDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpiType: KPIType | null;
  annee: number;
  mois: number | null;
}

interface DetailLine {
  id: string;
  date: string;
  libelle: string;
  partenaire: string;
  montant: number;
  type?: string;
}

const KPI_TITLES: Record<KPIType, string> = {
  ca: "Détail du Chiffre d'Affaires",
  achatServices: "Détail des Achats Services",
  achat: "Détail des Achats Généraux",
  abonnements: "Détail des Abonnements",
  chargesSociales: "Détail des Charges Sociales",
  margeBrute: "Détail de la Marge Brute",
  margeNette: "Détail de la Marge Nette",
};

export function KPIDetailDialog({ open, onOpenChange, kpiType, annee, mois }: KPIDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<DetailLine[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (open && kpiType) {
      loadDetails();
    }
  }, [open, kpiType, annee, mois]);

  const getDateRange = () => {
    const debut = mois !== null 
      ? startOfMonth(new Date(annee, mois, 1))
      : startOfYear(new Date(annee, 0, 1));
    const fin = mois !== null
      ? endOfMonth(new Date(annee, mois, 1))
      : endOfYear(new Date(annee, 11, 31));
    return { debut, fin };
  };

  const loadDetails = async () => {
    if (!kpiType) return;
    
    setLoading(true);
    setLines([]);
    setTotal(0);

    const { debut, fin } = getDateRange();

    try {
      switch (kpiType) {
        case "ca":
          await loadCADetails(debut, fin);
          break;
        case "achatServices":
          await loadAchatServicesDetails(debut, fin);
          break;
        case "achat":
          await loadAchatDetails(debut, fin);
          break;
        case "abonnements":
          await loadAbonnementsDetails(debut, fin);
          break;
        case "chargesSociales":
          await loadChargesSocialesDetails(debut, fin);
          break;
        case "margeBrute":
        case "margeNette":
          await loadMargeDetails(debut, fin, kpiType);
          break;
      }
    } catch (error) {
      console.error("Erreur chargement détails:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCADetails = async (debut: Date, fin: Date) => {
    const { data: factures } = await supabase
      .from("factures")
      .select("id, date_emission, numero_facture, destinataire_nom, total_ht, activite")
      .eq("type_facture", "VENTES")
      .gte("date_emission", format(debut, "yyyy-MM-dd"))
      .lte("date_emission", format(fin, "yyyy-MM-dd"))
      .order("date_emission", { ascending: false });

    const lines: DetailLine[] = factures?.map(f => ({
      id: f.id,
      date: f.date_emission,
      libelle: f.numero_facture || "Facture",
      partenaire: f.destinataire_nom || "—",
      montant: Number(f.total_ht || 0),
      type: f.activite || "—",
    })) || [];

    setLines(lines);
    setTotal(lines.reduce((sum, l) => sum + l.montant, 0));
  };

  const loadAchatServicesDetails = async (debut: Date, fin: Date) => {
    const { data: factures } = await supabase
      .from("factures")
      .select("id, date_emission, numero_facture, emetteur_nom, total_ht")
      .eq("type_facture", "ACHATS_SERVICES")
      .gte("date_emission", format(debut, "yyyy-MM-dd"))
      .lte("date_emission", format(fin, "yyyy-MM-dd"))
      .order("date_emission", { ascending: false });

    const lines: DetailLine[] = factures?.map(f => ({
      id: f.id,
      date: f.date_emission,
      libelle: f.numero_facture || "Facture achat",
      partenaire: f.emetteur_nom || "—",
      montant: Number(f.total_ht || 0),
    })) || [];

    setLines(lines);
    setTotal(lines.reduce((sum, l) => sum + l.montant, 0));
  };

  const loadAchatDetails = async (debut: Date, fin: Date) => {
    const { data: factures } = await supabase
      .from("factures")
      .select("id, date_emission, numero_facture, emetteur_nom, total_ht")
      .eq("type_facture", "ACHATS_GENERAUX")
      .gte("date_emission", format(debut, "yyyy-MM-dd"))
      .lte("date_emission", format(fin, "yyyy-MM-dd"))
      .order("date_emission", { ascending: false });

    const lines: DetailLine[] = factures?.map(f => ({
      id: f.id,
      date: f.date_emission,
      libelle: f.numero_facture || "Facture achat",
      partenaire: f.emetteur_nom || "—",
      montant: Number(f.total_ht || 0),
    })) || [];

    setLines(lines);
    setTotal(lines.reduce((sum, l) => sum + l.montant, 0));
  };

  const loadAbonnementsDetails = async (debut: Date, fin: Date) => {
    const { data: paiements } = await supabase
      .from("paiements_abonnements")
      .select("id, date_paiement, montant, abonnement:abonnements_partenaires!inner(nom, type, tva)")
      .eq("abonnement.type", "CHARGE")
      .gte("date_paiement", format(debut, "yyyy-MM-dd"))
      .lte("date_paiement", format(fin, "yyyy-MM-dd"))
      .order("date_paiement", { ascending: false });

    const calculerMontantHT = (montantTTC: number, tvaStr: string | null): number => {
      if (!tvaStr) return montantTTC;
      const tvaMapping: Record<string, number> = {
        'normal': 20, 'normale': 20, 'reduit': 5.5, 'réduit': 5.5,
        'intermediaire': 10, 'intermédiaire': 10, 'exonere': 0, 'exonéré': 0,
      };
      const tvaLower = tvaStr.toLowerCase().trim();
      let tauxTva = tvaMapping[tvaLower] ?? 0;
      if (tauxTva === 0) {
        const match = tvaStr.match(/(\d+(?:[.,]\d+)?)/);
        tauxTva = match ? parseFloat(match[1].replace(',', '.')) : 0;
      }
      return montantTTC / (1 + tauxTva / 100);
    };

    const lines: DetailLine[] = paiements?.map((p: any) => ({
      id: p.id,
      date: p.date_paiement,
      libelle: "Paiement abonnement",
      partenaire: p.abonnement?.nom || "—",
      montant: calculerMontantHT(Number(p.montant || 0), p.abonnement?.tva),
    })) || [];

    setLines(lines);
    setTotal(lines.reduce((sum, l) => sum + l.montant, 0));
  };

  const loadChargesSocialesDetails = async (debut: Date, fin: Date) => {
    const { data: paiements } = await supabase
      .from("paiements_declarations_charges")
      .select("id, date_paiement, montant, declaration:declarations_charges_sociales(nom, type_charge)");

    const getDateEffective = (datePaiement: string, typeCharge?: string, chargeId?: string, allCharges?: any[]): Date => {
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

    const chargesFiltered = paiements?.filter((c: any) => {
      const dateEff = getDateEffective(c.date_paiement, c.declaration?.type_charge, c.id, paiements);
      return dateEff >= debut && dateEff <= fin;
    }) || [];

    const lines: DetailLine[] = chargesFiltered.map((c: any) => ({
      id: c.id,
      date: c.date_paiement,
      libelle: c.declaration?.nom || "Charge sociale",
      partenaire: c.declaration?.type_charge || "—",
      montant: Math.abs(Number(c.montant || 0)),
      type: c.declaration?.type_charge,
    }));

    setLines(lines);
    setTotal(lines.reduce((sum, l) => sum + l.montant, 0));
  };

  const loadMargeDetails = async (debut: Date, fin: Date, type: "margeBrute" | "margeNette") => {
    // Charger toutes les données nécessaires
    const [ventesRes, achatsServicesRes, achatsGenerauxRes, abonnementsRes, chargesRes] = await Promise.all([
      supabase.from("factures").select("id, date_emission, numero_facture, destinataire_nom, total_ht, activite")
        .eq("type_facture", "VENTES")
        .gte("date_emission", format(debut, "yyyy-MM-dd"))
        .lte("date_emission", format(fin, "yyyy-MM-dd")),
      supabase.from("factures").select("id, date_emission, numero_facture, emetteur_nom, total_ht")
        .eq("type_facture", "ACHATS_SERVICES")
        .gte("date_emission", format(debut, "yyyy-MM-dd"))
        .lte("date_emission", format(fin, "yyyy-MM-dd")),
      supabase.from("factures").select("id, date_emission, numero_facture, emetteur_nom, total_ht")
        .eq("type_facture", "ACHATS_GENERAUX")
        .gte("date_emission", format(debut, "yyyy-MM-dd"))
        .lte("date_emission", format(fin, "yyyy-MM-dd")),
      supabase.from("paiements_abonnements")
        .select("id, date_paiement, montant, abonnement:abonnements_partenaires!inner(nom, type, tva)")
        .eq("abonnement.type", "CHARGE")
        .gte("date_paiement", format(debut, "yyyy-MM-dd"))
        .lte("date_paiement", format(fin, "yyyy-MM-dd")),
      supabase.from("paiements_declarations_charges")
        .select("id, date_paiement, montant, declaration:declarations_charges_sociales(nom, type_charge)"),
    ]);

    const allLines: DetailLine[] = [];

    // Ventes (+)
    ventesRes.data?.forEach(f => {
      allLines.push({
        id: f.id,
        date: f.date_emission,
        libelle: f.numero_facture || "Facture vente",
        partenaire: f.destinataire_nom || "—",
        montant: Number(f.total_ht || 0),
        type: "Vente",
      });
    });

    // Achats Services (-)
    achatsServicesRes.data?.forEach(f => {
      allLines.push({
        id: f.id,
        date: f.date_emission,
        libelle: f.numero_facture || "Facture achat services",
        partenaire: f.emetteur_nom || "—",
        montant: -Number(f.total_ht || 0),
        type: "Achat Services",
      });
    });

    if (type === "margeNette") {
      // Achats Généraux (-)
      achatsGenerauxRes.data?.forEach(f => {
        allLines.push({
          id: f.id,
          date: f.date_emission,
          libelle: f.numero_facture || "Facture achat généraux",
          partenaire: f.emetteur_nom || "—",
          montant: -Number(f.total_ht || 0),
          type: "Achat Généraux",
        });
      });

      // Abonnements (-)
      const calculerMontantHT = (montantTTC: number, tvaStr: string | null): number => {
        if (!tvaStr) return montantTTC;
        const tvaMapping: Record<string, number> = {
          'normal': 20, 'normale': 20, 'reduit': 5.5, 'réduit': 5.5,
          'intermediaire': 10, 'intermédiaire': 10, 'exonere': 0, 'exonéré': 0,
        };
        const tvaLower = tvaStr.toLowerCase().trim();
        let tauxTva = tvaMapping[tvaLower] ?? 0;
        if (tauxTva === 0) {
          const match = tvaStr.match(/(\d+(?:[.,]\d+)?)/);
          tauxTva = match ? parseFloat(match[1].replace(',', '.')) : 0;
        }
        return montantTTC / (1 + tauxTva / 100);
      };

      abonnementsRes.data?.forEach((p: any) => {
        allLines.push({
          id: p.id,
          date: p.date_paiement,
          libelle: "Abonnement",
          partenaire: p.abonnement?.nom || "—",
          montant: -calculerMontantHT(Number(p.montant || 0), p.abonnement?.tva),
          type: "Abonnement",
        });
      });

      // Charges sociales (-)
      const getDateEffective = (datePaiement: string, typeCharge?: string, chargeId?: string, allCharges?: any[]): Date => {
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

      chargesRes.data?.filter((c: any) => {
        const dateEff = getDateEffective(c.date_paiement, c.declaration?.type_charge, c.id, chargesRes.data);
        return dateEff >= debut && dateEff <= fin;
      }).forEach((c: any) => {
        allLines.push({
          id: c.id,
          date: c.date_paiement,
          libelle: c.declaration?.nom || "Charge sociale",
          partenaire: c.declaration?.type_charge || "—",
          montant: -Math.abs(Number(c.montant || 0)),
          type: "Charge Sociale",
        });
      });
    }

    // Trier par date décroissante
    allLines.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setLines(allLines);
    setTotal(allLines.reduce((sum, l) => sum + l.montant, 0));
  };

  const getTypeColor = (type?: string) => {
    switch (type) {
      case "Vente": return "bg-green-100 text-green-800";
      case "Achat Services": return "bg-orange-100 text-orange-800";
      case "Achat Généraux": return "bg-red-100 text-red-800";
      case "Abonnement": return "bg-blue-100 text-blue-800";
      case "Charge Sociale": return "bg-purple-100 text-purple-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{kpiType ? KPI_TITLES[kpiType] : "Détail"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Partenaire</TableHead>
                  {(kpiType === "margeBrute" || kpiType === "margeNette") && <TableHead>Type</TableHead>}
                  <TableHead className="text-right">Montant HT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={kpiType === "margeBrute" || kpiType === "margeNette" ? 5 : 4} className="text-center text-muted-foreground py-8">
                      Aucune donnée pour cette période
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{format(new Date(line.date), "dd/MM/yyyy", { locale: fr })}</TableCell>
                      <TableCell>{line.libelle}</TableCell>
                      <TableCell>{line.partenaire}</TableCell>
                      {(kpiType === "margeBrute" || kpiType === "margeNette") && (
                        <TableCell>
                          <Badge variant="outline" className={getTypeColor(line.type)}>{line.type}</Badge>
                        </TableCell>
                      )}
                      <TableCell className={`text-right font-medium ${line.montant < 0 ? "text-red-600" : "text-green-600"}`}>
                        {line.montant.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && lines.length > 0 && (
          <div className="border-t pt-4 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{lines.length} ligne(s)</span>
            <div className="text-right">
              <span className="text-sm text-muted-foreground mr-2">Total:</span>
              <span className={`text-xl font-bold ${total < 0 ? "text-red-600" : "text-green-600"}`}>
                {total.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
