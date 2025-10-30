import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableRow, TableHeader } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Receipt, RefreshCcw } from "lucide-react";

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
  factures?: {
    numero_facture: string;
    total_tva: number;
    type_facture: string;
  }[];
  total_tva?: number;
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
  const [isRecalculating, setIsRecalculating] = useState(false);
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
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth);
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

      console.log("Chargement TVA pour période:", startDate, "->", endDate);

      // 1. Charger le fichier de rapprochement validé pour cette période
      const { data: fichiers, error: fichierError } = await supabase
        .from("fichiers_rapprochement")
        .select("*")
        .eq("statut", "VALIDE")
        .gte("date_debut", startDate)
        .lte("date_fin", endDate)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fichierError) {
        console.error("Erreur chargement fichier:", fichierError);
        throw fichierError;
      }

      if (!fichiers) {
        console.log("Aucun fichier de rapprochement validé trouvé pour cette période");
        setLignes([]);
        setStats({ tva_collectee: 0, tva_deductible: 0, tva_a_payer: 0 });
        return;
      }

      // 2. Extraire les transactions du JSON
      const transactions = (fichiers.fichier_data as any)?.transactions || [];
      console.log("Total transactions dans le fichier:", transactions.length);

      if (transactions.length === 0) {
        setLignes([]);
        setStats({ tva_collectee: 0, tva_deductible: 0, tva_a_payer: 0 });
        return;
      }

      // 3. Charger tous les rapprochements bancaires de la période
      const { data: rapprochements } = await supabase
        .from("rapprochements_bancaires")
        .select("*")
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate);

      console.log("Rapprochements bancaires trouvés:", rapprochements?.length || 0);

      // 4. Créer une map des rapprochements par libellé/montant pour matching
      const rapMap = new Map<string, any>();
      rapprochements?.forEach(rap => {
        const key = `${rap.transaction_date}_${rap.transaction_montant}`;
        rapMap.set(key, rap);
      });

      // 5. Récupérer toutes les liaisons rapprochements-factures
      const rapIds = rapprochements?.map(r => r.id) || [];
      let liaisons: any[] = [];
      if (rapIds.length > 0) {
        const { data: liaisonsData } = await supabase
          .from("rapprochements_factures")
          .select("rapprochement_id, facture_id")
          .in("rapprochement_id", rapIds);
        liaisons = liaisonsData || [];
      }

      console.log("Liaisons trouvées:", liaisons.length);

      // 6. Récupérer tous les IDs de factures
      const factureIdsFromRap = rapprochements
        ?.filter(r => r.facture_id)
        .map(r => r.facture_id) || [];
      
      const factureIdsFromLiaison = liaisons.map(l => l.facture_id);
      const allFactureIds = [...new Set([...factureIdsFromRap, ...factureIdsFromLiaison])];

      console.log("Total IDs factures à charger:", allFactureIds.length);

      // 7. Charger toutes les factures
      let facturesMap = new Map<string, any>();
      if (allFactureIds.length > 0) {
        const { data: factures } = await supabase
          .from("factures")
          .select("id, numero_facture, type_facture, total_tva, total_ttc, statut")
          .in("id", allFactureIds);

        factures?.forEach(f => facturesMap.set(f.id, f));
        console.log("Factures chargées:", factures?.length || 0);
      }

      // 8. Créer une map liaison rapprochement -> factures
      const rapToFactures = new Map<string, string[]>();
      liaisons.forEach(l => {
        if (!rapToFactures.has(l.rapprochement_id)) {
          rapToFactures.set(l.rapprochement_id, []);
        }
        rapToFactures.get(l.rapprochement_id)?.push(l.facture_id);
      });

      // 9. Créer les lignes TVA (une par transaction du JSON)
      const allLignes: RapprochementLigne[] = transactions.map((trans: any) => {
        const transDate = trans.date;
        const transMontant = trans.montant;
        const key = `${transDate}_${transMontant}`;
        
        // Trouver le rapprochement bancaire correspondant
        const rap = rapMap.get(key);

        const facturesForTrans: any[] = [];
        
        if (rap) {
          // Facture directe
          if (rap.facture_id && facturesMap.has(rap.facture_id)) {
            facturesForTrans.push(facturesMap.get(rap.facture_id));
          }
          
          // Factures via liaison
          const liaisonFactureIds = rapToFactures.get(rap.id) || [];
          liaisonFactureIds.forEach(fId => {
            if (facturesMap.has(fId)) {
              facturesForTrans.push(facturesMap.get(fId));
            }
          });
        }

        // Déterminer le statut
        let statut = rap ? "RAPPROCHE" : "NON_RAPPROCHE";
        if (rap && (rap.abonnement_id || rap.declaration_charge_id)) {
          statut = "RAPPROCHE";
        }

        const ligne: RapprochementLigne = {
          id: rap?.id || `trans_${transDate}_${Math.abs(transMontant)}`,
          transaction_date: transDate,
          transaction_libelle: trans.libelle,
          transaction_montant: transMontant,
          transaction_credit: trans.credit || 0,
          transaction_debit: trans.debit || 0,
          statut,
        };

        if (facturesForTrans.length === 1) {
          const facture = facturesForTrans[0];
          ligne.facture = {
            numero_facture: facture.numero_facture,
            total_tva: facture.total_tva || 0,
            type_facture: facture.type_facture,
          };
        } else if (facturesForTrans.length > 1) {
          const totalTva = facturesForTrans.reduce((sum, f) => sum + (f.total_tva || 0), 0);
          ligne.factures = facturesForTrans.map(f => ({
            numero_facture: f.numero_facture,
            total_tva: f.total_tva || 0,
            type_facture: f.type_facture,
          }));
          ligne.total_tva = totalTva;
        }

        return ligne;
      });

      console.log("Lignes TVA créées:", allLignes.length);

      setLignes(allLignes);

      // Calculer les stats
      let tva_collectee = 0;
      let tva_deductible = 0;

      allLignes.forEach(ligne => {
        // Si plusieurs factures, utiliser total_tva
        if (ligne.factures && ligne.factures.length > 0) {
          const tva = ligne.total_tva || 0;
          const type = ligne.factures[0].type_facture;
          if (type === "VENTES") {
            tva_collectee += tva;
          } else if (type === "ACHATS") {
            tva_deductible += tva;
          }
        } else if (ligne.facture) {
          const tva = ligne.facture.total_tva || 0;
          if (ligne.facture.type_facture === "VENTES") {
            tva_collectee += tva;
          } else if (ligne.facture.type_facture === "ACHATS") {
            tva_deductible += tva;
          }
        }
      });

      console.log("Stats TVA:", { tva_collectee, tva_deductible });

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

  const recalculerTVA = async () => {
    if (!selectedMonth || !selectedYear) return;
    
    setIsRecalculating(true);
    try {
      // Récupérer toutes les factures validées
      const { data: factures, error: facturesError } = await supabase
        .from("factures")
        .select("id, numero_facture, type_facture, total_tva, total_ttc")
        .in("statut", ["VALIDEE", "PAYEE"]);

      if (facturesError) throw facturesError;

      // Créer une map pour recherche rapide par numéro de facture
      const factureMapByNumero = new Map(factures?.map(f => [f.numero_facture, f]) || []);
      
      // Créer une map pour recherche par montant approximatif (±1%)
      const factureMapByMontant = new Map<number, typeof factures>();
      factures?.forEach(f => {
        const montantKey = Math.round(f.total_ttc * 100) / 100;
        if (!factureMapByMontant.has(montantKey)) {
          factureMapByMontant.set(montantKey, []);
        }
        factureMapByMontant.get(montantKey)?.push(f);
      });

      // Parcourir les lignes et essayer d'associer les factures manquantes
      const updatedLignes = lignes.map(ligne => {
        // Si la ligne a déjà une facture avec TVA, ne pas toucher
        if (ligne.facture && ligne.facture.total_tva > 0) {
          return ligne;
        }

        // Chercher une facture correspondante
        let factureCorrespondante = null;

        // 1. Recherche par numéro de facture si présent dans le libellé
        if (ligne.facture?.numero_facture) {
          factureCorrespondante = factureMapByNumero.get(ligne.facture.numero_facture);
        }
        
        // 2. Recherche dans le libellé de la transaction
        if (!factureCorrespondante) {
          // Extraire les numéros de facture du libellé (format FAC-XXX, F XXX, etc.)
          const facRegex = /(?:FAC|F)[\s-]*([A-Z0-9-]+)/gi;
          const matches = ligne.transaction_libelle.matchAll(facRegex);
          
          for (const match of matches) {
            const numeroFacture = match[0].replace(/\s+/g, '-').toUpperCase();
            const facture = Array.from(factureMapByNumero.values()).find(f => 
              f.numero_facture.includes(match[1]) || 
              numeroFacture.includes(f.numero_facture)
            );
            if (facture) {
              factureCorrespondante = facture;
              break;
            }
          }
        }

        // 3. Recherche par montant si pas trouvé
        if (!factureCorrespondante) {
          const montantTransaction = Math.abs(ligne.transaction_montant);
          const montantKey = Math.round(montantTransaction * 100) / 100;
          
          // Chercher avec une tolérance de ±2%
          for (let tolerance = 0; tolerance <= 2; tolerance += 0.5) {
            const montantMin = montantKey * (1 - tolerance / 100);
            const montantMax = montantKey * (1 + tolerance / 100);
            
            for (const [key, facturesList] of factureMapByMontant.entries()) {
              if (key >= montantMin && key <= montantMax) {
                // Prendre la première facture correspondante
                const facture = facturesList.find(f => 
                  (ligne.transaction_credit > 0 && f.type_facture === "VENTES") ||
                  (ligne.transaction_debit > 0 && f.type_facture === "ACHATS")
                );
                if (facture) {
                  factureCorrespondante = facture;
                  break;
                }
              }
            }
            if (factureCorrespondante) break;
          }
        }

        // Si une facture a été trouvée, mettre à jour la ligne
        if (factureCorrespondante) {
          console.log(`Facture trouvée pour ${ligne.transaction_libelle}:`, factureCorrespondante);
          return {
            ...ligne,
            facture: {
              numero_facture: factureCorrespondante.numero_facture,
              total_tva: factureCorrespondante.total_tva || 0,
              type_facture: factureCorrespondante.type_facture,
            }
          };
        }

        return ligne;
      });

      setLignes(updatedLignes);

      // Recalculer les stats
      let tva_collectee = 0;
      let tva_deductible = 0;

      updatedLignes.forEach(ligne => {
        if (ligne.statut === "RAPPROCHE") {
          // Si plusieurs factures, utiliser total_tva
          if (ligne.factures && ligne.factures.length > 0) {
            const tva = ligne.total_tva || 0;
            const type = ligne.factures[0].type_facture;
            if (type === "VENTES") {
              tva_collectee += tva;
            } else if (type === "ACHATS") {
              tva_deductible += tva;
            }
          } else if (ligne.facture) {
            const tva = ligne.facture.total_tva || 0;
            if (ligne.facture.type_facture === "VENTES") {
              tva_collectee += tva;
            } else if (ligne.facture.type_facture === "ACHATS") {
              tva_deductible += tva;
            }
          }
        }
      });

      setStats({
        tva_collectee,
        tva_deductible,
        tva_a_payer: tva_collectee - tva_deductible,
      });

      toast({
        title: "Recalcul terminé",
        description: "Les factures et TVA ont été recalculées",
      });
    } catch (error: any) {
      console.error("Erreur recalcul:", error);
      toast({
        title: "Erreur",
        description: "Impossible de recalculer la TVA",
        variant: "destructive",
      });
    } finally {
      setIsRecalculating(false);
    }
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              Résumé TVA - {getMonthName(selectedMonth)} {selectedYear}
            </h2>
            <Button
              onClick={recalculerTVA}
              disabled={isRecalculating}
              variant="outline"
              size="sm"
            >
              <RefreshCcw className={`h-4 w-4 mr-2 ${isRecalculating ? "animate-spin" : ""}`} />
              Recalculer TVA
            </Button>
          </div>

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
                        {ligne.factures && ligne.factures.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {ligne.factures.map((f, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {f.numero_facture}
                              </Badge>
                            ))}
                          </div>
                        ) : ligne.facture?.numero_facture ? (
                          ligne.facture.numero_facture
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {ligne.factures && ligne.factures.length > 0 ? (
                          <Badge variant={ligne.factures[0].type_facture === "VENTES" ? "default" : "secondary"}>
                            {ligne.factures[0].type_facture === "VENTES" ? "Vente" : "Achat"}
                          </Badge>
                        ) : ligne.facture ? (
                          <Badge variant={ligne.facture.type_facture === "VENTES" ? "default" : "secondary"}>
                            {ligne.facture.type_facture === "VENTES" ? "Vente" : "Achat"}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        {ligne.statut === "RAPPROCHE" ? (
                          ligne.factures && ligne.factures.length > 0 ? (
                            <span className={ligne.factures[0].type_facture === "VENTES" ? "text-green-600 font-semibold" : "text-blue-600 font-semibold"}>
                              {ligne.total_tva?.toFixed(2)} €
                            </span>
                          ) : ligne.facture ? (
                            <span className={ligne.facture.type_facture === "VENTES" ? "text-green-600" : "text-blue-600"}>
                              {ligne.facture.total_tva?.toFixed(2)} €
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )
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
