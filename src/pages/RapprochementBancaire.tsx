import { useState, useRef, useEffect } from "react";
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Link as LinkIcon, Check, Filter, History, Clock, Pencil, Trash2, Settings, Plus, Edit, Trash, Power, PowerOff } from "lucide-react";
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
import EditRapprochementEnCoursDialog from "@/components/EditRapprochementEnCoursDialog";
import AddRegleRapprochementDialog from "@/components/AddRegleRapprochementDialog";
import EditRegleRapprochementDialog from "@/components/EditRegleRapprochementDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

interface TransactionBancaire {
  date: string;
  libelle: string;
  debit: number;
  credit: number;
  montant: number;
  numero_ligne?: string; // Format: RL-YYYYMMDD-XXXXX
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
  numero_ligne_rapprochement?: string;
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
  score: number;
  status: "matched" | "unmatched" | "uncertain";
  isManual?: boolean;
  manualId?: string;
  notes?: string | null;
  numero_ligne?: string; // Numéro unique de la ligne de rapprochement (format: RL-YYYYMMDD-XXXXX)
  abonnement_info?: { id: string; nom: string };
  declaration_info?: { id: string; nom: string; organisme: string };
  factureIds?: string[]; // Pour les rapprochements avec plusieurs factures
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

interface RegleRapprochement {
  id: string;
  nom: string;
  type_regle: string;
  description: string | null;
  condition_json: any;
  score_attribue: number;
  priorite: number;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export default function RapprochementBancaire() {
  const [activeTab, setActiveTab] = useState<"en_cours" | "historique" | "parametres">("en_cours");
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
  const [reglesRapprochement, setReglesRapprochement] = useState<RegleRapprochement[]>([]);
  const [addRegleDialogOpen, setAddRegleDialogOpen] = useState(false);
  const [editRegleDialogOpen, setEditRegleDialogOpen] = useState(false);
  const [selectedRegle, setSelectedRegle] = useState<RegleRapprochement | null>(null);
  const [editEnCoursDialogOpen, setEditEnCoursDialogOpen] = useState(false);
  const [selectedEnCoursRapprochement, setSelectedEnCoursRapprochement] = useState<Rapprochement | null>(null);
  const [fichierEnCoursId, setFichierEnCoursId] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const { toast } = useToast();

  // Charger le fichier EN_COURS au montage du composant
  useEffect(() => {
    loadFichierEnCours();
    loadFactures(); // Charger les factures au démarrage
  }, []);

  // Réinitialiser les états et charger les données selon l'onglet actif
  useEffect(() => {
    if (activeTab === "historique") {
      setTransactions([]);
      setRapprochements([]);
      setManualStatusChanges({});
      setStatusFilter("all");
      setCurrentPage(1);
      
      loadFichiersRapprochement();
      loadFactures();
    } else if (activeTab === "parametres") {
      loadReglesRapprochement();
    } else {
      setSelectedFichier(null);
      setHistoriqueStatusChanges({});
      // Recharger le fichier EN_COURS quand on revient sur l'onglet "En cours"
      if (activeTab === "en_cours") {
        loadFichierEnCours();
      }
    }
  }, [activeTab]);

  // Sauvegarde automatique des modifications EN_COURS
  useEffect(() => {
    if (fichierEnCoursId && transactions.length > 0 && rapprochements.length > 0) {
      const timeoutId = setTimeout(() => {
        saveFichierEnCours();
      }, 2000); // Sauvegarde après 2 secondes d'inactivité

      return () => clearTimeout(timeoutId);
    }
  }, [rapprochements, manualStatusChanges, fichierEnCoursId]);

  const loadReglesRapprochement = async () => {
    try {
      const { data, error } = await supabase
        .from("regles_rapprochement")
        .select("*")
        .order("priorite", { ascending: true });

      if (error) throw error;

      setReglesRapprochement(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement des règles:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les règles de rapprochement",
        variant: "destructive",
      });
    }
  };

