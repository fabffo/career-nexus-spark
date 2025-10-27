import { useState, useRef, useEffect } from "react";
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Link as LinkIcon, Check, Filter, History, Clock, Pencil } from "lucide-react";
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
import RapprochementManuelDialog from "@/components/RapprochementManuelDialog";
import EditRapprochementHistoriqueDialog from "@/components/EditRapprochementHistoriqueDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
  numero_rapprochement?: string;
  date_rapprochement?: string;
}

interface RapprochementManuel {
  id: string;
  transaction_date: string;
  transaction_libelle: string;
  transaction_debit: number;
  transaction_credit: number;
  transaction_montant: number;
  facture_id: string | null;
  notes: string | null;
}

interface Rapprochement {
  transaction: TransactionBancaire;
  facture: FactureMatch | null;
  score: number; // 0-100, score de confiance du match
  status: "matched" | "unmatched" | "uncertain";
  isManual?: boolean;
  manualId?: string;
  notes?: string | null;
}

interface FichierRapprochement {
  id: string;
  numero_rapprochement: string;
  date_debut: string;
  date_fin: string;
  fichier_data: {
    transactions: TransactionBancaire[];
    rapprochements: Rapprochement[];
    rapprochementsManuels: RapprochementManuel[];
  };
  statut: string;
  total_lignes: number;
  lignes_rapprochees: number;
  created_at: string;
  created_by: string;
}

