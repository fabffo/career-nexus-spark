import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Receipt } from "lucide-react";

interface RapprochementLigne {
  id: string;
  transaction_date: string;
  transaction_libelle: string;
  transaction_montant: number;
  transaction_credit: number;
  transaction_debit: number;
  statut: string;
  facture?: {
    numero_facture: string;
    total_tva: number;
    type_facture: string;
  };
}

interface PeriodeStat {
  tva_collectee: number;
  tva_deductible: number;
  tva_a_payer: number;
}

export default function TvaMensuel() {
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [availablePeriods, setAvailablePeriods] = useState<{ month: string; year: string }[]>([]);
  const [lignes, setLignes] = useState<RapprochementLigne[]>([]);
  const [stats, setStats] = useState<PeriodeStat>({ tva_collectee: 0, tva_deductible: 0, tva_a_payer: 0 });
  const { toast } = useToast();

  useEffect(() => {
    loadAvailablePeriods();
  }, []);

  useEffect(() => {
    if (selectedMonth && selectedYear) {
      loadTvaData();
    }
  }, [selectedMonth, selectedYear]);

  const loadAvailablePeriods = async () => {
    try {
      const { data: fichiers, error } = await supabase
        .from("fichiers_rapprochement")
        .select("date_debut, date_fin")
        .eq("statut", "VALIDE")
        .order("date_debut", { ascending: false });

      if (error) throw error;

      const periods = new Map<string, { month: string; year: string }>();
      fichiers?.forEach(fichier => {
        const date = new Date(fichier.date_debut);
        const month = (date.getMonth() + 1).toString();
        const year = date.getFullYear().toString();
        const key = `${year}-${month}`;
        if (!periods.has(key)) {
          periods.set(key, { month, year });
        }
      });

      const periodsArray = Array.from(periods.values()).sort((a, b) => {
        if (a.year !== b.year) return parseInt(b.year) - parseInt(a.year);
        return parseInt(b.month) - parseInt(a.month);
      });

      setAvailablePeriods(periodsArray);
      if (periodsArray.length > 0 && !selectedMonth && !selectedYear) {
        setSelectedMonth(periodsArray[0].month);
        setSelectedYear(periodsArray[0].year);
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les périodes disponibles",
        variant: "destructive",
      });
    }
  };

  const loadTvaData = async () => {
    try {
      const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
      const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0);

      // Récupérer les fichiers de rapprochement validés pour la période
      const { data: fichiers, error: fichierError } = await supabase
        .from("fichiers_rapprochement")
        .select("fichier_data, date_debut, date_fin")
        .eq("statut", "VALIDE")
        .gte("date_debut", startDate.toISOString().split('T')[0])
        .lte("date_fin", endDate.toISOString().split('T')[0]);

      if (fichierError) throw fichierError;

      // Extraire toutes les lignes de rapprochement du JSON
      const allLignes: RapprochementLigne[] = [];
      const factureIds = new Set<string>();

      console.log("Fichiers récupérés:", fichiers?.length);

      fichiers?.forEach(fichier => {
        const data = fichier.fichier_data as any;
        console.log("Structure fichier_data:", data);
        
        if (data?.rapprochements) {
          console.log("Nombre de rapprochements:", data.rapprochements.length);
          data.rapprochements.forEach((rap: any) => {
            const transaction = rap.transaction;
            const facture = rap.facture;
            const status = rap.status; // matched, uncertain, unmatched
            
            console.log("Rapprochement:", { status, facture });
            
            // Collecter les IDs de factures pour récupérer la TVA
            if (facture?.id) {
              factureIds.add(facture.id);
              console.log("ID facture ajouté:", facture.id);
            }

            allLignes.push({
              id: `${transaction.date}_${transaction.libelle}_${Math.abs(transaction.montant)}`,
              transaction_date: transaction.date,
              transaction_libelle: transaction.libelle,
              transaction_montant: transaction.montant,
              transaction_credit: transaction.credit || 0,
              transaction_debit: transaction.debit || 0,
              statut: status === "matched" ? "RAPPROCHE" : status === "uncertain" ? "INCERTAIN" : "NON_RAPPROCHE",
              facture: facture ? {
                numero_facture: facture.numero_facture,
                total_tva: 0, // Sera rempli après
                type_facture: facture.type_facture,
              } : undefined,
            });
          });
        }
      });

      console.log("IDs de factures collectés:", Array.from(factureIds));

      // Récupérer les infos complètes des factures pour avoir le total_tva
      if (factureIds.size > 0) {
        console.log("Récupération des factures pour les IDs:", Array.from(factureIds));
        const { data: factures, error: facturesError } = await supabase
          .from("factures")
          .select("id, numero_facture, type_facture, total_tva")
          .in("id", Array.from(factureIds));

        if (facturesError) throw facturesError;

        console.log("Factures récupérées:", factures);

        // Mapper les TVA sur les lignes
        const factureMap = new Map(factures?.map(f => [f.numero_facture, f]) || []);
        console.log("Map des factures:", factureMap);
        
        allLignes.forEach(ligne => {
          if (ligne.facture) {
            const factureData = factureMap.get(ligne.facture.numero_facture);
            console.log(`Recherche facture ${ligne.facture.numero_facture}:`, factureData);
            if (factureData) {
              ligne.facture.total_tva = factureData.total_tva || 0;
              console.log(`TVA assignée: ${ligne.facture.total_tva}`);
            }
          }
        });
      }

      console.log("Lignes finales avec TVA:", allLignes);

      setLignes(allLignes);

      // Calculer les stats
      let tva_collectee = 0;
      let tva_deductible = 0;

      allLignes.forEach(ligne => {
        if (ligne.statut === "RAPPROCHE" && ligne.facture) {
          const tva = ligne.facture.total_tva || 0;
          if (ligne.facture.type_facture === "VENTES") {
            tva_collectee += tva;
          } else if (ligne.facture.type_facture === "ACHATS") {
            tva_deductible += tva;
          }
        }
      });

      setStats({
        tva_collectee,
        tva_deductible,
        tva_a_payer: tva_collectee - tva_deductible,
      });
    } catch (error: any) {
      console.error("Erreur chargement TVA:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données TVA",
        variant: "destructive",
      });
    }
  };

  const getMonthName = (month: string) => {
    const date = new Date(2024, parseInt(month) - 1, 1);
    return format(date, "MMMM", { locale: fr });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">TVA Mensuel</h1>
        </div>
      </div>

      {/* Filtres de période */}
      <Card>
        <CardHeader>
          <CardTitle>Sélectionner une période</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Mois" />
            </SelectTrigger>
            <SelectContent>
              {Array.from(new Set(availablePeriods.map(p => p.month)))
                .sort((a, b) => parseInt(a) - parseInt(b))
                .map(month => (
                  <SelectItem key={month} value={month}>
                    {getMonthName(month)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Année" />
            </SelectTrigger>
            <SelectContent>
              {Array.from(new Set(availablePeriods.map(p => p.year)))
                .sort((a, b) => parseInt(b) - parseInt(a))
                .map(year => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Résumé TVA */}
      {selectedMonth && selectedYear && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">TVA Collectée</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {stats.tva_collectee.toFixed(2)} €
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">TVA Déductible</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {stats.tva_deductible.toFixed(2)} €
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">TVA à Payer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {stats.tva_a_payer.toFixed(2)} €
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Détail des lignes */}
          <Card>
            <CardHeader>
              <CardTitle>Détail des transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Facture</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">TVA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignes.map((ligne) => (
                    <TableRow key={ligne.id}>
                      <TableCell>
                        {format(new Date(ligne.transaction_date), "dd/MM/yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>{ligne.transaction_libelle}</TableCell>
                      <TableCell>
                        {ligne.transaction_credit > 0 && (
                          <span className="text-green-600">+{ligne.transaction_credit.toFixed(2)} €</span>
                        )}
                        {ligne.transaction_debit > 0 && (
                          <span className="text-red-600">-{ligne.transaction_debit.toFixed(2)} €</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ligne.statut === "RAPPROCHE" ? "default" : ligne.statut === "INCERTAIN" ? "secondary" : "outline"}>
                          {ligne.statut === "RAPPROCHE" ? "Rapproché" : ligne.statut === "INCERTAIN" ? "Incertain" : "Non rapproché"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ligne.facture?.numero_facture || "-"}
                      </TableCell>
                      <TableCell>
                        {ligne.facture && (
                          <Badge variant={ligne.facture.type_facture === "VENTES" ? "default" : "secondary"}>
                            {ligne.facture.type_facture === "VENTES" ? "Vente" : "Achat"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {ligne.statut === "RAPPROCHE" && ligne.facture ? (
                          <span className={ligne.facture.type_facture === "VENTES" ? "text-green-600" : "text-blue-600"}>
                            {ligne.facture.total_tva?.toFixed(2)} €
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
