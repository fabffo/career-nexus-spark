import { useState, useRef, useEffect } from "react";
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { format, parse, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TransactionBancaire {
  date: string;
  libelle: string;
  debit: number;
  credit: number;
  montant: number; // Débit en négatif, Crédit en positif
}

interface FactureMatch {
  id: string;
  numero_facture: string;
  type_facture: "VENTES" | "ACHATS";
  date_emission: string;
  partenaire_nom: string;
  total_ttc: number;
  statut: string;
}

interface Rapprochement {
  transaction: TransactionBancaire;
  facture: FactureMatch | null;
  score: number; // 0-100, score de confiance du match
  status: "matched" | "unmatched" | "uncertain";
}

export default function RapprochementBancaire() {
  const [transactions, setTransactions] = useState<TransactionBancaire[]>([]);
  const [rapprochements, setRapprochements] = useState<Rapprochement[]>([]);
  const [loading, setLoading] = useState(false);
  const [factures, setFactures] = useState<FactureMatch[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const parseDate = (dateStr: string): Date | null => {
    // Format attendu: DD/MM/YYYY
    const formats = ["dd/MM/yyyy", "dd-MM-yyyy", "yyyy-MM-dd"];
    
    for (const formatStr of formats) {
      try {
        const parsed = parse(dateStr, formatStr, new Date());
        if (isValid(parsed)) {
          return parsed;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  };

  const normalizeString = (str: string): string => {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  const parseAmount = (str: string): number => {
    if (!str) return 0;
    // Remplacer la virgule par un point et supprimer les espaces
    const cleaned = str.replace(/\s/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);

    try {
      // Charger toutes les factures
      const { data: facturesData, error: facturesError } = await supabase
        .from("factures")
        .select("*")
        .in("statut", ["VALIDEE", "PAYEE"]);

      if (facturesError) throw facturesError;

      const facturesFormatted: FactureMatch[] = (facturesData || []).map((f) => ({
        id: f.id,
        numero_facture: f.numero_facture,
        type_facture: f.type_facture as "VENTES" | "ACHATS",
        date_emission: f.date_emission,
        partenaire_nom: f.type_facture === "VENTES" ? f.destinataire_nom : f.emetteur_nom,
        total_ttc: f.total_ttc || 0,
        statut: f.statut,
      }));

      setFactures(facturesFormatted);

      const fileName = file.name.toLowerCase();
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

      if (isExcel) {
        // Parser Excel
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

            console.log("Excel data:", jsonData.slice(0, 5)); // Debug

            // Trouver la ligne d'en-tête
            let headerRow = 0;
            for (let i = 0; i < Math.min(10, jsonData.length); i++) {
              const row = jsonData[i];
              if (row && row.some((cell: any) => 
                String(cell).toUpperCase().includes('DATE') || 
                String(cell).toUpperCase().includes('LIBELLE')
              )) {
                headerRow = i;
                break;
              }
            }

            const headers = jsonData[headerRow].map((h: any) => String(h).trim());
            console.log("Headers found:", headers); // Debug

            const transactionsParsed: TransactionBancaire[] = [];
            
            for (let i = headerRow + 1; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (!row || row.length === 0) continue;

              const rowObj: any = {};
              headers.forEach((header, index) => {
                rowObj[header] = row[index];
              });

              // Trouver les colonnes
              const dateValue = rowObj.DATE || rowObj.date || rowObj.Date || row[0];
              const libelleValue = rowObj.LIBELLE || rowObj.libelle || rowObj.Libelle || row[1];
              const debitValue = rowObj.Débit || rowObj.DEBIT || rowObj.debit || rowObj["Débit"] || row[2];
              const creditValue = rowObj.Crédit || rowObj.CREDIT || rowObj.credit || rowObj["Crédit"] || row[3];

              if (!dateValue) continue;

              // Convertir la date Excel si nécessaire
              let date: Date | null = null;
              if (typeof dateValue === 'number') {
                // Date Excel (nombre de jours depuis 1900-01-01)
                const excelDate = XLSX.SSF.parse_date_code(dateValue);
                if (excelDate && typeof excelDate === 'object' && 'y' in excelDate) {
                  date = new Date(
                    (excelDate as any).y, 
                    ((excelDate as any).m || 1) - 1, 
                    (excelDate as any).d || 1
                  );
                }
              } else {
                date = parseDate(String(dateValue));
              }

              if (!date) continue;

              const debit = parseAmount(String(debitValue || "0"));
              const credit = parseAmount(String(creditValue || "0"));
              const montant = credit > 0 ? credit : -debit;

              transactionsParsed.push({
                date: format(date, "yyyy-MM-dd"),
                libelle: String(libelleValue || ""),
                debit,
                credit,
                montant,
              });
            }

            console.log("Transactions parsed:", transactionsParsed.length); // Debug

            setTransactions(transactionsParsed);

            // Effectuer le rapprochement automatique
            const rapprochementsResult = performMatching(transactionsParsed, facturesFormatted);
            setRapprochements(rapprochementsResult);

            toast({
              title: "Fichier importé",
              description: `${transactionsParsed.length} transactions importées`,
            });

            setLoading(false);
          } catch (error) {
            console.error("Erreur parsing Excel:", error);
            toast({
              title: "Erreur",
              description: "Impossible de lire le fichier Excel",
              variant: "destructive",
            });
            setLoading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        // Parser CSV
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const transactionsParsed: TransactionBancaire[] = results.data
              .map((row: any) => {
                const dateStr = row.DATE || row.date || row.Date;
                const date = parseDate(dateStr);
                if (!date) return null;

                const debit = parseAmount(row.Débit || row.DEBIT || row.debit || "0");
                const credit = parseAmount(row.Crédit || row.CREDIT || row.credit || "0");
                const montant = credit > 0 ? credit : -debit;

                return {
                  date: format(date, "yyyy-MM-dd"),
                  libelle: row.LIBELLE || row.libelle || row.Libelle || "",
                  debit,
                  credit,
                  montant,
                };
              })
              .filter((t): t is TransactionBancaire => t !== null);

            setTransactions(transactionsParsed);

            // Effectuer le rapprochement automatique
            const rapprochementsResult = performMatching(transactionsParsed, facturesFormatted);
            setRapprochements(rapprochementsResult);

            toast({
              title: "Fichier importé",
              description: `${transactionsParsed.length} transactions importées`,
            });

            setLoading(false);
          },
          error: (error) => {
            console.error("Erreur parsing CSV:", error);
            toast({
              title: "Erreur",
              description: "Impossible de lire le fichier CSV",
              variant: "destructive",
            });
            setLoading(false);
          },
        });
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les factures",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const performMatching = (
    transactions: TransactionBancaire[],
    factures: FactureMatch[]
  ): Rapprochement[] => {
    return transactions.map((transaction) => {
      let bestMatch: FactureMatch | null = null;
      let bestScore = 0;

      for (const facture of factures) {
        let score = 0;

        // 1. Vérifier le montant (40 points)
        const montantTransaction = Math.abs(transaction.montant);
        const montantFacture = Math.abs(facture.total_ttc);
        const diffMontant = Math.abs(montantTransaction - montantFacture);
        
        if (diffMontant < 0.01) {
          score += 40; // Montant exact
        } else if (diffMontant < 1) {
          score += 35; // Très proche
        } else if (diffMontant < 10) {
          score += 25; // Proche
        } else if (diffMontant / montantFacture < 0.05) {
          score += 15; // Moins de 5% de différence
        }

        // 2. Vérifier le type de transaction (10 points)
        if (transaction.credit > 0 && facture.type_facture === "VENTES") {
          score += 10;
        } else if (transaction.debit > 0 && facture.type_facture === "ACHATS") {
          score += 10;
        }

        // 3. Vérifier la date (30 points)
        const dateTransaction = new Date(transaction.date);
        const dateFacture = new Date(facture.date_emission);
        const diffJours = Math.abs(
          (dateTransaction.getTime() - dateFacture.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffJours === 0) {
          score += 30; // Même jour
        } else if (diffJours <= 3) {
          score += 25; // Moins de 3 jours
        } else if (diffJours <= 7) {
          score += 20; // Moins d'une semaine
        } else if (diffJours <= 30) {
          score += 10; // Moins d'un mois
        } else if (diffJours <= 60) {
          score += 5; // Moins de 2 mois
        }

        // 4. Vérifier le libellé (20 points)
        const libelleNormalized = normalizeString(transaction.libelle);
        const partenaireNormalized = normalizeString(facture.partenaire_nom);
        const numeroFactureNormalized = normalizeString(facture.numero_facture);

        if (libelleNormalized.includes(partenaireNormalized) || 
            partenaireNormalized.split(/\s+/).some(word => word.length > 3 && libelleNormalized.includes(word))) {
          score += 15; // Nom du partenaire dans le libellé
        }

        if (libelleNormalized.includes(numeroFactureNormalized.replace(/[^a-z0-9]/g, ""))) {
          score += 10; // Numéro de facture dans le libellé
        }

        // Chercher des mots-clés
        const keywords = ["facture", "fac", "fact", "invoice", "paiement", "virement", "payment"];
        if (keywords.some(kw => libelleNormalized.includes(kw))) {
          score += 5;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = facture;
        }
      }

      // Déterminer le statut
      let status: "matched" | "unmatched" | "uncertain";
      if (bestScore >= 70) {
        status = "matched";
      } else if (bestScore >= 40) {
        status = "uncertain";
      } else {
        status = "unmatched";
      }

      return {
        transaction,
        facture: bestMatch,
        score: bestScore,
        status,
      };
    });
  };

  const exportResults = () => {
    const csv = Papa.unparse(
      rapprochements.map((r) => ({
        Date: format(new Date(r.transaction.date), "dd/MM/yyyy"),
        Libellé: r.transaction.libelle,
        Débit: r.transaction.debit || "",
        Crédit: r.transaction.credit || "",
        Statut: r.status === "matched" ? "Rapproché" : r.status === "uncertain" ? "Incertain" : "Non rapproché",
        "N° Facture": r.facture?.numero_facture || "",
        "Type Facture": r.facture?.type_facture || "",
        Partenaire: r.facture?.partenaire_nom || "",
        "Montant Facture": r.facture?.total_ttc || "",
        "Score %": r.score,
      }))
    );

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapprochement_${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const stats = {
    total: rapprochements.length,
    matched: rapprochements.filter((r) => r.status === "matched").length,
    uncertain: rapprochements.filter((r) => r.status === "uncertain").length,
    unmatched: rapprochements.filter((r) => r.status === "unmatched").length,
  };

  // Pagination
  const totalPages = Math.ceil(rapprochements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRapprochements = rapprochements.slice(startIndex, endIndex);

  const scrollTable = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      const currentScroll = scrollRef.current.scrollLeft;
      const newScrollLeft = direction === "left" 
        ? Math.max(0, currentScroll - scrollAmount)
        : currentScroll + scrollAmount;
      
      scrollRef.current.scrollLeft = newScrollLeft;
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      const maxScroll = scrollWidth - clientWidth;
      const progress = maxScroll > 0 ? (scrollLeft / maxScroll) * 100 : 0;
      setScrollProgress(progress);
    }
  };

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      handleScroll();
    }
  }, [rapprochements]);

  const PaginationControls = () => (
    <div className="flex items-center justify-between px-2 py-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Affichage de {startIndex + 1} à {Math.min(endIndex, rapprochements.length)} sur {rapprochements.length} résultats
        </p>
        <Select
          value={itemsPerPage.toString()}
          onValueChange={(value) => {
            setItemsPerPage(parseInt(value));
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 par page</SelectItem>
            <SelectItem value="20">20 par page</SelectItem>
            <SelectItem value="50">50 par page</SelectItem>
            <SelectItem value="100">100 par page</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1 px-2">
          <span className="text-sm">
            Page {currentPage} sur {totalPages}
          </span>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rapprochement Bancaire</h1>
          <p className="text-muted-foreground mt-1">
            Importez vos relevés bancaires pour rapprocher automatiquement vos factures
          </p>
        </div>
      </div>

      {/* Zone d'upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importer un relevé bancaire
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Format attendu : CSV ou Excel avec colonnes DATE, LIBELLE, Débit, Crédit
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={loading}
              />
              <label htmlFor="file-upload">
                <Button asChild disabled={loading}>
                  <span>
                    {loading ? "Chargement..." : "Sélectionner un fichier"}
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques */}
      {rapprochements.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Rapprochés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.matched}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({Math.round((stats.matched / stats.total) * 100)}%)
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                Incertains
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats.uncertain}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({Math.round((stats.uncertain / stats.total) * 100)}%)
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                Non rapprochés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.unmatched}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({Math.round((stats.unmatched / stats.total) * 100)}%)
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Résultats */}
      {rapprochements.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Résultats du rapprochement</CardTitle>
              <Button onClick={exportResults} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <PaginationControls />
            <div className="rounded-md border">
              {/* Contrôles de défilement horizontal */}
              <div className="flex items-center gap-2 border-b p-2 bg-muted/50">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => scrollTable("left")}
                  className="h-8 w-8"
                  disabled={scrollProgress === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 rounded-full" 
                    style={{ width: `${Math.min(100, scrollProgress + 20)}%` }} 
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => scrollTable("right")}
                  className="h-8 w-8"
                  disabled={scrollProgress >= 99}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="w-full overflow-x-auto" ref={scrollRef} onScroll={handleScroll}>
                <Table className="min-w-[1800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Statut</TableHead>
                      <TableHead className="w-[140px]">Date</TableHead>
                      <TableHead className="w-[350px]">Libellé</TableHead>
                      <TableHead className="text-right w-[140px]">Débit</TableHead>
                      <TableHead className="text-right w-[140px]">Crédit</TableHead>
                      <TableHead className="w-[200px]">Facture</TableHead>
                      <TableHead className="w-[200px]">Partenaire</TableHead>
                      <TableHead className="text-right w-[180px]">Montant Facture</TableHead>
                      <TableHead className="text-right w-[120px]">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                    <TableBody>
                  {currentRapprochements.map((rapprochement, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {rapprochement.status === "matched" ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Rapproché
                          </Badge>
                        ) : rapprochement.status === "uncertain" ? (
                          <Badge className="bg-orange-100 text-orange-800">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Incertain
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            <XCircle className="h-3 w-3 mr-1" />
                            Non rapproché
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(rapprochement.transaction.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={rapprochement.transaction.libelle}>
                        {rapprochement.transaction.libelle}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {rapprochement.transaction.debit > 0
                          ? new Intl.NumberFormat("fr-FR", {
                              style: "currency",
                              currency: "EUR",
                            }).format(rapprochement.transaction.debit)
                          : ""}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {rapprochement.transaction.credit > 0
                          ? new Intl.NumberFormat("fr-FR", {
                              style: "currency",
                              currency: "EUR",
                            }).format(rapprochement.transaction.credit)
                          : ""}
                      </TableCell>
                      <TableCell>
                        {rapprochement.facture ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{rapprochement.facture.numero_facture}</span>
                            <span className="text-xs text-muted-foreground">
                              {rapprochement.facture.type_facture}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {rapprochement.facture?.partenaire_nom || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {rapprochement.facture
                          ? new Intl.NumberFormat("fr-FR", {
                              style: "currency",
                              currency: "EUR",
                            }).format(rapprochement.facture.total_ttc)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={
                            rapprochement.score >= 70
                              ? "border-green-600 text-green-600"
                              : rapprochement.score >= 40
                              ? "border-orange-600 text-orange-600"
                              : "border-red-600 text-red-600"
                          }
                        >
                          {rapprochement.score}%
                        </Badge>
                      </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <PaginationControls />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