export default function RapprochementBancaire() {
  const [activeTab, setActiveTab] = useState<"en_cours" | "historique">("en_cours");
  const [transactions, setTransactions] = useState<TransactionBancaire[]>([]);
  const [rapprochements, setRapprochements] = useState<Rapprochement[]>([]);
  const [loading, setLoading] = useState(false);
  const [factures, setFactures] = useState<FactureMatch[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [rapprochementsManuels, setRapprochementsManuels] = useState<RapprochementManuel[]>([]);
  const [manuelDialogOpen, setManuelDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionBancaire | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "matched" | "unmatched" | "uncertain">("all");
  const [manualStatusChanges, setManualStatusChanges] = useState<Record<string, "matched" | "unmatched" | "uncertain">>({});
  const [fichiersRapprochement, setFichiersRapprochement] = useState<FichierRapprochement[]>([]);
  const [selectedFichier, setSelectedFichier] = useState<FichierRapprochement | null>(null);
  const [historiqueStatusChanges, setHistoriqueStatusChanges] = useState<Record<string, "matched" | "unmatched" | "uncertain">>({});
  const [savingHistorique, setSavingHistorique] = useState(false);
  const [editHistoriqueDialogOpen, setEditHistoriqueDialogOpen] = useState(false);
  const [selectedHistoriqueRapprochement, setSelectedHistoriqueRapprochement] = useState<Rapprochement | null>(null);
  const [selectedHistoriqueFichierId, setSelectedHistoriqueFichierId] = useState<string>("");
  const { toast } = useToast();

  // Charger les fichiers de rapprochement validés et les factures
  useEffect(() => {
    if (activeTab === "historique") {
      loadFichiersRapprochement();
      loadFactures();
    }
  }, [activeTab]);

  const loadFactures = async () => {
    try {
      const { data: facturesData, error } = await supabase
        .from("factures")
        .select("*")
        .in("statut", ["VALIDEE", "PAYEE"]);

      if (error) throw error;

      const facturesFormatted: FactureMatch[] = (facturesData || []).map((f) => ({
        id: f.id,
        numero_facture: f.numero_facture,
        type_facture: f.type_facture as "VENTES" | "ACHATS",
        date_emission: f.date_emission,
        partenaire_nom: f.type_facture === "VENTES" ? f.destinataire_nom : f.emetteur_nom,
        total_ttc: f.total_ttc || 0,
        statut: f.statut,
        numero_rapprochement: f.numero_rapprochement,
        date_rapprochement: f.date_rapprochement,
      }));

      console.log("✅ Factures chargées pour l'historique:", facturesFormatted.length);
      setFactures(facturesFormatted);
    } catch (error) {
      console.error("Erreur chargement factures:", error);
    }
  };

  // Réinitialiser la page quand le filtre change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, activeTab]);

  const loadFichiersRapprochement = async () => {
    try {
      const { data, error } = await supabase
        .from("fichiers_rapprochement")
        .select("*")
        .eq("statut", "VALIDE")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFichiersRapprochement((data || []) as unknown as FichierRapprochement[]);
    } catch (error) {
      console.error("Erreur chargement fichiers rapprochement:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger l'historique des rapprochements",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = (transactionKey: string, newStatus: "matched" | "unmatched" | "uncertain") => {
    setManualStatusChanges(prev => ({
      ...prev,
      [transactionKey]: newStatus
    }));

    // Mettre à jour le statut dans le tableau des rapprochements
    setRapprochements(prev => prev.map(r => {
      const key = `${r.transaction.date}-${r.transaction.libelle}-${r.transaction.montant}`;
      if (key === transactionKey) {
        return { ...r, status: newStatus };
      }
      return r;
    }));
  };

  const handleHistoriqueStatusChange = (fichierId: string, transactionKey: string, newStatus: "matched" | "unmatched" | "uncertain") => {
    const key = `${fichierId}-${transactionKey}`;
    setHistoriqueStatusChanges(prev => ({
      ...prev,
      [key]: newStatus
    }));

    // Mettre à jour le statut dans le fichier sélectionné
    setFichiersRapprochement(prev => prev.map(fichier => {
      if (fichier.id === fichierId && fichier.fichier_data) {
        const updatedRapprochements = fichier.fichier_data.rapprochements.map(r => {
          const rKey = `${r.transaction.date}-${r.transaction.libelle}-${r.transaction.montant}`;
          if (rKey === transactionKey) {
            return { ...r, status: newStatus };
          }
          return r;
        });
        
        return {
          ...fichier,
          fichier_data: {
            ...fichier.fichier_data,
            rapprochements: updatedRapprochements
          }
        };
      }
      return fichier;
    }));

    // Mettre à jour selectedFichier si c'est celui modifié
    if (selectedFichier?.id === fichierId) {
      setSelectedFichier(prev => {
        if (!prev || !prev.fichier_data) return prev;
        const updatedRapprochements = prev.fichier_data.rapprochements.map(r => {
          const rKey = `${r.transaction.date}-${r.transaction.libelle}-${r.transaction.montant}`;
          if (rKey === transactionKey) {
            return { ...r, status: newStatus };
          }
          return r;
        });
        
        return {
          ...prev,
          fichier_data: {
            ...prev.fichier_data,
            rapprochements: updatedRapprochements
          }
        };
      });
    }
  };

  const handleSaveHistoriqueChanges = async () => {
    if (!selectedFichier) return;
    
    setSavingHistorique(true);
    
    try {
      // Recalculer le nombre de lignes rapprochées
      const lignesRapprochees = selectedFichier.fichier_data.rapprochements.filter(
        r => r.status === "matched"
      ).length;

      const { error } = await supabase
        .from("fichiers_rapprochement")
        .update({
          fichier_data: selectedFichier.fichier_data as any,
          lignes_rapprochees: lignesRapprochees,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedFichier.id);

      if (error) throw error;

      toast({
        title: "Modifications enregistrées",
        description: "Les statuts ont été mis à jour avec succès",
      });

      // Nettoyer les changements en attente pour ce fichier
      setHistoriqueStatusChanges(prev => {
        const newChanges = { ...prev };
        Object.keys(newChanges).forEach(key => {
          if (key.startsWith(`${selectedFichier.id}-`)) {
            delete newChanges[key];
          }
        });
        return newChanges;
      });

      // Recharger les fichiers
      await loadFichiersRapprochement();
      
    } catch (error) {
      console.error("Erreur:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les modifications",
        variant: "destructive",
      });
    } finally {
      setSavingHistorique(false);
    }
  };

  const hasHistoriqueChanges = (fichierId: string) => {
    return Object.keys(historiqueStatusChanges).some(key => key.startsWith(`${fichierId}-`));
  };

  const getTransactionKey = (transaction: TransactionBancaire) => {
    return `${transaction.date}-${transaction.libelle}-${transaction.montant}`;
  };

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

  const loadRapprochementsManuels = async () => {
    try {
      const { data, error } = await supabase
        .from("rapprochements_bancaires")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRapprochementsManuels(data || []);
    } catch (error) {
      console.error("Erreur chargement rapprochements manuels:", error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);

    try {
      // Charger les rapprochements manuels
      await loadRapprochementsManuels();

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
        numero_rapprochement: f.numero_rapprochement,
        date_rapprochement: f.date_rapprochement,
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
      // Vérifier si un rapprochement manuel existe pour cette transaction
      const manuelMatch = rapprochementsManuels.find(
        (rm) =>
          rm.transaction_date === transaction.date &&
          rm.transaction_libelle === transaction.libelle &&
          rm.transaction_montant === transaction.montant
      );

      if (manuelMatch) {
        // Rapprochement manuel trouvé
        const facture = manuelMatch.facture_id
          ? factures.find((f) => f.id === manuelMatch.facture_id) || null
          : null;

        return {
          transaction,
          facture,
          score: facture ? 100 : 0,
          status: facture ? "matched" : "unmatched",
          isManual: true,
          manualId: manuelMatch.id,
          notes: manuelMatch.notes,
        } as Rapprochement;
      }

      // Sinon, effectuer le rapprochement automatique
      let bestMatch: FactureMatch | null = null;
      let bestScore = 0;

      for (const facture of factures) {
        // Règle stricte : le montant doit correspondre exactement
        const montantTransaction = Math.abs(transaction.montant);
        const montantFacture = Math.abs(facture.total_ttc);
        const diffMontant = Math.abs(montantTransaction - montantFacture);
        
        // Si le montant ne correspond pas (tolérance 0.01€), on ignore cette facture
        if (diffMontant >= 0.01) {
          continue;
        }

        let score = 40; // Score de base pour correspondance du montant

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
        isManual: false,
      };
    });
  };

  const handleManualRapprochement = (transaction: TransactionBancaire) => {
    setSelectedTransaction(transaction);
    setManuelDialogOpen(true);
  };

  const handleManualSuccess = async () => {
    // Recharger les rapprochements manuels
    await loadRapprochementsManuels();
    
    // Recalculer les rapprochements avec les nouvelles données
    const rapprochementsResult = performMatching(transactions, factures);
    setRapprochements(rapprochementsResult);
  };

  const handleValidateRapprochement = async () => {
    if (transactions.length === 0 || rapprochements.length === 0) {
      toast({
        title: "Erreur",
        description: "Aucune donnée à valider",
        variant: "destructive",
      });
      return;
    }

    setIsValidating(true);

    try {
      // Trouver les dates min et max des transactions
      const dates = transactions.map(t => new Date(t.date));
      const dateDebut = format(new Date(Math.min(...dates.map(d => d.getTime()))), 'yyyy-MM-dd');
      const dateFin = format(new Date(Math.max(...dates.map(d => d.getTime()))), 'yyyy-MM-dd');

      // Vérifier si ces dates sont déjà rapprochées
      const { data: checkData, error: checkError } = await supabase
        .rpc('check_dates_already_reconciled', {
          p_date_debut: dateDebut,
          p_date_fin: dateFin
        });

      if (checkError) {
        console.error("Erreur lors de la vérification:", checkError);
        toast({
          title: "Erreur",
          description: "Erreur lors de la vérification des dates",
          variant: "destructive",
        });
        return;
      }

      if (checkData && checkData.length > 0 && checkData[0].is_reconciled) {
        const numeroExistant = checkData[0].numero_rapprochement;
        toast({
          title: "Dates déjà rapprochées",
          description: `Les dates du ${format(new Date(dateDebut), 'dd/MM/yyyy', { locale: fr })} au ${format(new Date(dateFin), 'dd/MM/yyyy', { locale: fr })} sont déjà rapprochées par le rapprochement ${numeroExistant}`,
          variant: "destructive",
        });
        setIsValidating(false);
        return;
      }

      // Générer le numéro de rapprochement
      const { data: numeroData, error: numeroError } = await supabase
        .rpc('get_next_rapprochement_numero');

      if (numeroError || !numeroData) {
        console.error("Erreur lors de la génération du numéro:", numeroError);
        toast({
          title: "Erreur",
          description: "Erreur lors de la génération du numéro de rapprochement",
          variant: "destructive",
        });
        return;
      }

      const numeroRapprochement = numeroData;

      // Calculer les statistiques
      const lignesRapprochees = rapprochements.filter(r => r.status === 'matched').length;

      // Enregistrer le fichier de rapprochement
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error: insertError } = await supabase
        .from('fichiers_rapprochement')
        .insert({
          numero_rapprochement: numeroRapprochement,
          date_debut: dateDebut,
          date_fin: dateFin,
          fichier_data: {
            transactions,
            rapprochements,
            rapprochementsManuels
          } as any,
          statut: 'VALIDE',
          total_lignes: transactions.length,
          lignes_rapprochees: lignesRapprochees,
          created_by: user?.id
        } as any);

      if (insertError) {
        console.error("Erreur lors de l'enregistrement:", insertError);
        toast({
          title: "Erreur",
          description: "Erreur lors de l'enregistrement du rapprochement",
          variant: "destructive",
        });
        return;
      }

      // Mettre à jour les factures rapprochées
      const facturesRapprochees = rapprochements
        .filter(r => r.status === 'matched' && r.facture?.id)
        .map(r => r.facture!.id);

      if (facturesRapprochees.length > 0) {
        const { error: updateError } = await supabase
          .from('factures')
          .update({
            numero_rapprochement: numeroRapprochement,
            date_rapprochement: new Date().toISOString()
          } as any)
          .in('id', facturesRapprochees);

        if (updateError) {
          console.error("Erreur lors de la mise à jour des factures:", updateError);
          toast({
            title: "Erreur",
            description: "Erreur lors de la mise à jour des factures",
            variant: "destructive",
          });
          return;
        }
      }

      toast({
        title: "Rapprochement validé",
        description: `Rapprochement ${numeroRapprochement} validé avec succès ! ${lignesRapprochees}/${transactions.length} lignes rapprochées. Vous pouvez continuer à travailler sur les lignes non rapprochées.`,
      });

      // Recharger les factures pour mettre à jour le statut
      const { data: facturesData, error: facturesError } = await supabase
        .from("factures")
        .select("*")
        .in("statut", ["VALIDEE", "PAYEE"]);

      if (!facturesError && facturesData) {
        const facturesFormatted: FactureMatch[] = facturesData.map((f) => ({
          id: f.id,
          numero_facture: f.numero_facture,
          type_facture: f.type_facture as "VENTES" | "ACHATS",
          date_emission: f.date_emission,
          partenaire_nom: f.type_facture === "VENTES" ? f.destinataire_nom : f.emetteur_nom,
          total_ttc: f.total_ttc || 0,
          statut: f.statut,
          numero_rapprochement: f.numero_rapprochement,
          date_rapprochement: f.date_rapprochement,
        }));
        setFactures(facturesFormatted);
        
        // Recalculer les rapprochements avec les factures mises à jour
        const rapprochementsResult = performMatching(transactions, facturesFormatted);
        setRapprochements(rapprochementsResult);
      }

    } catch (error) {
      console.error("Erreur:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
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

  // Filtrage par statut
  const filteredRapprochements = rapprochements.filter(r => {
    if (statusFilter === "all") return true;
    return r.status === statusFilter;
  });

  // Pagination
  const totalPages = Math.ceil(filteredRapprochements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRapprochements = filteredRapprochements.slice(startIndex, endIndex);

  // Statistiques par statut
  const stats = {
    all: rapprochements.length,
    matched: rapprochements.filter(r => r.status === "matched").length,
    uncertain: rapprochements.filter(r => r.status === "uncertain").length,
    unmatched: rapprochements.filter(r => r.status === "unmatched").length,
  };

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
          Affichage de {startIndex + 1} à {Math.min(endIndex, filteredRapprochements.length)} sur {filteredRapprochements.length} résultats {statusFilter !== "all" && `(${stats.all} au total)`}
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

      {/* Onglets principaux */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "en_cours" | "historique")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="en_cours" className="gap-2">
            <Clock className="h-4 w-4" />
            En cours
          </TabsTrigger>
          <TabsTrigger value="historique" className="gap-2">
            <History className="h-4 w-4" />
            Historique
          </TabsTrigger>
        </TabsList>

        {/* Contenu: En cours */}
        <TabsContent value="en_cours" className="space-y-6 mt-6">

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
              <div className="text-2xl font-bold">{stats.all}</div>
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
                  ({Math.round((stats.matched / stats.all) * 100)}%)
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
                  ({Math.round((stats.uncertain / stats.all) * 100)}%)
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
                  ({Math.round((stats.unmatched / stats.all) * 100)}%)
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle>Résultats du rapprochement</CardTitle>
                <div className="flex gap-2">
                  <Button onClick={exportResults} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exporter
                  </Button>
                  <Button 
                    onClick={handleValidateRapprochement} 
                    disabled={isValidating}
                    size="sm"
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {isValidating ? "Validation..." : "Valider"}
                  </Button>
                </div>
              </div>

              {/* Filtres par statut */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filtrer par statut :</span>
                </div>
                <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <TabsList>
                    <TabsTrigger value="all" className="gap-2">
                      Toutes
                      <Badge variant="secondary">{stats.all}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="matched" className="gap-2">
                      Rapprochées
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-200">{stats.matched}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="uncertain" className="gap-2">
                      Incertaines
                      <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">{stats.uncertain}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="unmatched" className="gap-2">
                      Non rapprochées
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-200">{stats.unmatched}</Badge>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardHeader>
          <CardContent>
              <PaginationControls />
              <div className="text-sm text-muted-foreground mb-2">
                Affichage de {startIndex + 1} à {Math.min(endIndex, filteredRapprochements.length)} sur {filteredRapprochements.length} transaction(s) {statusFilter !== "all" && `(${stats.all} au total)`}
              </div>
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
                
                <div 
                  className="w-full overflow-x-auto overflow-y-auto" 
                  ref={scrollRef} 
                  onScroll={handleScroll}
                  style={{ maxHeight: '600px' }}
                >
                  <table className="w-full border-collapse" style={{ minWidth: '2000px' }}>
                    <thead className="bg-muted sticky top-0 z-10">
                      <tr className="border-b">
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground bg-muted" style={{ minWidth: '80px' }}>Statut</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground bg-muted" style={{ minWidth: '140px' }}>Date</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground bg-muted" style={{ minWidth: '350px' }}>Libellé</th>
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground bg-muted" style={{ minWidth: '140px' }}>Débit</th>
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground bg-muted" style={{ minWidth: '140px' }}>Crédit</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground bg-muted" style={{ minWidth: '200px' }}>Facture</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground bg-muted" style={{ minWidth: '200px' }}>Partenaire</th>
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground bg-muted" style={{ minWidth: '180px' }}>Montant Facture</th>
                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground bg-muted" style={{ minWidth: '120px' }}>Score</th>
                        <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground bg-muted" style={{ minWidth: '150px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                   {currentRapprochements.map((rapprochement, index) => (
                       <tr key={index} className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-2">
                            <div
                              onClick={() => {
                                const nextStatus = rapprochement.status === "matched" ? "uncertain" : rapprochement.status === "uncertain" ? "unmatched" : "matched";
                                handleStatusChange(
                                  getTransactionKey(rapprochement.transaction),
                                  nextStatus
                                );
                              }}
                              className="cursor-pointer hover:scale-110 transition-transform"
                              title={rapprochement.status === "matched" ? "Rapproché" : rapprochement.status === "uncertain" ? "Incertain" : "Non rapproché"}
                            >
                              {rapprochement.status === "matched" && <CheckCircle className="h-5 w-5 text-green-600" />}
                              {rapprochement.status === "uncertain" && <AlertCircle className="h-5 w-5 text-orange-600" />}
                              {rapprochement.status === "unmatched" && <XCircle className="h-5 w-5 text-red-600" />}
                            </div>
                            {rapprochement.isManual && (
                              <div title="Rapprochement manuel">
                                <LinkIcon className="h-3 w-3 text-blue-600" />
                              </div>
                            )}
                          </div>
                        </td>
                       <td className="p-4 align-middle">
                         {format(new Date(rapprochement.transaction.date), "dd/MM/yyyy")}
                       </td>
                       <td className="p-4 align-middle max-w-xs truncate" title={rapprochement.transaction.libelle}>
                         {rapprochement.transaction.libelle}
                       </td>
                       <td className="p-4 align-middle text-right text-red-600">
                         {rapprochement.transaction.debit > 0
                           ? new Intl.NumberFormat("fr-FR", {
                               style: "currency",
                               currency: "EUR",
                             }).format(rapprochement.transaction.debit)
                           : ""}
                       </td>
                       <td className="p-4 align-middle text-right text-green-600">
                         {rapprochement.transaction.credit > 0
                           ? new Intl.NumberFormat("fr-FR", {
                               style: "currency",
                               currency: "EUR",
                             }).format(rapprochement.transaction.credit)
                           : ""}
                       </td>
                       <td className="p-4 align-middle">
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
                       </td>
                       <td className="p-4 align-middle">
                         {rapprochement.facture?.partenaire_nom || "-"}
                       </td>
                       <td className="p-4 align-middle text-right">
                         {rapprochement.facture
                           ? new Intl.NumberFormat("fr-FR", {
                               style: "currency",
                               currency: "EUR",
                             }).format(rapprochement.facture.total_ttc)
                           : "-"}
                       </td>
                       <td className="p-4 align-middle text-right">
                         {rapprochement.isManual ? (
                           <Badge variant="outline" className="border-blue-600 text-blue-600">
                             100% (Manuel)
                           </Badge>
                         ) : (
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
                         )}
                       </td>
                       <td className="p-4 align-middle text-center">
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => handleManualRapprochement(rapprochement.transaction)}
                           className="gap-2"
                         >
                           <LinkIcon className="h-4 w-4" />
                           {rapprochement.isManual ? "Modifier" : "Rapprocher"}
                         </Button>
                       </td>
                     </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
            <PaginationControls />
          </CardContent>
        </Card>
      )}

        </TabsContent>

        {/* Contenu: Historique */}
        <TabsContent value="historique" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Rapprochements validés
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fichiersRapprochement.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Aucun rapprochement validé pour le moment</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {fichiersRapprochement.map((fichier) => (
                    <Card key={fichier.id} className="hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedFichier(selectedFichier?.id === fichier.id ? null : fichier)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Badge className="bg-primary text-primary-foreground">
                                {fichier.numero_rapprochement}
                              </Badge>
                              <span className="font-medium">
                                {format(new Date(fichier.date_debut), "dd/MM/yyyy", { locale: fr })} - {format(new Date(fichier.date_fin), "dd/MM/yyyy", { locale: fr })}
                              </span>
                            </div>
                            <div className="flex items-center gap-6 text-sm text-muted-foreground">
                              <span>{fichier.total_lignes} transactions</span>
                              <span className="flex items-center gap-1">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                {fichier.lignes_rapprochees} rapprochées
                              </span>
                              <span>
                                Créé le {format(new Date(fichier.created_at), "dd/MM/yyyy 'à' HH:mm", { locale: fr })}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className={`h-5 w-5 transition-transform ${selectedFichier?.id === fichier.id ? 'rotate-90' : ''}`} />
                        </div>

                        {/* Détails du rapprochement */}
                        {selectedFichier?.id === fichier.id && fichier.fichier_data && (
                          <div className="mt-6 pt-6 border-t">
                            <div className="mb-4 flex items-center justify-between">
                              <h4 className="font-semibold">Détails des transactions</h4>
                              <div className="flex items-center gap-2">
                                <Select
                                  value={statusFilter}
                                  onValueChange={(v) => setStatusFilter(v as any)}
                                >
                                  <SelectTrigger className="w-[180px] h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Toutes</SelectItem>
                                    <SelectItem value="matched">Rapprochées</SelectItem>
                                    <SelectItem value="uncertain">Incertaines</SelectItem>
                                    <SelectItem value="unmatched">Non rapprochées</SelectItem>
                                  </SelectContent>
                                </Select>
                                {hasHistoriqueChanges(fichier.id) && (
                                  <Button
                                    size="sm"
                                    onClick={handleSaveHistoriqueChanges}
                                    disabled={savingHistorique}
                                  >
                                    <Check className="h-4 w-4 mr-2" />
                                    {savingHistorique ? "Enregistrement..." : "Enregistrer"}
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="rounded-md border overflow-auto max-h-[500px]">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Statut</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Libellé</TableHead>
                                    <TableHead className="text-right">Débit</TableHead>
                                    <TableHead className="text-right">Crédit</TableHead>
                                    <TableHead>Facture</TableHead>
                                    <TableHead>Partenaire</TableHead>
                                    <TableHead className="text-right">Score</TableHead>
                                    <TableHead className="text-center">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                   {fichier.fichier_data.rapprochements
                                    .filter(r => statusFilter === "all" || r.status === statusFilter)
                                    .map((rapprochement, index) => (
                                      <TableRow 
                                        key={index}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => {
                                          setSelectedHistoriqueRapprochement(rapprochement);
                                          setSelectedHistoriqueFichierId(fichier.id);
                                          setEditHistoriqueDialogOpen(true);
                                        }}
                                      >
                                        <TableCell>
                                          <div
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const nextStatus = rapprochement.status === "matched" ? "uncertain" : rapprochement.status === "uncertain" ? "unmatched" : "matched";
                                              handleHistoriqueStatusChange(
                                                fichier.id,
                                                `${rapprochement.transaction.date}-${rapprochement.transaction.libelle}-${rapprochement.transaction.montant}`,
                                                nextStatus
                                              );
                                            }}
                                            className="cursor-pointer hover:scale-110 transition-transform inline-block"
                                            title={rapprochement.status === "matched" ? "Rapproché" : rapprochement.status === "uncertain" ? "Incertain" : "Non rapproché"}
                                          >
                                            {rapprochement.status === "matched" && <CheckCircle className="h-5 w-5 text-green-600" />}
                                            {rapprochement.status === "uncertain" && <AlertCircle className="h-5 w-5 text-orange-600" />}
                                            {rapprochement.status === "unmatched" && <XCircle className="h-5 w-5 text-red-600" />}
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          {format(new Date(rapprochement.transaction.date), "dd/MM/yyyy")}
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate">
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
                                              <span className="font-medium">
                                                {rapprochement.facture.numero_facture}
                                              </span>
                                              <span className="text-xs text-muted-foreground">
                                                {rapprochement.facture.type_facture}
                                              </span>
                                            </div>
                                          ) : (
                                            "-"
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {rapprochement.facture?.partenaire_nom || "-"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {rapprochement.isManual ? (
                                            <Badge variant="outline" className="border-blue-600 text-blue-600">
                                              100% (Manuel)
                                            </Badge>
                                          ) : (
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
                                          )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedHistoriqueRapprochement(rapprochement);
                                              setSelectedHistoriqueFichierId(fichier.id);
                                              setEditHistoriqueDialogOpen(true);
                                            }}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RapprochementManuelDialog
        open={manuelDialogOpen}
        onOpenChange={setManuelDialogOpen}
        transaction={selectedTransaction}
        factures={factures}
        onSuccess={handleManualSuccess}
      />

      <EditRapprochementHistoriqueDialog
        open={editHistoriqueDialogOpen}
        onOpenChange={setEditHistoriqueDialogOpen}
        rapprochement={selectedHistoriqueRapprochement}
        factures={factures}
        fichierId={selectedHistoriqueFichierId}
        onSuccess={async () => {
          await loadFichiersRapprochement();
          toast({
            title: "Succès",
            description: "Rapprochement modifié avec succès",
          });
        }}
      />
    </div>
  );
}
