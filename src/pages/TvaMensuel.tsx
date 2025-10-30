import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableRow, TableHeader } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Receipt, RefreshCcw, ArrowUpDown, Search } from "lucide-react";

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
  manualId?: string;
  abonnementId?: string;
  declarationId?: string;
  notes?: string;
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
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<keyof RapprochementLigne | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();

  useEffect(() => {
    loadAvailablePeriods();
  }, []);

  useEffect(() => {
    if (selectedMonth && selectedYear) {
      loadTvaData();
    }
  }, [selectedMonth, selectedYear]);

  const toggleLineSelection = (lineId: string) => {
    setSelectedLines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lineId)) {
        newSet.delete(lineId);
      } else {
        newSet.add(lineId);
      }
      return newSet;
    });
  };

  const toggleAllLines = () => {
    if (selectedLines.size === lignes.length) {
      setSelectedLines(new Set());
    } else {
      setSelectedLines(new Set(lignes.map(l => l.id)));
    }
  };

  const handleSort = (column: keyof RapprochementLigne) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Filtrer et trier les lignes
  const filteredAndSortedLignes = lignes
    .filter(ligne => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        ligne.transaction_libelle?.toLowerCase().includes(searchLower) ||
        ligne.transaction_date?.includes(searchTerm) ||
        (ligne.facture?.numero_facture && ligne.facture.numero_facture.toLowerCase().includes(searchLower)) ||
        (ligne.factures && ligne.factures.some(f => f.numero_facture.toLowerCase().includes(searchLower)))
      );
    })
    .sort((a, b) => {
      if (!sortColumn) return 0;
      
      let aValue: any = a[sortColumn];
      let bValue: any = b[sortColumn];

      // Gestion spéciale pour les dates
      if (sortColumn === "transaction_date") {
        aValue = new Date(aValue || 0).getTime();
        bValue = new Date(bValue || 0).getTime();
      }

      // Gestion spéciale pour les montants
      if (sortColumn === "transaction_montant" || sortColumn === "total_tva") {
        aValue = aValue || 0;
        bValue = bValue || 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

  const lignesRapprochees = filteredAndSortedLignes.filter(l => l.statut === "RAPPROCHE");
  const lignesNonRapprochees = filteredAndSortedLignes.filter(l => l.statut === "NON_RAPPROCHE");

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

      // 2. Extraire les transactions et rapprochements du JSON
      const transactions = (fichiers.fichier_data as any)?.transactions || [];
      const rapprochementsJSON = (fichiers.fichier_data as any)?.rapprochements || [];
      
      console.log("📦 Total transactions dans le fichier:", transactions.length);
      console.log("📦 Total rapprochements dans le JSON:", rapprochementsJSON.length);
      console.log("📦 Exemple de rapprochement:", rapprochementsJSON[0]);

      if (transactions.length === 0) {
        console.log("⚠️ Aucune transaction trouvée dans le fichier");
        setLignes([]);
        setStats({ tva_collectee: 0, tva_deductible: 0, tva_a_payer: 0 });
        return;
      }

      // 3. Créer une map transaction -> rapprochement depuis le JSON
      const transactionToRapprochement = new Map<string, any>();
      rapprochementsJSON.forEach((rapp: any) => {
        if (rapp.status === 'matched') {
          const key = `${rapp.transaction.date}_${rapp.transaction.libelle}_${rapp.transaction.montant}`;
          transactionToRapprochement.set(key, rapp);
        }
      });
      
      console.log("🔗 Map transaction -> rapprochement créée avec", transactionToRapprochement.size, "entrées matched");

      // 4. Récupérer tous les IDs de factures depuis les rapprochements JSON
      const factureIds = new Set<string>();
      rapprochementsJSON.forEach((rapp: any) => {
        if (rapp.status === 'matched') {
          if (rapp.facture?.id) {
            factureIds.add(rapp.facture.id);
          }
          if (rapp.factureIds && Array.isArray(rapp.factureIds)) {
            rapp.factureIds.forEach((id: string) => factureIds.add(id));
          }
        }
      });

      console.log("📋 Total factures uniques trouvées:", factureIds.size);

      // 5. Charger toutes les factures nécessaires
      let facturesMap = new Map<string, any>();
      
      if (factureIds.size > 0) {
        const { data: factures, error: facturesError } = await supabase
          .from("factures")
          .select("id, numero_facture, type_facture, total_tva, total_ttc, statut, date_emission")
          .in("id", Array.from(factureIds));

        if (facturesError) {
          console.error("❌ Erreur chargement factures:", facturesError);
        } else if (factures) {
          console.log("✅ Factures chargées:", factures.length);
          factures.forEach(f => facturesMap.set(f.id, f));
        }
      }

      // 6. Créer les lignes TVA à partir des transactions rapprochées uniquement
      const nouvLignes: RapprochementLigne[] = [];
      let totalTvaCollectee = 0;
      let totalTvaDeductible = 0;
      let countRapprochees = 0;

      transactions.forEach((transaction: any, index: number) => {
        const key = `${transaction.date}_${transaction.libelle}_${transaction.montant}`;
        const rapp = transactionToRapprochement.get(key);

        // Ne traiter que les lignes qui ont un rapprochement dans le JSON
        if (!rapp) {
          // Ajouter quand même la ligne mais sans TVA
          nouvLignes.push({
            id: `${transaction.date}_${transaction.libelle}`,
            transaction_date: transaction.date,
            transaction_libelle: transaction.libelle,
            transaction_debit: transaction.debit || 0,
            transaction_credit: transaction.credit || 0,
            transaction_montant: transaction.montant,
            statut: 'NON_RAPPROCHE',
          });
          return;
        }

        countRapprochees++;

        if (countRapprochees === 1) {
          console.log("🔍 Premier rapprochement trouvé:", rapp);
        }

        // Récupérer les factures depuis le JSON
        let facturesData: any[] = [];
        
        // Cas 1: Facture unique
        if (rapp.facture?.id) {
          const facture = facturesMap.get(rapp.facture.id);
          if (facture) {
            facturesData.push(facture);
          }
        }
        
        // Cas 2: Factures multiples
        if (rapp.factureIds && Array.isArray(rapp.factureIds)) {
          rapp.factureIds.forEach((factureId: string) => {
            const facture = facturesMap.get(factureId);
            if (facture) {
              facturesData.push(facture);
            }
          });
        }

        if (countRapprochees === 1 && facturesData.length > 0) {
          console.log("✅ Factures liées trouvées:", facturesData.length);
        }

        // Calculer TVA pour cette ligne rapprochée
        let tvaLigne = 0;

        if (facturesData.length > 0) {
          tvaLigne = facturesData.reduce((sum, f) => sum + (f.total_tva || 0), 0);

          const typeFacture = facturesData[0].type_facture;
          // Accumuler dans les totaux pour les lignes rapprochées
          if (typeFacture === "VENTES") {
            totalTvaCollectee += tvaLigne;
          } else if (typeFacture === "ACHATS") {
            totalTvaDeductible += tvaLigne;
          }
        }

        const ligne: RapprochementLigne = {
          id: `${transaction.date}_${transaction.libelle}_${index}`,
          transaction_date: transaction.date,
          transaction_libelle: transaction.libelle,
          transaction_debit: transaction.debit || 0,
          transaction_credit: transaction.credit || 0,
          transaction_montant: transaction.montant,
          statut: 'RAPPROCHE',
          abonnementId: rapp.abonnement_info?.id,
          declarationId: rapp.declaration_info?.id,
          notes: rapp.notes,
        };

        if (facturesData.length > 0) {
          ligne.factures = facturesData.map(f => ({
            numero_facture: f.numero_facture,
            total_tva: f.total_tva || 0,
            type_facture: f.type_facture,
          }));
          ligne.total_tva = tvaLigne;
        }

        nouvLignes.push(ligne);
      });

      console.log("📊 Total lignes:", nouvLignes.length);
      console.log("✅ Lignes rapprochées:", countRapprochees);
      console.log("💰 TVA collectée:", totalTvaCollectee);
      console.log("💸 TVA déductible:", totalTvaDeductible);

      setLignes(nouvLignes);
      setStats({
        tva_collectee: totalTvaCollectee,
        tva_deductible: totalTvaDeductible,
        tva_a_payer: totalTvaCollectee - totalTvaDeductible,
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

      {/* Statistiques des lignes */}
      {selectedMonth && selectedYear && lignes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Statistiques des lignes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Total lignes</div>
                <div className="text-2xl font-bold">{lignes.length}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Rapprochées</div>
                <div className="text-2xl font-bold text-green-600">{lignesRapprochees.length}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Non rapprochées</div>
                <div className="text-2xl font-bold text-orange-600">{lignesNonRapprochees.length}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Sélectionnées</div>
                <div className="text-2xl font-bold text-primary">{selectedLines.size}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle>Détail des transactions</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-auto max-h-[600px] border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-[50px] bg-background">
                        <Checkbox
                          checked={selectedLines.size === filteredAndSortedLignes.length && filteredAndSortedLignes.length > 0}
                          onCheckedChange={toggleAllLines}
                        />
                      </TableHead>
                      <TableHead className="bg-background min-w-[100px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-full justify-start px-2 hover:bg-accent"
                          onClick={() => handleSort("transaction_date")}
                        >
                          Date
                          <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="bg-background min-w-[200px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-full justify-start px-2 hover:bg-accent"
                          onClick={() => handleSort("transaction_libelle")}
                        >
                          Libellé
                          <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="bg-background min-w-[120px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-full justify-start px-2 hover:bg-accent"
                          onClick={() => handleSort("transaction_montant")}
                        >
                          Montant
                          <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="bg-background min-w-[100px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-full justify-start px-2 hover:bg-accent"
                          onClick={() => handleSort("statut")}
                        >
                          Statut
                          <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="bg-background min-w-[150px]">Facture</TableHead>
                      <TableHead className="bg-background min-w-[100px]">Type</TableHead>
                      <TableHead className="text-right bg-background min-w-[100px]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-full justify-end px-2 hover:bg-accent"
                          onClick={() => handleSort("total_tva")}
                        >
                          TVA
                          <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedLignes.map((ligne) => (
                      <TableRow key={ligne.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedLines.has(ligne.id)}
                            onCheckedChange={() => toggleLineSelection(ligne.id)}
                          />
                        </TableCell>
                        <TableCell>{ligne.transaction_date ? format(new Date(ligne.transaction_date), "dd/MM/yyyy", { locale: fr }) : ""}</TableCell>
                        <TableCell>{ligne.transaction_libelle}</TableCell>
                        <TableCell>
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                          }).format(ligne.transaction_montant)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              ligne.statut === "RAPPROCHE"
                                ? "default"
                                : "outline"
                            }
                          >
                            {ligne.statut === "RAPPROCHE" ? "Rapprochée" : "Non rapprochée"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {ligne.factures && ligne.factures.length > 0
                            ? ligne.factures.map(f => f.numero_facture).join(", ")
                            : ligne.facture?.numero_facture || "—"}
                        </TableCell>
                        <TableCell>
                          {ligne.factures && ligne.factures.length > 0
                            ? ligne.factures[0].type_facture === "VENTES" ? "Vente" : "Achat"
                            : ligne.facture?.type_facture === "VENTES" ? "Vente" : ligne.facture?.type_facture === "ACHATS" ? "Achat" : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {ligne.total_tva !== undefined && ligne.total_tva !== null
                            ? new Intl.NumberFormat("fr-FR", {
                                style: "currency",
                                currency: "EUR",
                              }).format(ligne.total_tva)
                            : ligne.facture?.total_tva !== undefined
                            ? new Intl.NumberFormat("fr-FR", {
                                style: "currency",
                                currency: "EUR",
                              }).format(ligne.facture.total_tva)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