  const loadFactures = async (): Promise<FactureMatch[]> => {
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
        numero_ligne_rapprochement: f.numero_ligne_rapprochement,
      }));

      console.log("✅ Factures chargées:", facturesFormatted.length);
      setFactures(facturesFormatted);
      return facturesFormatted;
    } catch (error) {
      console.error("Erreur chargement factures:", error);
      return [];
    }
  };

  // Réinitialiser la page quand le filtre change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, activeTab]);

  const loadFichierEnCours = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Charger les factures si elles ne sont pas déjà chargées
      if (factures.length === 0) {
        await loadFactures();
      }

      const { data, error } = await supabase
        .from("fichiers_rapprochement")
        .select("*")
        .eq("statut", "EN_COURS")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Erreur lors du chargement du fichier EN_COURS:", error);
        return;
      }

      if (data) {
        setFichierEnCoursId(data.id);
        
        // Restaurer les données du fichier EN_COURS
        if (data.fichier_data) {
          const fichierData = data.fichier_data as {
            transactions?: TransactionBancaire[];
            rapprochements?: Rapprochement[];
            rapprochementsManuels?: RapprochementManuel[];
          };
          
          if (fichierData.transactions) setTransactions(fichierData.transactions);
          if (fichierData.rapprochements) setRapprochements(fichierData.rapprochements);
          if (fichierData.rapprochementsManuels) setRapprochementsManuels(fichierData.rapprochementsManuels);
          
          console.log("✅ Fichier EN_COURS restauré:", data.numero_rapprochement);
          toast({
            title: "Session restaurée",
            description: `Rapprochement en cours: ${data.numero_rapprochement}`,
          });
        }
      }
    } catch (error) {
      console.error("Erreur lors du chargement du fichier EN_COURS:", error);
    }
  };

  const saveFichierEnCours = async () => {
    if (!fichierEnCoursId || autoSaving) return;

    setAutoSaving(true);
    try {
      const lignesRapprochees = rapprochements.filter(r => r.status === 'matched').length;

      const { error } = await supabase
        .from('fichiers_rapprochement')
        .update({
          fichier_data: {
            transactions,
            rapprochements,
            rapprochementsManuels
          } as any,
          lignes_rapprochees: lignesRapprochees,
          updated_at: new Date().toISOString()
        })
        .eq('id', fichierEnCoursId);

      if (error) throw error;

      console.log("💾 Sauvegarde automatique effectuée");
    } catch (error) {
      console.error("Erreur lors de la sauvegarde automatique:", error);
    } finally {
      setAutoSaving(false);
    }
  };

  const loadFichiersRapprochement = async () => {
    try {
      const { data, error } = await supabase
        .from("fichiers_rapprochement")
        .select("*")
        .eq("statut", "VALIDE")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const enrichedFiles = await Promise.all((data || []).map(async (fichier: any) => {
        // Récupérer TOUS les rapprochements bancaires de cette période
        const { data: allRapprochementsDetails } = await supabase
          .from("rapprochements_bancaires")
          .select(`
            id,
            transaction_date,
            transaction_libelle,
            transaction_montant,
            transaction_credit,
            transaction_debit,
            numero_ligne,
            notes,
            abonnement_id,
            declaration_charge_id,
            abonnements_partenaires (
              id,
              nom
            ),
            declarations_charges_sociales (
              id,
              nom,
              organisme
            )
          `)
          .gte("transaction_date", fichier.date_debut)
          .lte("transaction_date", fichier.date_fin);

        const rapprochementIds = (allRapprochementsDetails || []).map(r => r.id);

        // Récupérer les rapprochements avec factures via la table de liaison
        const { data: rapprochementsViaLiaison, error: liaisonError } = await supabase
          .from("rapprochements_factures")
          .select(`
            id,
            rapprochement_id,
            factures (
              id,
              numero_facture,
              type_facture,
              total_ttc,
              destinataire_nom,
              emetteur_nom
            )
          `)
          .in("rapprochement_id", rapprochementIds.length > 0 ? rapprochementIds : ["00000000-0000-0000-0000-000000000000"]);

        const rapprochementsManuelsFormatted: Rapprochement[] = [];

        console.log(`📊 Rapprochements bancaires trouvés pour ${fichier.numero_rapprochement}:`, allRapprochementsDetails?.length || 0);
        console.log(`📊 Rapprochements avec factures:`, rapprochementsViaLiaison?.length || 0);
        
        // Créer une Map des factures par rapprochement_id
        const facturesParRapprochement = new Map<string, any[]>();
        if (!liaisonError && rapprochementsViaLiaison) {
          rapprochementsViaLiaison.forEach((liaison: any) => {
            if (liaison.factures) {
              if (!facturesParRapprochement.has(liaison.rapprochement_id)) {
                facturesParRapprochement.set(liaison.rapprochement_id, []);
              }
              facturesParRapprochement.get(liaison.rapprochement_id)!.push(liaison.factures);
            }
          });
        } else if (liaisonError) {
          console.error("❌ Erreur chargement liaisons:", liaisonError);
        }
        
        // Traiter TOUS les rapprochements bancaires
        (allRapprochementsDetails || []).forEach((rb: any) => {
          const factures = facturesParRapprochement.get(rb.id) || [];
          
          const rapprochement: Rapprochement = {
            transaction: {
              date: rb.transaction_date,
              libelle: rb.transaction_libelle,
              montant: rb.transaction_montant,
              debit: rb.transaction_debit || 0,
              credit: rb.transaction_credit || 0,
              numero_ligne: rb.numero_ligne,
            },
            facture: null,
            factureIds: [],
            score: 100,
            status: "matched", // ⭐ Pour l'instant on garde matched par défaut pour compatibilité
            isManual: true,
            manualId: `rb_${rb.id}`,
            notes: rb.notes,
          };
          
          // ⭐ Déterminer le statut: Si pas de facture/abonnement/déclaration -> unmatched
          if (!rb.abonnement_id && !rb.declaration_charge_id && factures.length === 0) {
            rapprochement.status = "unmatched";
            rapprochement.isManual = false;
            rapprochement.score = 0;
          }
          
          // Ajouter les infos d'abonnement si présent
          if (rb.abonnement_id && rb.abonnements_partenaires) {
            rapprochement.abonnement_info = {
              id: rb.abonnements_partenaires.id,
              nom: rb.abonnements_partenaires.nom,
            };
          }
          
          // Ajouter les infos de déclaration si présent
          if (rb.declaration_charge_id && rb.declarations_charges_sociales) {
            rapprochement.declaration_info = {
              id: rb.declarations_charges_sociales.id,
              nom: rb.declarations_charges_sociales.nom,
              organisme: rb.declarations_charges_sociales.organisme,
            };
          }
          
          // Ajouter les factures si présentes
          if (factures.length === 1) {
            // Une seule facture
            rapprochement.facture = {
              id: factures[0].id,
              numero_facture: factures[0].numero_facture,
              type_facture: factures[0].type_facture,
              total_ttc: factures[0].total_ttc,
              partenaire_nom: factures[0].type_facture === "VENTES" 
                ? factures[0].destinataire_nom 
                : factures[0].emetteur_nom,
              date_emission: "",
              statut: "PAYEE",
            };
          } else if (factures.length > 1) {
            // Plusieurs factures
            rapprochement.factureIds = factures.map(f => f.id);
          }
          
          rapprochementsManuelsFormatted.push(rapprochement);
        });
        
        console.log(`✅ Total rapprochements formatés depuis DB: ${rapprochementsManuelsFormatted.length}`);
        
        const matchedCount = rapprochementsManuelsFormatted.filter((r: Rapprochement) => r.status === "matched").length;
        const unmatchedCount = rapprochementsManuelsFormatted.filter((r: Rapprochement) => r.status === "unmatched").length;
        
        console.log(`🔍 DEBUG ${fichier.numero_rapprochement}:`);
        console.log(`   - Total transactions depuis DB: ${rapprochementsManuelsFormatted.length}`);
        console.log(`   - Matched: ${matchedCount}`);
        console.log(`   - Unmatched: ${unmatchedCount}`);

        return {
          ...fichier,
          fichier_data: {
            ...fichier.fichier_data,
            transactions: fichier.fichier_data?.transactions || [],
            rapprochements: rapprochementsManuelsFormatted,
            rapprochementsManuels: fichier.fichier_data?.rapprochementsManuels || [],
          },
          lignes_rapprochees: matchedCount,
        };
      }));

      setFichiersRapprochement(enrichedFiles as unknown as FichierRapprochement[]);
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

    setRapprochements(prev => prev.map(r => {
      const key = r.transaction.numero_ligne || `${r.transaction.date}-${r.transaction.libelle}-${r.transaction.montant}`;
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

    setFichiersRapprochement(prev => prev.map(fichier => {
      if (fichier.id === fichierId && fichier.fichier_data) {
        const updatedRapprochements = fichier.fichier_data.rapprochements.map(r => {
          const rKey = r.transaction.numero_ligne || `${r.transaction.date}-${r.transaction.libelle}-${r.transaction.montant}`;
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

    if (selectedFichier?.id === fichierId) {
      setSelectedFichier(prev => {
        if (!prev || !prev.fichier_data) return prev;
        const updatedRapprochements = prev.fichier_data.rapprochements.map(r => {
          const rKey = r.transaction.numero_ligne || `${r.transaction.date}-${r.transaction.libelle}-${r.transaction.montant}`;
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

      setHistoriqueStatusChanges(prev => {
        const newChanges = { ...prev };
        Object.keys(newChanges).forEach(key => {
          if (key.startsWith(`${selectedFichier.id}-`)) {
            delete newChanges[key];
          }
        });
        return newChanges;
      });

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

  const handleDeleteRapprochement = async (fichierId: string, rapprochement: Rapprochement) => {
    if (!confirm("Êtes-vous sûr de vouloir dé-rapprocher cette transaction ? Les factures associées redeviendront disponibles.")) {
      return;
    }

    try {
      console.log("🗑️ Début suppression rapprochement:", rapprochement);
      console.log("🗑️ Type:", rapprochement.isManual ? "Manuel" : "Automatique");
      console.log("🗑️ Numéro de ligne:", rapprochement.numero_ligne || rapprochement.transaction.numero_ligne);
      
      // Trouver le rapprochement_id dans la base de données - UTILISER numero_ligne si disponible
      const { data: rapprochementData, error: fetchError } = rapprochement.transaction.numero_ligne
        ? await supabase
            .from("rapprochements_bancaires")
            .select("id")
            .eq("numero_ligne", rapprochement.transaction.numero_ligne)
            .maybeSingle()
        : await supabase
            .from("rapprochements_bancaires")
            .select("id")
            .eq("transaction_date", rapprochement.transaction.date)
            .eq("transaction_libelle", rapprochement.transaction.libelle)
            .eq("transaction_montant", rapprochement.transaction.montant)
            .maybeSingle();

      if (fetchError) throw fetchError;

      console.log("🔍 Rapprochement trouvé dans la BD:", rapprochementData);

      if (rapprochementData) {
        // Supprimer les liaisons dans rapprochements_factures
        const { error: deleteRapprochementsFacturesError } = await supabase
          .from("rapprochements_factures")
          .delete()
          .eq("rapprochement_id", rapprochementData.id);

        if (deleteRapprochementsFacturesError) throw deleteRapprochementsFacturesError;
        console.log("✅ Liaisons factures supprimées");

        // Supprimer les paiements abonnements liés
        const { error: deletePaiementsAbonnementsError } = await supabase
          .from("paiements_abonnements")
          .delete()
          .eq("rapprochement_id", rapprochementData.id);

        if (deletePaiementsAbonnementsError) throw deletePaiementsAbonnementsError;
        console.log("✅ Paiements abonnements supprimés");

        // Supprimer les paiements déclarations charges liés
        const { error: deletePaiementsDeclarationsError } = await supabase
          .from("paiements_declarations_charges")
          .delete()
          .eq("rapprochement_id", rapprochementData.id);

        if (deletePaiementsDeclarationsError) throw deletePaiementsDeclarationsError;
        console.log("✅ Paiements déclarations supprimés");

        // Supprimer le rapprochement bancaire
        const { error: deleteRapprochementError } = await supabase
          .from("rapprochements_bancaires")
          .delete()
          .eq("id", rapprochementData.id);

        if (deleteRapprochementError) throw deleteRapprochementError;
        console.log("✅ Rapprochement bancaire supprimé");
      }
      
      // Remettre la facture à l'état non rapprochée si elle existe (une seule facture)
      if (rapprochement.facture?.id) {
        const { error: updateFactureError } = await supabase
          .from("factures")
          .update({
            numero_rapprochement: null,
            numero_ligne_rapprochement: null,
            date_rapprochement: null,
            updated_at: new Date().toISOString()
          })
          .eq("id", rapprochement.facture.id);

        if (updateFactureError) {
          console.error("❌ Erreur mise à jour facture:", updateFactureError);
        } else {
          console.log("✅ Facture dé-rapprochée:", rapprochement.facture.numero_facture);
        }
      }
      
      // Remettre les factures à l'état non rapproché (plusieurs factures)
      if (rapprochement.factureIds && rapprochement.factureIds.length > 0) {
        const { error: updateFacturesError } = await supabase
          .from("factures")
          .update({
            numero_rapprochement: null,
            numero_ligne_rapprochement: null,
            date_rapprochement: null,
            updated_at: new Date().toISOString()
          })
          .in("id", rapprochement.factureIds);

        if (updateFacturesError) {
          console.error("❌ Erreur mise à jour factures:", updateFacturesError);
        } else {
          console.log(`✅ ${rapprochement.factureIds.length} factures dé-rapprochées`);
        }
      }

      // Mettre à jour le fichier de rapprochement dans la BD
      const fichier = fichiersRapprochement.find(f => f.id === fichierId);
      if (fichier && fichier.fichier_data) {
        // Garder la ligne mais changer son statut à "unmatched"
        const updatedRapprochements = fichier.fichier_data.rapprochements.map(r => {
          if (r.transaction.date === rapprochement.transaction.date &&
              r.transaction.libelle === rapprochement.transaction.libelle &&
              r.transaction.montant === rapprochement.transaction.montant) {
            return {
              ...r,
              facture: undefined,
              factureIds: undefined,
              status: "unmatched" as const,
              score: 0,
              isManual: false
            };
          }
          return r;
        });

        const newLignesRapprochees = updatedRapprochements.filter(r => r.status === "matched").length;

        const { error: updateFichierError } = await supabase
          .from("fichiers_rapprochement")
          .update({
            fichier_data: JSON.parse(JSON.stringify({
              ...fichier.fichier_data,
              rapprochements: updatedRapprochements
            })),
            lignes_rapprochees: newLignesRapprochees,
            updated_at: new Date().toISOString()
          })
          .eq("id", fichierId);

        if (updateFichierError) throw updateFichierError;
        console.log("✅ Fichier de rapprochement mis à jour - ligne dé-rapprochée");
      }

      toast({
        title: "Succès",
        description: "Le rapprochement a été supprimé avec succès",
      });

      // Recharger les fichiers et factures pour s'assurer que tout est à jour
      console.log("🔄 Rechargement des données...");
      await loadFactures();
      await loadFichiersRapprochement();
      
      // Re-sélectionner le fichier courant pour forcer la mise à jour de l'interface
      setTimeout(() => {
        setFichiersRapprochement(prev => {
          const fichierActualise = prev.find(f => f.id === fichierId);
          if (fichierActualise && selectedFichier?.id === fichierId) {
            setSelectedFichier(fichierActualise);
            console.log("✅ Fichier courant re-sélectionné");
          }
          return prev;
        });
      }, 100);
      
      console.log("✅ Dé-rapprochement terminé avec succès");

    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le rapprochement",
        variant: "destructive",
      });
    }
  };

  const hasHistoriqueChanges = (fichierId: string) => {
    return Object.keys(historiqueStatusChanges).some(key => key.startsWith(`${fichierId}-`));
  };

  const getTransactionKey = (transaction: TransactionBancaire) => {
    // UTILISER numero_ligne comme clé unique si disponible
    return transaction.numero_ligne || `${transaction.date}-${transaction.libelle}-${transaction.montant}`;
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

      // Charger toutes les factures et les récupérer directement
      const facturesChargees = await loadFactures();
      console.log("📋 Factures chargées pour rapprochement:", facturesChargees.length);

      const fileName = file.name.toLowerCase();
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

      if (isExcel) {
        // Parser Excel
        const reader = new FileReader();
        reader.onload = async (e) => {
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

              // Générer le numero_ligne unique au format RL-YYYYMMDD-RANDOM-INDEX
              const dateStr = format(date, "yyyyMMdd");
              const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
              const indexPart = (i - headerRow).toString().padStart(5, '0');
              const numero_ligne = `RL-${dateStr}-${randomPart}-${indexPart}`;

              transactionsParsed.push({
                date: format(date, "yyyy-MM-dd"),
                libelle: String(libelleValue || ""),
                debit,
                credit,
                montant,
                numero_ligne,
              });
            }

            console.log("Transactions parsed:", transactionsParsed.length); // Debug

            setTransactions(transactionsParsed);

            // Effectuer le rapprochement automatique avec les factures chargées
            console.log("🔍 Lancement du rapprochement automatique...");
            const rapprochementsResult = await performMatching(transactionsParsed, facturesChargees);
            console.log("✅ Rapprochement terminé:", rapprochementsResult.filter(r => r.status === "matched").length, "matchés sur", rapprochementsResult.length);
            setRapprochements(rapprochementsResult);

            // Créer automatiquement un fichier EN_COURS
            await createFichierEnCours(transactionsParsed, rapprochementsResult);

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
          complete: async (results) => {
            const transactionsParsed = results.data
              .map((row: any, index: number) => {
                const dateStr = row.DATE || row.date || row.Date;
                const date = parseDate(dateStr);
                if (!date) return null;

                const debit = parseAmount(row.Débit || row.DEBIT || row.debit || "0");
                const credit = parseAmount(row.Crédit || row.CREDIT || row.credit || "0");
                const montant = credit > 0 ? credit : -debit;

                // Générer le numero_ligne unique au format RL-YYYYMMDD-RANDOM-INDEX
                const dateFormatted = format(date, "yyyyMMdd");
                const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                const indexPart = (index + 1).toString().padStart(5, '0');
                const numero_ligne = `RL-${dateFormatted}-${randomPart}-${indexPart}`;

                return {
                  date: format(date, "yyyy-MM-dd"),
                  libelle: row.LIBELLE || row.libelle || row.Libelle || "",
                  debit,
                  credit,
                  montant,
                  numero_ligne,
                } as TransactionBancaire;
              })
              .filter((t): t is TransactionBancaire => t !== null);

            setTransactions(transactionsParsed);

            // Effectuer le rapprochement automatique avec les factures chargées
            console.log("🔍 Lancement du rapprochement automatique...");
            const rapprochementsResult = await performMatching(transactionsParsed, facturesChargees);
            console.log("✅ Rapprochement terminé:", rapprochementsResult.filter(r => r.status === "matched").length, "matchés sur", rapprochementsResult.length);
            setRapprochements(rapprochementsResult);

            // Créer automatiquement un fichier EN_COURS
            await createFichierEnCours(transactionsParsed, rapprochementsResult);

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

  const createFichierEnCours = async (
    transactionsParsed: TransactionBancaire[],
    rapprochementsResult: Rapprochement[]
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Supprimer l'ancien fichier EN_COURS s'il existe
      if (fichierEnCoursId) {
        await supabase
          .from('fichiers_rapprochement')
          .delete()
          .eq('id', fichierEnCoursId);
      }

      // Trouver les dates min et max
      const dates = transactionsParsed.map(t => new Date(t.date));
      const dateDebut = format(new Date(Math.min(...dates.map(d => d.getTime()))), 'yyyy-MM-dd');
      const dateFin = format(new Date(Math.max(...dates.map(d => d.getTime()))), 'yyyy-MM-dd');

      const lignesRapprochees = rapprochementsResult.filter(r => r.status === 'matched').length;

      const { data: fichier, error } = await supabase
        .from('fichiers_rapprochement')
        .insert({
          numero_rapprochement: `TEMP-${Date.now()}`,
          date_debut: dateDebut,
          date_fin: dateFin,
          fichier_data: {
            transactions: transactionsParsed,
            rapprochements: rapprochementsResult,
            rapprochementsManuels
          } as any,
          statut: 'EN_COURS',
          total_lignes: transactionsParsed.length,
          lignes_rapprochees: lignesRapprochees,
          created_by: user.id
        } as any)
        .select()
        .single();

      if (error) throw error;

      setFichierEnCoursId(fichier.id);
      console.log("✅ Fichier EN_COURS créé:", fichier.numero_rapprochement);
    } catch (error) {
      console.error("Erreur lors de la création du fichier EN_COURS:", error);
    }
  };

  const performMatching = async (
    transactions: TransactionBancaire[],
    factures: FactureMatch[]
  ): Promise<Rapprochement[]> => {
    // Charger les règles actives
    const { data: regles } = await supabase
      .from("regles_rapprochement")
      .select("*")
      .eq("actif", true)
      .order("priorite", { ascending: true });

    console.log("📋 Règles de rapprochement actives:", regles?.length || 0);

    // Charger les abonnements et déclarations pour le matching
    const { data: abonnements } = await supabase
      .from("abonnements_partenaires")
      .select("*")
      .eq("actif", true);

    const { data: declarations } = await supabase
      .from("declarations_charges_sociales")
      .select("*")
      .eq("actif", true);

    console.log("📋 Abonnements actifs:", abonnements?.length || 0);
    console.log("📋 Déclarations actives:", declarations?.length || 0);

    // Étape 1: Collecter toutes les correspondances possibles transaction-facture avec scores
    const factureMatches: Array<{
      transactionIndex: number;
      transaction: TransactionBancaire;
      facture: FactureMatch;
      score: number;
    }> = [];

    // Calculer les scores pour chaque paire transaction-facture
    transactions.forEach((transaction, transactionIndex) => {
      // Vérifier si un rapprochement manuel existe
      const manuelMatch = rapprochementsManuels.find(
        (rm) =>
          rm.transaction_date === transaction.date &&
          rm.transaction_libelle === transaction.libelle &&
          rm.transaction_montant === transaction.montant
      );

      // Ignorer les transactions avec rapprochement manuel
      if (manuelMatch) {
        return;
      }

      const libelleNormalized = normalizeString(transaction.libelle);
      const montantTransaction = Math.abs(transaction.montant);

      // Pour chaque facture, calculer le score
      for (const facture of factures) {
        const montantFacture = Math.abs(facture.total_ttc);
        const diffMontant = Math.abs(montantTransaction - montantFacture);
        
        // Si le montant ne correspond pas (tolérance 0.01€), on ignore cette facture
        if (diffMontant >= 0.01) {
          continue;
        }

        // ⭐ PRÉ-FILTRAGE : Vérifier si une règle FOURNISSEUR_MENSUEL exclut cette facture
        let factureExclue = false;

        if (regles) {
          for (const regle of regles) {
            if (regle.type_regle === "PERSONNALISEE") {
              const condition = regle.condition_json as any;
              if (condition.type_interne === "FOURNISSEUR_MENSUEL" && condition.meme_mois) {
                // Vérifier si le fournisseur correspond
                if (condition.fournisseur_nom) {
                  const fournisseurNormalized = normalizeString(condition.fournisseur_nom);
                  const partenaireNorm = normalizeString(facture.partenaire_nom);
                  const hasMatchFournisseur = libelleNormalized.includes(fournisseurNormalized) ||
                    partenaireNorm.includes(fournisseurNormalized);
                  
                  if (hasMatchFournisseur) {
                    // Vérifier le mois/année
                    const dateTrans = new Date(transaction.date);
                    const dateFact = new Date(facture.date_emission);
                    const memeAnnee = dateTrans.getFullYear() === dateFact.getFullYear();
                    const memeMois = dateTrans.getMonth() === dateFact.getMonth();
                    
                    if (!memeAnnee || !memeMois) {
                      console.log(`🚫 EXCLUSION: Facture ${facture.numero_facture} exclue car mois différent`);
                      factureExclue = true;
                      break;
                    }
                  }
                }
              }
            }
          }
        }

        // Si la facture est exclue, passer à la facture suivante
        if (factureExclue) {
          continue;
        }

        let score = 40; // Score de base pour correspondance du montant

        // Appliquer les règles personnalisées
        if (regles) {
          for (const regle of regles) {
            const condition = regle.condition_json as any;
            
            // ⭐ CAS SPÉCIAL : FOURNISSEUR_MENSUEL (traité avant le switch)
            if (regle.type_regle === "PERSONNALISEE" && condition.type_interne === "FOURNISSEUR_MENSUEL") {
              if (condition.fournisseur_nom) {
                const fournisseurNormalized = normalizeString(condition.fournisseur_nom);
                const partenaireNorm = normalizeString(facture.partenaire_nom);
                const hasMatchFournisseur = libelleNormalized.includes(fournisseurNormalized) ||
                  partenaireNorm.includes(fournisseurNormalized);
                
                if (!hasMatchFournisseur) {
                  console.log(`❌ FOURNISSEUR_MENSUEL: Fournisseur "${condition.fournisseur_nom}" non trouvé`);
                  continue;
                }
                
                console.log(`✅ FOURNISSEUR_MENSUEL: Fournisseur "${condition.fournisseur_nom}" trouvé`);
                
                const tolerance = condition.tolerance || 0.01;
                const montantMatch = diffMontant <= tolerance;
                
                if (!montantMatch) {
                  console.log(`❌ FOURNISSEUR_MENSUEL: Montant ne correspond pas (diff: ${diffMontant.toFixed(2)}€)`);
                  continue;
                }
                
                console.log(`✅ FOURNISSEUR_MENSUEL: Montant OK`);
                
                // Vérification mois/année
                if (condition.meme_mois) {
                  const dateTrans = new Date(transaction.date);
                  const dateFact = new Date(facture.date_emission);
                  
                  const memeAnnee = dateTrans.getFullYear() === dateFact.getFullYear();
                  const memeMois = dateTrans.getMonth() === dateFact.getMonth();
                  
                  if (!memeAnnee || !memeMois) {
                    console.log(`❌ FOURNISSEUR_MENSUEL: Mois/Année différent (Transaction: ${dateTrans.getMonth()+1}/${dateTrans.getFullYear()}, Facture: ${dateFact.getMonth()+1}/${dateFact.getFullYear()})`);
                    continue;
                  }
                  
                  console.log(`✅ FOURNISSEUR_MENSUEL: Même mois/année`);
                }
                
                // Bonus keywords
                let bonusScore = 0;
                if (condition.keywords && Array.isArray(condition.keywords) && condition.keywords.length > 0) {
                  const hasKeyword = condition.keywords.some((kw: string) => 
                    libelleNormalized.includes(normalizeString(kw))
                  );
                  if (hasKeyword) {
                    console.log(`✅ FOURNISSEUR_MENSUEL: Keyword trouvé (+5 bonus)`);
                    bonusScore = 5;
                  }
                }
                
                // Toutes les conditions OK - ajouter le score
                console.log(`✅ FOURNISSEUR_MENSUEL: Match complet ! Score: +${regle.score_attribue + bonusScore}`);
                score += regle.score_attribue + bonusScore;
                continue;
              }
            }
            
            // ⭐ AUTRES RÈGLES (switch standard)
            switch (regle.type_regle) {
              case "MONTANT":
                if (condition.tolerance) {
                  if (diffMontant <= condition.tolerance) {
                    score += regle.score_attribue;
                  }
                }
                break;
              
              case "DATE":
                const dateTransaction = new Date(transaction.date);
                const dateFacture = new Date(facture.date_emission);
                const diffJours = Math.abs(
                  (dateTransaction.getTime() - dateFacture.getTime()) / (1000 * 60 * 60 * 24)
                );
                if (condition.max_jours && diffJours <= condition.max_jours) {
                  score += regle.score_attribue;
                }
                break;
              
              case "LIBELLE":
                if (condition.keywords && Array.isArray(condition.keywords)) {
                  const hasKeyword = condition.keywords.some((kw: string) => 
                    libelleNormalized.includes(normalizeString(kw))
                  );
                  if (hasKeyword) {
                    score += regle.score_attribue;
                  }
                }
                break;
              
              case "PARTENAIRE":
                const partenaireNormalized = normalizeString(facture.partenaire_nom);
                if (libelleNormalized.includes(partenaireNormalized) ||
                    partenaireNormalized.split(/\s+/).some(word => word.length > 3 && libelleNormalized.includes(word))) {
                  score += regle.score_attribue;
                }
                break;
              
              case "TYPE_TRANSACTION":
                if (transaction.credit > 0 && facture.type_facture === "VENTES") {
                  score += regle.score_attribue;
                } else if (transaction.debit > 0 && facture.type_facture === "ACHATS") {
                  score += regle.score_attribue;
                }
                break;
            }
          }
        } else {
          // Règles par défaut si aucune règle n'est configurée
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
            score += 30;
          } else if (diffJours <= 3) {
            score += 25;
          } else if (diffJours <= 7) {
            score += 20;
          } else if (diffJours <= 30) {
            score += 10;
          } else if (diffJours <= 60) {
            score += 5;
          }

          // 4. Vérifier le libellé (20 points)
          const partenaireNormalized = normalizeString(facture.partenaire_nom);
          const numeroFactureNormalized = normalizeString(facture.numero_facture);

          if (libelleNormalized.includes(partenaireNormalized) || 
              partenaireNormalized.split(/\s+/).some(word => word.length > 3 && libelleNormalized.includes(word))) {
            score += 15;
          }

          if (libelleNormalized.includes(numeroFactureNormalized.replace(/[^a-z0-9]/g, ""))) {
            score += 10;
          }

          const keywords = ["facture", "fac", "fact", "invoice", "paiement", "virement", "payment"];
          if (keywords.some(kw => libelleNormalized.includes(kw))) {
            score += 5;
          }
        }

        // Ajouter cette correspondance à la liste
        factureMatches.push({
          transactionIndex,
          transaction,
          facture,
          score,
        });
      }
    });

    // Étape 2: Trier les correspondances par score décroissant
    factureMatches.sort((a, b) => b.score - a.score);

    // Étape 3: Attribuer les factures en s'assurant qu'une facture n'est utilisée qu'une fois
    const usedFactures = new Set<string>();
    const transactionsWithFacture = new Set<number>();
    const results: Rapprochement[] = [];

    factureMatches.forEach((match) => {
      // Si la facture n'a pas déjà été utilisée et la transaction n'a pas déjà de facture
      if (!usedFactures.has(match.facture.id) && !transactionsWithFacture.has(match.transactionIndex)) {
        usedFactures.add(match.facture.id);
        transactionsWithFacture.add(match.transactionIndex);

        let status: "matched" | "uncertain";
        if (match.score >= 70) {
          status = "matched";
        } else {
          status = "uncertain";
        }

        results.push({
          transaction: match.transaction,
          facture: match.facture,
          score: match.score,
          status,
          isManual: false,
        });
      }
    });

    // Étape 4: Traiter les transactions restantes (rapprochements manuels, abonnements, déclarations, non rapprochées)
    transactions.forEach((transaction, transactionIndex) => {
      // Si la transaction a déjà été rapprochée avec une facture, passer
      if (transactionsWithFacture.has(transactionIndex)) {
        return;
      }

      // Vérifier si un rapprochement manuel existe
      const manuelMatch = rapprochementsManuels.find(
        (rm) =>
          rm.transaction_date === transaction.date &&
          rm.transaction_libelle === transaction.libelle &&
          rm.transaction_montant === transaction.montant
      );

      if (manuelMatch) {
        const facture = manuelMatch.facture_id
          ? factures.find((f) => f.id === manuelMatch.facture_id) || null
          : null;

        results.push({
          transaction,
          facture,
          score: facture ? 100 : 0,
          status: facture ? "matched" : "unmatched",
          isManual: true,
          manualId: manuelMatch.id,
          notes: manuelMatch.notes,
        } as Rapprochement);
        return;
      }

      const libelleNormalized = normalizeString(transaction.libelle);

      // Appliquer les règles personnalisées pour abonnements et déclarations
      let abonnementMatch: any = false;
      let declarationMatch: any = false;
      let ruleScore = 0;

      if (regles && (abonnements || declarations)) {
        for (const regle of regles) {
          const condition = regle.condition_json as any;

          // Règle ABONNEMENT
          if (regle.type_regle === "ABONNEMENT" && abonnements) {
            const abonnementsToTest = condition.abonnement_id 
              ? abonnements.filter(a => a.id === condition.abonnement_id)
              : abonnements;

            for (const abonnement of abonnementsToTest) {
              let match = false;
              
              if (condition.keywords && Array.isArray(condition.keywords)) {
                const abonnementNormalized = normalizeString(abonnement.nom);
                const hasKeywordMatch = condition.keywords.some((kw: string) => {
                  const kwNormalized = normalizeString(kw);
                  const matchesKeyword = libelleNormalized.includes(kwNormalized);
                  const matchesName = libelleNormalized.includes(abonnementNormalized);
                  return matchesKeyword || matchesName;
                });
                match = hasKeywordMatch;
              }

              if (match && abonnement.montant_mensuel && abonnement.montant_mensuel > 0) {
                if (condition.montant_exact) {
                  const tolerance = condition.tolerance || 0.01;
                  const montantMatch = Math.abs(Math.abs(transaction.montant) - abonnement.montant_mensuel) <= tolerance;
                  match = montantMatch;
                }
              }

              if (match && regle.score_attribue > ruleScore) {
                abonnementMatch = abonnement;
                ruleScore = regle.score_attribue;
                break;
              }
            }
          }

          // Règle DECLARATION_CHARGE
          if (regle.type_regle === "DECLARATION_CHARGE" && declarations && condition.declaration_charge_id) {
            const declaration = declarations.find(d => d.id === condition.declaration_charge_id);
            if (declaration) {
              let match = false;
              
              if (condition.keywords && Array.isArray(condition.keywords)) {
                const declarationNormalized = normalizeString(declaration.nom);
                const organismeNormalized = normalizeString(declaration.organisme);
                match = condition.keywords.some((kw: string) => 
                  libelleNormalized.includes(normalizeString(kw)) ||
                  libelleNormalized.includes(declarationNormalized) ||
                  libelleNormalized.includes(organismeNormalized)
                );
              }

              if (match && condition.montant_estime && declaration.montant_estime) {
                const tolerance = condition.tolerance || 0.01;
                match = Math.abs(Math.abs(transaction.montant) - declaration.montant_estime) <= tolerance;
              }

              if (match && regle.score_attribue > ruleScore) {
                declarationMatch = declaration;
                ruleScore = regle.score_attribue;
              }
            }
          }
        }
      }

      // Si un abonnement ou une déclaration matche
      if (abonnementMatch || declarationMatch) {
        const status: "matched" | "uncertain" = ruleScore >= 70 ? "matched" : "uncertain";
        results.push({
          transaction,
          facture: null,
          score: ruleScore,
          status,
          isManual: false,
          abonnement_info: abonnementMatch ? { id: abonnementMatch.id, nom: abonnementMatch.nom } : undefined,
          declaration_info: declarationMatch ? { id: declarationMatch.id, nom: declarationMatch.nom, organisme: declarationMatch.organisme } : undefined,
        });
      } else {
        // Aucune correspondance trouvée
        results.push({
          transaction,
          facture: null,
          score: 0,
          status: "unmatched",
          isManual: false,
        });
      }
    });

    return results;
  };

  const handleManualRapprochement = (transaction: TransactionBancaire) => {
    setSelectedTransaction(transaction);
    setManuelDialogOpen(true);
  };

  const handleManualSuccess = async () => {
    // Recharger les rapprochements manuels
    await loadRapprochementsManuels();
    
    // Recalculer les rapprochements avec les nouvelles données
    const rapprochementsResult = await performMatching(transactions, factures);
    setRapprochements(rapprochementsResult);
  };

  const handleAnnulerFichierComplet = async (fichierId: string) => {
    if (!confirm("Voulez-vous vraiment annuler complètement ce rapprochement ? Toutes les transactions et associations seront supprimées.")) {
      return;
    }

    setLoading(true);

    try {
      console.log("🗑️ Annulation complète du fichier:", fichierId);

      // 1. Récupérer le fichier
      const fichier = fichiersRapprochement.find(f => f.id === fichierId);
      if (!fichier) {
        throw new Error("Fichier introuvable");
      }

      // 2. Collecter tous les IDs de rapprochements manuels et factures
      const rapprochementsManuelsIds: string[] = [];
      const liaisonFactureIds: string[] = [];
      const factureIds: string[] = [];
      
      if (fichier.fichier_data?.rapprochements) {
        fichier.fichier_data.rapprochements.forEach((r: any) => {
          if (r.isManual && r.manualId) {
            // Séparer les vrais rapprochements bancaires des liaisons de factures
            if (r.manualId.startsWith("liaison_")) {
              const liaisonId = r.manualId.replace("liaison_", "");
              liaisonFactureIds.push(liaisonId);
            } else {
              rapprochementsManuelsIds.push(r.manualId);
            }
          }
          if (r.facture?.id) {
            factureIds.push(r.facture.id);
          }
          if (r.factureIds && r.factureIds.length > 0) {
            factureIds.push(...r.factureIds);
          }
        });
      }

      console.log("📋 Rapprochements manuels (bancaires) à supprimer:", rapprochementsManuelsIds.length);
      console.log("📋 Liaisons factures à supprimer:", liaisonFactureIds.length);
      console.log("📋 Factures à réinitialiser:", factureIds.length);

      // 3. Récupérer TOUS les rapprochements bancaires créés entre les dates du fichier
      const { data: allRapprochements } = await supabase
        .from("rapprochements_bancaires")
        .select("id")
        .gte("transaction_date", fichier.date_debut)
        .lte("transaction_date", fichier.date_fin);

      const allRapprochementIds = allRapprochements?.map(r => r.id) || [];
      console.log("📋 Total rapprochements bancaires (manuels + automatiques) à supprimer:", allRapprochementIds.length);

      // 4. Supprimer les liaisons de factures directement
      if (liaisonFactureIds.length > 0) {
        const { error: liaisonError } = await supabase
          .from("rapprochements_factures")
          .delete()
          .in("id", liaisonFactureIds);

        if (liaisonError) throw liaisonError;
      }

      // 5. Supprimer tous les rapprochements bancaires et leurs associations
      if (allRapprochementIds.length > 0) {
        // Récupérer les IDs des paiements abonnements pour supprimer leurs consommations
        const { data: paiementsAbonnements } = await supabase
          .from("paiements_abonnements")
          .select("id")
          .in("rapprochement_id", allRapprochementIds);

        const paiementAbonnementIds = paiementsAbonnements?.map(p => p.id) || [];
        console.log("📋 Paiements abonnements à supprimer:", paiementAbonnementIds.length);

        // Supprimer les consommations liées aux paiements abonnements (si la table existe)
        if (paiementAbonnementIds.length > 0) {
          try {
            await (supabase as any)
              .from("abonnements_consommations")
              .delete()
              .in("paiement_id", paiementAbonnementIds);
          } catch (e) {
            console.warn("Erreur suppression consommations:", e);
          }
        }

        // Supprimer les associations de factures pour les rapprochements bancaires
        const { error: rfError } = await supabase
          .from("rapprochements_factures")
          .delete()
          .in("rapprochement_id", allRapprochementIds);

        if (rfError) throw rfError;

        // Supprimer les paiements d'abonnements
        const { error: paError } = await supabase
          .from("paiements_abonnements")
          .delete()
          .in("rapprochement_id", allRapprochementIds);

        if (paError) {
          console.error("Erreur suppression paiements abonnements:", paError);
          throw paError;
        }

        // Supprimer les paiements de déclarations de charges
        const { error: pdError } = await supabase
          .from("paiements_declarations_charges")
          .delete()
          .in("rapprochement_id", allRapprochementIds);

        if (pdError) {
          console.error("Erreur suppression paiements déclarations:", pdError);
          throw pdError;
        }

        // Supprimer les rapprochements bancaires
        const { error: deleteRbError } = await supabase
          .from("rapprochements_bancaires")
          .delete()
          .in("id", allRapprochementIds);

        if (deleteRbError) throw deleteRbError;
      }

      // 6. Réinitialiser le statut des factures
      if (factureIds.length > 0) {
        const { error: updateFacturesError } = await supabase
          .from("factures")
          .update({
            numero_rapprochement: null,
            numero_ligne_rapprochement: null,
            date_rapprochement: null
          } as any)
          .in("id", factureIds);

        if (updateFacturesError) throw updateFacturesError;
        console.log(`✅ ${factureIds.length} factures réinitialisées`);
      }

      // 7. Supprimer le fichier de rapprochement
      const { error: deleteFichierError } = await supabase
        .from("fichiers_rapprochement")
        .delete()
        .eq("id", fichierId);

      if (deleteFichierError) throw deleteFichierError;

      toast({
        title: "Succès",
        description: "Le rapprochement a été complètement annulé",
      });

      // Recharger les données
      await loadFactures();
      await loadFichiersRapprochement();
      setSelectedFichier(null);

    } catch (error) {
      console.error("Erreur lors de l'annulation:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'annuler le rapprochement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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

      const { data: { user } } = await supabase.auth.getUser();

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

      // Mettre à jour le fichier EN_COURS vers VALIDE ou créer un nouveau si pas de fichier EN_COURS
      if (fichierEnCoursId) {
        const { error: updateError } = await supabase
          .from('fichiers_rapprochement')
          .update({
            numero_rapprochement: numeroRapprochement,
            statut: 'VALIDE',
            lignes_rapprochees: lignesRapprochees,
            updated_at: new Date().toISOString()
          } as any)
          .eq('id', fichierEnCoursId);

        if (updateError) {
          console.error("Erreur lors de la mise à jour:", updateError);
          toast({
            title: "Erreur",
            description: "Erreur lors de la validation du rapprochement",
            variant: "destructive",
          });
          return;
        }
        console.log("✅ Fichier EN_COURS converti en VALIDE");
      } else {
        // Fallback: créer un nouveau fichier VALIDE
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
        console.log("✅ Nouveau fichier VALIDE créé");
      }

      // ⭐ CRITIQUE: Générer et enregistrer TOUS les rapprochements (matched ET unmatched)
      console.log("💾 Génération des numéros de ligne pour TOUTES les transactions...");
      console.log(`📊 Total transactions à sauvegarder: ${rapprochements.length}`);
      console.log(`  - Matched: ${rapprochements.filter(r => r.status === 'matched').length}`);
      console.log(`  - Uncertain: ${rapprochements.filter(r => r.status === 'uncertain').length}`);
      console.log(`  - Unmatched: ${rapprochements.filter(r => r.status === 'unmatched').length}`);
      
      // ⭐ Sauvegarder TOUTES les transactions (pas seulement matched)
      for (const r of rapprochements) {
        
        // Utiliser le numero_ligne existant ou en générer un nouveau
        let numeroLigne = r.numero_ligne || r.transaction.numero_ligne;
        
        if (!numeroLigne) {
          const { data: numeroLigneData, error: numeroLigneError } = await supabase
            .rpc('generate_numero_ligne');
          
          if (numeroLigneError || !numeroLigneData) {
            console.error("❌ Erreur génération numero_ligne:", numeroLigneError);
            continue;
          }
          numeroLigne = numeroLigneData;
        }
        
        console.log(`✅ Traitement transaction ${numeroLigne} - Statut: ${r.status}`);
        
        // Mettre à jour le rapprochement avec le numero_ligne
        r.numero_ligne = numeroLigne;
        
        // ⭐ Créer ou mettre à jour le rapprochement bancaire (pour TOUS les statuts)
        const { data: existingRapprochement } = await supabase
          .from('rapprochements_bancaires')
          .select('id')
          .eq('numero_ligne', numeroLigne)
          .maybeSingle();
        
        let rapprochementId = existingRapprochement?.id;
        
        if (!existingRapprochement) {
          const rapprochementData: any = {
            transaction_date: r.transaction.date,
            transaction_libelle: r.transaction.libelle,
            transaction_debit: r.transaction.debit,
            transaction_credit: r.transaction.credit,
            transaction_montant: r.transaction.montant,
            numero_ligne: numeroLigne,
            notes: r.notes || null,
            created_by: user?.id
          };
          
          // Ajouter abonnement_id si présent (seulement pour matched)
          if (r.status === 'matched' && r.abonnement_info?.id) {
            rapprochementData.abonnement_id = r.abonnement_info.id;
          }
          
          // Ajouter declaration_charge_id si présent (seulement pour matched)
          if (r.status === 'matched' && r.declaration_info?.id) {
            rapprochementData.declaration_charge_id = r.declaration_info.id;
          }
          
          const { data: newRapprochement, error: insertError } = await supabase
            .from('rapprochements_bancaires')
            .insert(rapprochementData)
            .select()
            .single();
          
          if (insertError) {
            console.error("❌ Erreur insertion rapprochement_bancaire:", insertError);
            console.error("❌ Données:", rapprochementData);
            toast({
              title: "Erreur d'enregistrement",
              description: `Impossible d'enregistrer la transaction ${numeroLigne}: ${insertError.message}`,
              variant: "destructive",
            });
            throw insertError; // Arrêter la validation si une erreur survient
          } else {
            rapprochementId = newRapprochement.id;
            console.log(`✅ Rapprochement bancaire créé: ${numeroLigne} (${r.status})`);
          }
        }
        
        // ⭐ Gérer les associations de factures UNIQUEMENT pour les rapprochements matched
        if (r.status === 'matched' && rapprochementId && (r.facture?.id || (r.factureIds && r.factureIds.length > 0))) {
          const factureIds = r.facture?.id ? [r.facture.id] : (r.factureIds || []);
          
          // Supprimer les anciennes associations
          await supabase
            .from('rapprochements_factures')
            .delete()
            .eq('rapprochement_id', rapprochementId);
          
          // Créer les nouvelles associations
          const facturesAssociations = factureIds.map(factureId => ({
            rapprochement_id: rapprochementId,
            facture_id: factureId,
            created_by: user?.id,
          }));
          
          const { error: associationError } = await supabase
            .from('rapprochements_factures')
            .insert(facturesAssociations);
          
          if (associationError) {
            console.error("❌ Erreur création associations factures:", associationError);
          }
        }
        
        // ⭐ Mettre à jour la ou les factures associées (UNIQUEMENT pour matched)
        if (r.status === 'matched' && r.facture?.id) {
          // Cas simple: une seule facture
          const { error: updateError } = await supabase
            .from('factures')
            .update({
              numero_rapprochement: numeroRapprochement,
              numero_ligne_rapprochement: numeroLigne,
              date_rapprochement: new Date().toISOString()
            } as any)
            .eq('id', r.facture.id);
          
          if (updateError) {
            console.error("❌ Erreur mise à jour facture:", updateError);
          } else {
            console.log(`✅ Facture ${r.facture.numero_facture} mise à jour avec numero_ligne ${numeroLigne}`);
          }
        }
        
        // ⭐ Plusieurs factures (UNIQUEMENT pour matched)
        if (r.status === 'matched' && r.factureIds && r.factureIds.length > 0) {
          // Cas multiple: plusieurs factures
          const { error: updateError } = await supabase
            .from('factures')
            .update({
              numero_rapprochement: numeroRapprochement,
              numero_ligne_rapprochement: numeroLigne,
              date_rapprochement: new Date().toISOString()
            } as any)
            .in('id', r.factureIds);
          
          if (updateError) {
            console.error("❌ Erreur mise à jour factures multiples:", updateError);
          } else {
            console.log(`✅ ${r.factureIds.length} factures mises à jour avec numero_ligne ${numeroLigne}`);
          }
        }
      }
      
      console.log("✅ Tous les rapprochements ont été sauvegardés");
      console.log(`📊 Récapitulatif final:`);
      console.log(`  - Total transactions sauvegardées: ${rapprochements.length}`);
      console.log(`  - Matched: ${rapprochements.filter(r => r.status === 'matched').length}`);
      console.log(`  - Uncertain: ${rapprochements.filter(r => r.status === 'uncertain').length}`);
      console.log(`  - Unmatched: ${rapprochements.filter(r => r.status === 'unmatched').length}`);

      // ⭐ Créer les paiements UNIQUEMENT pour les abonnements et déclarations matched
      const rapprochementsAbonnements = rapprochements.filter(r => r.status === 'matched' && r.abonnement_info);
      const rapprochementsDeclarations = rapprochements.filter(r => r.status === 'matched' && r.declaration_info);
      
      console.log(`💰 Paiements à créer:`);
      console.log(`  - Abonnements: ${rapprochementsAbonnements.length}`);
      console.log(`  - Déclarations: ${rapprochementsDeclarations.length}`);

      // Créer les paiements d'abonnements (rapprochements déjà créés dans la boucle précédente)
      if (rapprochementsAbonnements.length > 0) {
        for (const r of rapprochementsAbonnements) {
          // Récupérer le rapprochement bancaire déjà créé par numero_ligne
          const { data: rapprochementBancaire } = await supabase
            .from('rapprochements_bancaires')
            .select('id')
            .eq('numero_ligne', r.numero_ligne)
            .single();

          if (!rapprochementBancaire) {
            console.error("❌ Rapprochement bancaire introuvable pour", r.numero_ligne);
            continue;
          }

          // Créer le paiement d'abonnement avec le rapprochement_id
          const { error: paiementError } = await supabase
            .from('paiements_abonnements')
            .insert({
              abonnement_id: r.abonnement_info!.id,
              rapprochement_id: rapprochementBancaire.id,
              date_paiement: r.transaction.date,
              montant: Math.abs(r.transaction.montant),
              notes: `Paiement automatique lors du rapprochement ${numeroRapprochement}`,
              created_by: user?.id
            });

          if (paiementError) {
            console.error("❌ Erreur lors de la création du paiement abonnement:", paiementError);
          } else {
            console.log(`✅ Paiement abonnement créé pour ${r.abonnement_info!.nom}`);
          }
        }
      }

      // Créer les paiements de déclarations (rapprochements déjà créés dans la boucle précédente)
      if (rapprochementsDeclarations.length > 0) {
        for (const r of rapprochementsDeclarations) {
          // Récupérer le rapprochement bancaire déjà créé par numero_ligne
          const { data: rapprochementBancaire } = await supabase
            .from('rapprochements_bancaires')
            .select('id')
            .eq('numero_ligne', r.numero_ligne)
            .single();

          if (!rapprochementBancaire) {
            console.error("❌ Rapprochement bancaire introuvable pour", r.numero_ligne);
            continue;
          }

          // Créer le paiement de déclaration avec le rapprochement_id
          const { error: paiementError } = await supabase
            .from('paiements_declarations_charges')
            .insert({
              declaration_charge_id: r.declaration_info!.id,
              rapprochement_id: rapprochementBancaire.id,
              date_paiement: r.transaction.date,
              montant: Math.abs(r.transaction.montant),
              notes: `Paiement automatique lors du rapprochement ${numeroRapprochement}`,
              created_by: user?.id
            });

          if (paiementError) {
            console.error("❌ Erreur lors de la création du paiement déclaration:", paiementError);
          } else {
            console.log(`✅ Paiement déclaration créé pour ${r.declaration_info!.nom}`);
          }
        }
      }

      const statsFinales = {
        total: rapprochements.length,
        matched: rapprochements.filter(r => r.status === 'matched').length,
        uncertain: rapprochements.filter(r => r.status === 'uncertain').length,
        unmatched: rapprochements.filter(r => r.status === 'unmatched').length
      };

      toast({
        title: "✅ Rapprochement validé",
        description: `${numeroRapprochement} : ${statsFinales.total} transactions (${statsFinales.matched} rapprochées, ${statsFinales.unmatched} non rapprochées)`,
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
          numero_ligne_rapprochement: f.numero_ligne_rapprochement,
        }));
        setFactures(facturesFormatted);
        
        // Recalculer les rapprochements avec les factures mises à jour
        const rapprochementsResult = await performMatching(transactions, facturesFormatted);
        setRapprochements(rapprochementsResult);
      }

      // Recharger l'historique et basculer sur l'onglet historique
      await loadFichiersRapprochement();
      setTransactions([]);
      setRapprochements([]);
      setFichierEnCoursId(null);
      setActiveTab("historique");

    } catch (error) {
      console.error("❌ Erreur validation:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const exportResults = () => {
    const csv = Papa.unparse(
      rapprochements.map((r) => ({
        "Numéro de ligne": r.numero_ligne || r.transaction.numero_ligne || "",
        Date: format(new Date(r.transaction.date), "dd/MM/yyyy"),
        Libellé: r.transaction.libelle,
        Débit: r.transaction.debit || "",
        Crédit: r.transaction.credit || "",
        Statut: r.status === "matched" ? "Rapproché" : r.status === "uncertain" ? "Incertain" : "Non rapproché",
        "N° Facture": r.facture?.numero_facture || "",
        "Type Facture": r.facture?.type_facture || r.abonnement_info ? "ABONNEMENT" : r.declaration_info ? "DECLARATION" : "",
        Partenaire: r.facture?.partenaire_nom || r.abonnement_info?.nom || (r.declaration_info ? `${r.declaration_info.nom} (${r.declaration_info.organisme})` : "") || "",
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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "en_cours" | "historique" | "parametres")}>
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="en_cours" className="gap-2">
            <Clock className="h-4 w-4" />
            En cours
          </TabsTrigger>
          <TabsTrigger value="historique" className="gap-2">
            <History className="h-4 w-4" />
            Historique
          </TabsTrigger>
          <TabsTrigger value="parametres" className="gap-2">
            <Settings className="h-4 w-4" />
            Paramètres
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
                  style={{ maxHeight: 'calc(100vh - 520px)', minHeight: '600px' }}
                >
                  <table className="w-full border-collapse">
                    <thead className="bg-muted sticky top-0 z-10">
                      <tr className="border-b">
                        <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground bg-muted" style={{ width: '60px' }}>Statut</th>
                        <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground bg-muted" style={{ width: '140px' }}>N° Ligne</th>
                        <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground bg-muted" style={{ width: '90px' }}>Date</th>
                        <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground bg-muted" style={{ width: '22%' }}>Libellé</th>
                        <th className="h-12 px-2 text-right align-middle font-medium text-muted-foreground bg-muted" style={{ width: '110px' }}>Débit</th>
                        <th className="h-12 px-2 text-right align-middle font-medium text-muted-foreground bg-muted" style={{ width: '110px' }}>Crédit</th>
                        <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground bg-muted" style={{ width: '13%' }}>Facture</th>
                        <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground bg-muted" style={{ width: '15%' }}>Partenaire</th>
                        <th className="h-12 px-2 text-right align-middle font-medium text-muted-foreground bg-muted" style={{ width: '110px' }}>Mnt Fact.</th>
                        <th className="h-12 px-2 text-right align-middle font-medium text-muted-foreground bg-muted" style={{ width: '100px' }}>Score</th>
                        <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground bg-muted" style={{ width: '140px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                   {currentRapprochements.map((rapprochement, index) => (
                       <tr 
                         key={index} 
                         className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                         onClick={() => {
                           setSelectedEnCoursRapprochement(rapprochement);
                           setEditEnCoursDialogOpen(true);
                         }}
                       >
                         <td className="p-2 align-middle">
                           <div className="flex items-center gap-2">
                             <div
                               onClick={(e) => {
                                 e.stopPropagation();
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
                         <td className="p-2 align-middle">
                           <Badge variant="outline" className="font-mono text-xs">
                             {rapprochement.numero_ligne || rapprochement.transaction.numero_ligne || "N/A"}
                           </Badge>
                         </td>
                        <td className="p-2 align-middle text-xs">
                          {format(new Date(rapprochement.transaction.date), "dd/MM/yyyy")}
                        </td>
                        <td className="p-2 align-middle truncate max-w-0 text-sm" title={rapprochement.transaction.libelle}>
                          {rapprochement.transaction.libelle}
                        </td>
                        <td className="p-2 align-middle text-right text-red-600 text-sm">
                          {rapprochement.transaction.debit > 0
                            ? new Intl.NumberFormat("fr-FR", {
                                style: "currency",
                                currency: "EUR",
                              }).format(rapprochement.transaction.debit)
                            : ""}
                        </td>
                        <td className="p-2 align-middle text-right text-green-600 text-sm">
                          {rapprochement.transaction.credit > 0
                            ? new Intl.NumberFormat("fr-FR", {
                                style: "currency",
                                currency: "EUR",
                              }).format(rapprochement.transaction.credit)
                            : ""}
                        </td>
                        <td className="p-2 align-middle truncate max-w-0">
                          {rapprochement.facture ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-sm truncate">{rapprochement.facture.numero_facture}</span>
                              <span className="text-xs text-muted-foreground">
                                {rapprochement.facture.type_facture}
                              </span>
                            </div>
                          ) : rapprochement.factureIds && rapprochement.factureIds.length > 0 ? (
                            <Badge variant="outline" className="text-xs">{rapprochement.factureIds.length} fact.</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                         <td className="p-2 align-middle truncate max-w-0 text-sm" title={rapprochement.facture?.partenaire_nom || rapprochement.abonnement_info?.nom || ""}>
                           {rapprochement.facture?.partenaire_nom || 
                            rapprochement.abonnement_info?.nom || 
                            (rapprochement.declaration_info ? `${rapprochement.declaration_info.nom}` : "") ||
                            "-"}
                         </td>
                        <td className="p-2 align-middle text-right text-sm">
                          {rapprochement.facture
                            ? new Intl.NumberFormat("fr-FR", {
                                style: "currency",
                                currency: "EUR",
                              }).format(rapprochement.facture.total_ttc)
                            : "-"}
                        </td>
                        <td className="p-2 align-middle text-right">
                          {rapprochement.isManual ? (
                            <Badge variant="outline" className="border-blue-600 text-blue-600 text-xs">
                              100%
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                rapprochement.score >= 70
                                  ? "border-green-600 text-green-600"
                                  : rapprochement.score >= 40
                                  ? "border-orange-600 text-orange-600"
                                  : "border-red-600 text-red-600"
                              }`}
                            >
                              {rapprochement.score}%
                            </Badge>
                          )}
                        </td>
                        <td className="p-2 align-middle text-center">
                           <div className="flex items-center gap-1 justify-center" onClick={(e) => e.stopPropagation()}>
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleManualRapprochement(rapprochement.transaction);
                               }}
                               className="gap-1 text-xs h-7 px-2"
                             >
                               <LinkIcon className="h-3 w-3" />
                               {rapprochement.isManual ? "Mod." : "Rapp."}
                             </Button>
                             {(rapprochement.facture || rapprochement.factureIds || rapprochement.abonnement_info || rapprochement.declaration_info) && (
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   // Réinitialiser le rapprochement localement
                                   setRapprochements(prev => prev.map(r => {
                                     if (r.transaction.date === rapprochement.transaction.date &&
                                         r.transaction.libelle === rapprochement.transaction.libelle &&
                                         r.transaction.montant === rapprochement.transaction.montant) {
                                       return {
                                         ...r,
                                         facture: null,
                                         factureIds: undefined,
                                         abonnement_info: undefined,
                                         declaration_info: undefined,
                                         status: "unmatched" as const,
                                         score: 0,
                                         isManual: false,
                                         notes: null
                                       };
                                     }
                                     return r;
                                  }));
                                  toast({
                                    title: "Ligne dé-rapprochée",
                                    description: "La transaction a été dé-rapprochée localement",
                                  });
                                }}
                                 className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7"
                                 title="Dé-rapprocher"
                               >
                                 <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
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
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAnnulerFichierComplet(fichier.id);
                                  }}
                                  disabled={loading}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Annuler le rapprochement
                                </Button>
                              </div>
                            </div>
                            <div className="rounded-md border overflow-auto" style={{ maxHeight: 'calc(100vh - 520px)', minHeight: '600px' }}>
                              <table className="w-full border-collapse">
                                <thead className="bg-muted sticky top-0 z-10">
                                  <tr className="border-b">
                                    <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground bg-muted" style={{ width: '60px' }}>Statut</th>
                                    <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground bg-muted" style={{ width: '140px' }}>N° Ligne</th>
                                    <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground bg-muted" style={{ width: '90px' }}>Date</th>
                                    <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground bg-muted" style={{ width: '25%' }}>Libellé</th>
                                    <th className="h-12 px-2 text-right align-middle font-medium text-muted-foreground bg-muted" style={{ width: '110px' }}>Débit</th>
                                    <th className="h-12 px-2 text-right align-middle font-medium text-muted-foreground bg-muted" style={{ width: '110px' }}>Crédit</th>
                                    <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground bg-muted" style={{ width: '13%' }}>Facture</th>
                                    <th className="h-12 px-2 text-left align-middle font-medium text-muted-foreground bg-muted" style={{ width: '15%' }}>Partenaire</th>
                                    <th className="h-12 px-2 text-right align-middle font-medium text-muted-foreground bg-muted" style={{ width: '100px' }}>Score</th>
                                    <th className="h-12 px-2 text-center align-middle font-medium text-muted-foreground bg-muted" style={{ width: '100px' }}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                   {fichier.fichier_data.rapprochements
                                    .filter(r => statusFilter === "all" || r.status === statusFilter)
                                    .map((rapprochement, index) => (
                                      <tr 
                                        key={index}
                                        className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                                        onClick={() => {
                                          setSelectedHistoriqueRapprochement(rapprochement);
                                          setSelectedHistoriqueFichierId(fichier.id);
                                          setEditHistoriqueDialogOpen(true);
                                        }}
                                      >
                                         <td className="p-2 align-middle">
                                           <div
                                             onClick={(e) => {
                                               e.stopPropagation();
                                               const nextStatus = rapprochement.status === "matched" ? "uncertain" : rapprochement.status === "uncertain" ? "unmatched" : "matched";
                                               const transactionKey = rapprochement.transaction.numero_ligne || `${rapprochement.transaction.date}-${rapprochement.transaction.libelle}-${rapprochement.transaction.montant}`;
                                               handleHistoriqueStatusChange(
                                                 fichier.id,
                                                 transactionKey,
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
                                         </td>
                                         <td className="p-2 align-middle">
                                           <Badge variant="outline" className="font-mono text-xs">
                                             {rapprochement.numero_ligne || rapprochement.transaction.numero_ligne || "N/A"}
                                           </Badge>
                                         </td>
                                         <td className="p-2 align-middle text-xs">
                                           {format(new Date(rapprochement.transaction.date), "dd/MM/yyyy")}
                                         </td>
                                         <td className="p-2 align-middle truncate max-w-0 text-sm" title={rapprochement.transaction.libelle}>
                                           {rapprochement.transaction.libelle}
                                         </td>
                                         <td className="p-2 align-middle text-right text-red-600 text-sm">
                                           {rapprochement.transaction.debit > 0
                                             ? new Intl.NumberFormat("fr-FR", {
                                                 style: "currency",
                                                 currency: "EUR",
                                               }).format(rapprochement.transaction.debit)
                                             : ""}
                                         </td>
                                         <td className="p-2 align-middle text-right text-green-600 text-sm">
                                           {rapprochement.transaction.credit > 0
                                             ? new Intl.NumberFormat("fr-FR", {
                                                 style: "currency",
                                                 currency: "EUR",
                                               }).format(rapprochement.transaction.credit)
                                             : ""}
                                         </td>
                                         <td className="p-2 align-middle truncate max-w-0">
                                           {rapprochement.facture ? (
                                             <div className="flex flex-col">
                                               <span className="font-medium text-sm truncate">
                                                 {rapprochement.facture.numero_facture}
                                               </span>
                                               <span className="text-xs text-muted-foreground">
                                                 {rapprochement.facture.type_facture}
                                               </span>
                                             </div>
                                           ) : rapprochement.factureIds && rapprochement.factureIds.length > 0 ? (
                                             <Badge variant="outline" className="text-xs">{rapprochement.factureIds.length} fact.</Badge>
                                           ) : (
                                             "-"
                                           )}
                                         </td>
                                         <td className="p-2 align-middle truncate max-w-0 text-sm" title={rapprochement.facture?.partenaire_nom || ""}>
                                           {rapprochement.facture?.partenaire_nom || 
                                            rapprochement.abonnement_info?.nom || 
                                            (rapprochement.declaration_info ? `${rapprochement.declaration_info.nom}` : "") ||
                                            "-"}
                                         </td>
                                         <td className="p-2 align-middle text-right">
                                           {rapprochement.isManual ? (
                                             <Badge variant="outline" className="border-blue-600 text-blue-600 text-xs">
                                               100%
                                             </Badge>
                                           ) : (
                                             <Badge
                                               variant="outline"
                                               className={`text-xs ${
                                                 rapprochement.score >= 70
                                                   ? "border-green-600 text-green-600"
                                                   : rapprochement.score >= 40
                                                   ? "border-orange-600 text-orange-600"
                                                   : "border-red-600 text-red-600"
                                               }`}
                                             >
                                               {rapprochement.score}%
                                             </Badge>
                                           )}
                                         </td>
                                         <td className="p-2 align-middle text-center">
                                           <div className="flex items-center justify-center gap-1">
                                             <Button
                                               variant="ghost"
                                               size="sm"
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 setSelectedHistoriqueRapprochement(rapprochement);
                                                 setSelectedHistoriqueFichierId(fichier.id);
                                                 setEditHistoriqueDialogOpen(true);
                                               }}
                                               title="Modifier"
                                               className="h-7 w-7 p-0"
                                             >
                                               <Pencil className="h-3 w-3" />
                                             </Button>
                                             <Button
                                               variant="ghost"
                                               size="sm"
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 handleDeleteRapprochement(fichier.id, rapprochement);
                                               }}
                                               className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                                               title="Dé-rapprocher"
                                             >
                                               <Trash2 className="h-3 w-3" />
                                             </Button>
                                           </div>
                                         </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
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

        {/* Contenu: Paramètres */}
        <TabsContent value="parametres" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Règles de Rapprochement
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Gérez les règles utilisées pour le matching automatique des transactions
                  </p>
                </div>
                <Button onClick={() => setAddRegleDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Ajouter une règle
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {reglesRapprochement.length === 0 ? (
                <div className="text-center py-12">
                  <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Aucune règle configurée</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reglesRapprochement.map((regle) => (
                    <Card key={regle.id} className={!regle.actif ? "opacity-60" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Badge variant={regle.actif ? "default" : "secondary"}>
                                {regle.type_regle}
                              </Badge>
                              <h4 className="font-semibold">{regle.nom}</h4>
                              <Badge variant="outline" className="ml-auto">
                                {regle.score_attribue} points
                              </Badge>
                              <Badge variant="outline">
                                Priorité {regle.priorite}
                              </Badge>
                            </div>
                            {regle.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {regle.description}
                              </p>
                            )}
                            <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
                              {JSON.stringify(regle.condition_json, null, 2)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={regle.actif}
                                onCheckedChange={async (checked) => {
                                  try {
                                    const { error } = await supabase
                                      .from("regles_rapprochement")
                                      .update({ actif: checked })
                                      .eq("id", regle.id);

                                    if (error) throw error;

                                    toast({
                                      title: "Succès",
                                      description: `Règle ${checked ? "activée" : "désactivée"}`,
                                    });

                                    loadReglesRapprochement();
                                  } catch (error) {
                                    toast({
                                      title: "Erreur",
                                      description: "Impossible de modifier la règle",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              />
                              {regle.actif ? (
                                <Power className="h-4 w-4 text-green-600" />
                              ) : (
                                <PowerOff className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedRegle(regle);
                                setEditRegleDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (!confirm("Voulez-vous vraiment supprimer cette règle ?")) {
                                  return;
                                }

                                try {
                                  const { error } = await supabase
                                    .from("regles_rapprochement")
                                    .delete()
                                    .eq("id", regle.id);

                                  if (error) throw error;

                                  toast({
                                    title: "Succès",
                                    description: "Règle supprimée",
                                  });

                                  loadReglesRapprochement();
                                } catch (error) {
                                  toast({
                                    title: "Erreur",
                                    description: "Impossible de supprimer la règle",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section Administration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Actions d'Administration
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Actions sensibles - Utilisez avec précaution
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-semibold">Réinitialiser toutes les factures</h4>
                    <p className="text-sm text-muted-foreground">
                      Supprime tous les rapprochements de factures. Cette action ne peut pas être annulée.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      if (!confirm("⚠️ ATTENTION: Cette action va réinitialiser TOUTES les factures rapprochées.\n\nÊtes-vous absolument sûr de vouloir continuer ?")) {
                        return;
                      }

                      try {
                        setLoading(true);

                        // Réinitialiser toutes les factures
                        const { data: facturesReset, error: facturesError } = await supabase
                          .from("factures")
                          .update({
                            numero_rapprochement: null,
                            numero_ligne_rapprochement: null,
                            date_rapprochement: null,
                            updated_at: new Date().toISOString()
                          } as any)
                          .not("numero_rapprochement", "is", null)
                          .select();

                        if (facturesError) throw facturesError;

                        const nbFacturesReset = facturesReset?.length || 0;

                        toast({
                          title: "✅ Réinitialisation terminée",
                          description: `${nbFacturesReset} facture(s) ont été réinitialisées`,
                        });

                        // Recharger les données
                        await loadFactures();
                      } catch (error: any) {
                        console.error("Erreur lors de la réinitialisation:", error);
                        toast({
                          title: "Erreur",
                          description: error.message || "Impossible de réinitialiser les factures",
                          variant: "destructive",
                        });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    {loading ? "Réinitialisation..." : "Réinitialiser"}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-semibold">Supprimer tous les paiements</h4>
                    <p className="text-sm text-muted-foreground">
                      Supprime tous les paiements d'abonnements et de charges sociales. Cette action ne peut pas être annulée.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      if (!confirm("⚠️ ATTENTION: Cette action va supprimer TOUS les paiements d'abonnements et de charges sociales.\n\nÊtes-vous absolument sûr de vouloir continuer ?")) {
                        return;
                      }

                      try {
                        setLoading(true);

                        // Supprimer les consommations d'abonnements
                        try {
                          await (supabase as any)
                            .from("abonnements_consommations")
                            .delete()
                            .neq("id", "00000000-0000-0000-0000-000000000000");
                        } catch (e) {
                          console.warn("Erreur suppression consommations:", e);
                        }

                        // Supprimer tous les paiements d'abonnements
                        const { data: paiementsAbonnements, error: paError } = await supabase
                          .from("paiements_abonnements")
                          .delete()
                          .neq("id", "00000000-0000-0000-0000-000000000000")
                          .select();

                        if (paError) throw paError;

                        // Supprimer tous les paiements de déclarations de charges
                        const { data: paiementsDeclarations, error: pdError } = await supabase
                          .from("paiements_declarations_charges")
                          .delete()
                          .neq("id", "00000000-0000-0000-0000-000000000000")
                          .select();

                        if (pdError) throw pdError;

                        const nbAbonnements = paiementsAbonnements?.length || 0;
                        const nbDeclarations = paiementsDeclarations?.length || 0;

                        toast({
                          title: "✅ Suppression terminée",
                          description: `${nbAbonnements} paiement(s) d'abonnements et ${nbDeclarations} paiement(s) de charges sociales supprimés`,
                        });

                      } catch (error: any) {
                        console.error("Erreur lors de la suppression:", error);
                        toast({
                          title: "Erreur",
                          description: error.message || "Impossible de supprimer les paiements",
                          variant: "destructive",
                        });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    {loading ? "Suppression..." : "Supprimer tous les paiements"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddRegleRapprochementDialog
        open={addRegleDialogOpen}
        onOpenChange={setAddRegleDialogOpen}
        onSuccess={loadReglesRapprochement}
      />

      <EditRegleRapprochementDialog
        open={editRegleDialogOpen}
        onOpenChange={setEditRegleDialogOpen}
        onSuccess={loadReglesRapprochement}
        regle={selectedRegle}
      />

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
          await loadFactures();
          await loadFichiersRapprochement();
          setEditHistoriqueDialogOpen(false);
        }}
      />

      <EditRapprochementEnCoursDialog
        open={editEnCoursDialogOpen}
        onOpenChange={setEditEnCoursDialogOpen}
        rapprochement={selectedEnCoursRapprochement}
        factures={factures}
        isHistorique={false}
        onStatusChange={(newStatus) => {
          if (selectedEnCoursRapprochement) {
            const key = getTransactionKey(selectedEnCoursRapprochement.transaction);
            handleStatusChange(key, newStatus);
          }
        }}
        onFactureSelect={async (factureIds) => {
          if (selectedEnCoursRapprochement) {
            if (factureIds.length === 0) {
              setRapprochements(prev => prev.map(r => {
                const key = getTransactionKey(r.transaction);
                const selectedKey = getTransactionKey(selectedEnCoursRapprochement.transaction);
                if (key === selectedKey) {
                  return {
                    ...r,
                    facture: null,
                    factureIds: undefined,
                    status: "unmatched" as const,
                  };
                }
                return r;
              }));
            } else if (factureIds.length === 1) {
              const facture = factures.find(f => f.id === factureIds[0]);
              setRapprochements(prev => prev.map(r => {
                const key = getTransactionKey(r.transaction);
                const selectedKey = getTransactionKey(selectedEnCoursRapprochement.transaction);
                if (key === selectedKey) {
                  return {
                    ...r,
                    facture: facture || null,
                    status: facture ? "matched" as const : r.status,
                    factureIds: undefined,
                  };
                }
                return r;
              }));
            } else {
              setRapprochements(prev => prev.map(r => {
                const key = getTransactionKey(r.transaction);
                const selectedKey = getTransactionKey(selectedEnCoursRapprochement.transaction);
                if (key === selectedKey) {
                  return {
                    ...r,
                    facture: null,
                    factureIds: factureIds,
                    status: "matched" as const,
                    isManual: true,
                  };
                }
                return r;
              }));
            }
          }
        }}
        onNotesChange={(newNotes) => {
          if (selectedEnCoursRapprochement) {
            setRapprochements(prev => prev.map(r => {
              const key = getTransactionKey(r.transaction);
              const selectedKey = getTransactionKey(selectedEnCoursRapprochement.transaction);
              if (key === selectedKey) {
                return { ...r, notes: newNotes };
              }
              return r;
            }));
          }
        }}
        onAbonnementSelect={(abonnementId) => {
          if (selectedEnCoursRapprochement) {
            setRapprochements(prev => prev.map(r => {
              const key = getTransactionKey(r.transaction);
              const selectedKey = getTransactionKey(selectedEnCoursRapprochement.transaction);
              if (key === selectedKey) {
                return { 
                  ...r, 
                  abonnement_info: abonnementId ? { id: abonnementId, nom: "" } : undefined,
                  status: abonnementId ? "matched" as const : r.status,
                };
              }
              return r;
            }));
          }
        }}
        onDeclarationSelect={(declarationId) => {
          if (selectedEnCoursRapprochement) {
            setRapprochements(prev => prev.map(r => {
              const key = getTransactionKey(r.transaction);
              const selectedKey = getTransactionKey(selectedEnCoursRapprochement.transaction);
              if (key === selectedKey) {
                return { 
                  ...r, 
                  declaration_info: declarationId ? { id: declarationId, nom: "", organisme: "" } : undefined,
                  status: declarationId ? "matched" as const : r.status,
                };
              }
              return r;
            }));
          }
        }}
      />
    </div>
  );
}