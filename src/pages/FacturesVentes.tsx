import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, FileText, Eye, Pencil, Copy, Trash2, TrendingUp, Download, Sparkles, ArrowUpDown, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Search as SearchIcon, FileX, Link2, Link2Off } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cleanFilenameSegment, getReferenceClientForInvoice, parseStorageFileReference } from "@/lib/factures/invoiceDownloadUtils";
import AddFactureDialog from "@/components/AddFactureDialog";
import EditFactureDialog from "@/components/EditFactureDialog";
import ViewFactureDialog from "@/components/ViewFactureDialog";
import ExtractionFactureVenteDialog from "@/components/ExtractionFactureVenteDialog";
import RapprochementDetailDialog from "@/components/RapprochementDetailDialog";
import RapprochementAvoirDialog from "@/components/RapprochementAvoirDialog";
import ExportFacturesVentesDialog from "@/components/ExportFacturesVentesDialog";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface Facture {
  id: string;
  numero_facture: string;
  type_facture: 'VENTES' | 'ACHATS';
  date_emission: string;
  date_echeance: string;
  emetteur_type: string;
  emetteur_id?: string;
  emetteur_nom: string;
  emetteur_adresse?: string;
  emetteur_telephone?: string;
  emetteur_email?: string;
  destinataire_type: string;
  destinataire_id?: string;
  destinataire_nom: string;
  destinataire_adresse?: string;
  destinataire_telephone?: string;
  destinataire_email?: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  informations_paiement?: string;
  reference_societe?: string;
  statut: 'BROUILLON' | 'VALIDEE' | 'PAYEE' | 'ANNULEE';
  activite?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  lignes?: FactureLigne[];
  numero_rapprochement?: string;
  date_rapprochement?: string;
  numero_ligne_rapprochement?: string;
}

export interface FactureLigne {
  id?: string;
  facture_id?: string;
  ordre: number;
  description: string;
  quantite: number;
  prix_unitaire_ht: number;
  prix_ht: number;
  taux_tva: number;
  montant_tva?: number;
  prix_ttc?: number;
}

export default function FacturesVentes() {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(false);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [openExtractionDialog, setOpenExtractionDialog] = useState(false);
  const [openDetailRapprochementDialog, setOpenDetailRapprochementDialog] = useState(false);
  const [openRapprochementAvoirDialog, setOpenRapprochementAvoirDialog] = useState(false);
  const [selectedNumeroLigne, setSelectedNumeroLigne] = useState<string>("");
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  // Filtres par date d'échéance
  const [selectedEcheanceYear, setSelectedEcheanceYear] = useState<string>("all");
  const [selectedEcheanceMonths, setSelectedEcheanceMonths] = useState<string[]>([]);
  const [availableEcheanceYears, setAvailableEcheanceYears] = useState<string[]>([]);
  const [selectedFactureIds, setSelectedFactureIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedActivite, setSelectedActivite] = useState<string>("all");
  const [typesMission, setTypesMission] = useState<Array<{ code: string; libelle: string }>>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [stats, setStats] = useState({
    totalFactures: 0,
    totalHT: 0,
    totalTTC: 0,
    totalPayees: 0,
    totalEnAttente: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchFactures();
  }, [selectedYear, selectedMonths, selectedActivite, selectedEcheanceYear, selectedEcheanceMonths]);

  const fetchFactures = async () => {
    setLoading(true);
    try {
      // Charger les types de mission pour le filtre
      const { data: typesData } = await supabase
        .from('param_type_mission')
        .select('code, libelle')
        .eq('is_active', true)
        .order('ordre');
      
      if (typesData) {
        setTypesMission(typesData);
      }

      let query = supabase
        .from('factures')
        .select('*')
        .eq('type_facture', 'VENTES');

      // Filtrer par année et mois si sélectionné
      if (selectedYear !== "all") {
        const yearNum = parseInt(selectedYear);
        // Toujours fetcher toute l'année quand une année est sélectionnée
        const startDate = `${yearNum}-01-01`;
        const endDate = `${yearNum}-12-31`;
        query = query.gte('date_emission', startDate).lte('date_emission', endDate);
      }

      // Filtrer par activité si sélectionné
      if (selectedActivite !== "all") {
        query = query.eq('activite', selectedActivite);
      }

      const { data, error } = await query.order('date_emission', { ascending: false });

      if (error) throw error;
      
      let facturesData = (data || []).map(f => ({
        ...f,
        type_facture: f.type_facture as 'VENTES' | 'ACHATS',
        statut: f.statut as 'BROUILLON' | 'VALIDEE' | 'PAYEE' | 'ANNULEE',
      }));
      
      // Filtrer côté client par mois sélectionnés (date émission) si nécessaire
      if (selectedYear !== "all" && selectedMonths.length > 0) {
        facturesData = facturesData.filter(f => {
          if (!f.date_emission) return false;
          const month = (new Date(f.date_emission).getMonth() + 1).toString();
          return selectedMonths.includes(month);
        });
      }
      
      // Filtrer par année échéance si sélectionné
      if (selectedEcheanceYear !== "all") {
        const yearNum = parseInt(selectedEcheanceYear);
        facturesData = facturesData.filter(f => {
          if (!f.date_echeance) return false;
          const echeanceYear = new Date(f.date_echeance).getFullYear();
          return echeanceYear === yearNum;
        });
      }
      
      // Filtrer par mois échéance si sélectionné
      if (selectedEcheanceYear !== "all" && selectedEcheanceMonths.length > 0) {
        facturesData = facturesData.filter(f => {
          if (!f.date_echeance) return false;
          const month = (new Date(f.date_echeance).getMonth() + 1).toString();
          return selectedEcheanceMonths.includes(month);
        });
      }
      
      // Extraire les années disponibles pour date émission
      const years = new Set<string>();
      facturesData.forEach(f => {
        if (f.date_emission) {
          const year = new Date(f.date_emission).getFullYear().toString();
          years.add(year);
        }
      });
      setAvailableYears(Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)));
      
      // Extraire les années disponibles pour date échéance (à partir des données brutes)
      const echeanceYears = new Set<string>();
      (data || []).forEach(f => {
        if (f.date_echeance) {
          const year = new Date(f.date_echeance).getFullYear().toString();
          echeanceYears.add(year);
        }
      });
      setAvailableEcheanceYears(Array.from(echeanceYears).sort((a, b) => parseInt(b) - parseInt(a)));
      
      setFactures(facturesData);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les factures de vente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (facture: Facture) => {
    try {
      const { data: lignes, error: lignesError } = await supabase
        .from('facture_lignes')
        .select('*')
        .eq('facture_id', facture.id)
        .order('ordre');

      if (lignesError) throw lignesError;

      // Certaines factures (ex: import PDF) peuvent ne pas avoir de lignes enregistrées.
      // Dans ce cas, on crée une ligne à partir des totaux pour que la copie soit exploitable.
      const hasLignes = Array.isArray(lignes) && lignes.length > 0;
      const fallbackTauxTva = facture.total_ht && facture.total_ht !== 0
        ? Math.round(((facture.total_tva || 0) / facture.total_ht) * 100)
        : 20;
      const lignesToCopy = hasLignes
        ? lignes
        : [{
            ordre: 1,
            description: `Copie de ${facture.numero_facture}`,
            quantite: 1,
            prix_unitaire_ht: Number(facture.total_ht || 0),
            prix_ht: Number(facture.total_ht || 0),
            taux_tva: fallbackTauxTva,
            montant_tva: Number(facture.total_tva || 0),
            prix_ttc: Number(facture.total_ttc || 0),
          }];

      const newFacture = {
        ...facture,
        id: undefined,
        numero_facture: undefined,
        statut: 'BROUILLON' as const,
        date_emission: new Date().toISOString().split('T')[0],
        created_at: undefined,
        updated_at: undefined,
        lignes: lignesToCopy.map((l: any) => ({
          ...l,
          id: undefined,
          facture_id: undefined,
        }))
      };

      setSelectedFacture(newFacture as any);
      setOpenAddDialog(true);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de copier la facture",
        variant: "destructive",
      });
    }
  };

  const handleCreateAvoir = async (facture: Facture) => {
    try {
      const { data: lignes, error: lignesError } = await supabase
        .from('facture_lignes')
        .select('*')
        .eq('facture_id', facture.id)
        .order('ordre');

      if (lignesError) throw lignesError;

      // Si le destinataire_id n'est pas disponible, rechercher le client par nom
      let destinataireId = facture.destinataire_id;
      if (!destinataireId || destinataireId.trim() === '') {
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('raison_sociale', facture.destinataire_nom)
          .maybeSingle();
        
        if (clientData) {
          destinataireId = clientData.id;
        }
      }

      // Créer les lignes d'avoir
      let avoirLignes: FactureLigne[];
      
      if (lignes && lignes.length > 0) {
        // Si la facture a des lignes, les copier avec montants négatifs
        avoirLignes = lignes.map(l => ({
          description: l.description,
          quantite: l.quantite,
          ordre: l.ordre,
          taux_tva: l.taux_tva,
          prix_unitaire_ht: -Math.abs(l.prix_unitaire_ht),
          prix_ht: -Math.abs(l.prix_ht),
          prix_ttc: -Math.abs(l.prix_ttc || 0),
          montant_tva: -Math.abs(l.montant_tva || 0),
        }));
      } else {
        // Si la facture n'a pas de lignes, créer une ligne basée sur les totaux
        const tauxTva = facture.total_ht > 0 ? ((facture.total_tva || 0) / facture.total_ht) * 100 : 20;
        avoirLignes = [{
          ordre: 1,
          description: `Avoir sur facture ${facture.numero_facture}`,
          quantite: 1,
          prix_unitaire_ht: -Math.abs(facture.total_ht || 0),
          prix_ht: -Math.abs(facture.total_ht || 0),
          taux_tva: Math.round(tauxTva),
          montant_tva: -Math.abs(facture.total_tva || 0),
          prix_ttc: -Math.abs(facture.total_ttc || 0),
        }];
      }

      // Créer une facture d'avoir avec les montants négatifs
      const avoirFacture: Facture = {
        id: crypto.randomUUID(),
        numero_facture: `AVOIR-TEMP-${Date.now()}`,
        type_facture: 'VENTES',
        emetteur_type: facture.emetteur_type,
        emetteur_nom: facture.emetteur_nom,
        emetteur_adresse: facture.emetteur_adresse || '',
        emetteur_email: facture.emetteur_email || '',
        emetteur_telephone: facture.emetteur_telephone || '',
        emetteur_id: facture.emetteur_id && facture.emetteur_id.trim() !== '' ? facture.emetteur_id : undefined,
        destinataire_type: facture.destinataire_type || 'CLIENT',
        destinataire_nom: facture.destinataire_nom,
        destinataire_adresse: facture.destinataire_adresse || '',
        destinataire_email: facture.destinataire_email || '',
        destinataire_telephone: facture.destinataire_telephone || '',
        destinataire_id: destinataireId || undefined,
        reference_societe: facture.reference_societe || '',
        activite: facture.activite || 'Prestation',
        statut: 'BROUILLON' as const,
        date_emission: new Date().toISOString().split('T')[0],
        date_echeance: facture.date_echeance,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_ht: -Math.abs(facture.total_ht || 0),
        total_tva: -Math.abs(facture.total_tva || 0),
        total_ttc: -Math.abs(facture.total_ttc || 0),
        informations_paiement: `AVOIR - Facture origine: ${facture.numero_facture}\n${facture.informations_paiement || ''}`,
        lignes: avoirLignes
      };

      setSelectedFacture(avoirFacture);
      setOpenAddDialog(true);
      
      toast({
        title: "Facture d'avoir créée",
        description: `Facture d'avoir créée à partir de ${facture.numero_facture}. Vérifiez les informations avant d'enregistrer.`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de créer la facture d'avoir",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette facture ?")) return;

    try {
      const { error } = await supabase
        .from('factures')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Facture supprimée avec succès",
      });

      fetchFactures();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la facture",
        variant: "destructive",
      });
    }
  };

  const handleAutoLinkClients = async () => {
    try {
      // 1. Récupérer tous les clients
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, raison_sociale');
      
      if (clientsError) throw clientsError;
      if (!clients || clients.length === 0) {
        toast({
          title: "Aucun client",
          description: "Aucun client trouvé dans la base de données",
          variant: "destructive",
        });
        return;
      }

      // 2. Récupérer les factures de vente sans destinataire_id
      const { data: orphanFactures, error: facturesError } = await supabase
        .from('factures')
        .select('id, destinataire_nom')
        .eq('type_facture', 'VENTES')
        .is('destinataire_id', null);
      
      if (facturesError) throw facturesError;
      if (!orphanFactures || orphanFactures.length === 0) {
        toast({
          title: "Aucune facture orpheline",
          description: "Toutes les factures sont déjà rattachées à un client",
        });
        return;
      }

      // 3. Créer un map client par nom (case insensitive, trim)
      const clientMap = new Map<string, string>();
      clients.forEach(c => {
        clientMap.set(c.raison_sociale.toLowerCase().trim(), c.id);
      });

      // 4. Matcher et mettre à jour
      let linkedCount = 0;
      let notFoundNames: string[] = [];

      for (const facture of orphanFactures) {
        const normalizedName = facture.destinataire_nom?.toLowerCase().trim();
        const clientId = normalizedName ? clientMap.get(normalizedName) : null;
        
        if (clientId) {
          const { error: updateError } = await supabase
            .from('factures')
            .update({ destinataire_id: clientId })
            .eq('id', facture.id);
          
          if (!updateError) {
            linkedCount++;
          }
        } else if (facture.destinataire_nom && !notFoundNames.includes(facture.destinataire_nom)) {
          notFoundNames.push(facture.destinataire_nom);
        }
      }

      // 5. Afficher le résultat
      if (linkedCount > 0) {
        toast({
          title: "Rattachement effectué",
          description: `${linkedCount} facture(s) rattachée(s) à leur client.${notFoundNames.length > 0 ? ` ${notFoundNames.length} nom(s) non trouvé(s): ${notFoundNames.slice(0, 3).join(', ')}${notFoundNames.length > 3 ? '...' : ''}` : ''}`,
        });
        fetchFactures();
      } else {
        toast({
          title: "Aucune correspondance",
          description: `Aucun client correspondant trouvé. Noms non trouvés: ${notFoundNames.slice(0, 5).join(', ')}`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de rattacher les clients: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleDerapprochementAvoir = async (facture: Facture) => {
    if (!facture.numero_ligne_rapprochement) return;
    
    if (!confirm(`Êtes-vous sûr de vouloir annuler le rapprochement de la facture ${facture.numero_facture} avec son/ses avoir(s) associé(s) ?`)) return;

    try {
      const numeroLigne = facture.numero_ligne_rapprochement;
      
      // Trouver toutes les factures liées par ce numéro de ligne (facture + avoirs)
      const { data: facturesLiees, error: fetchError } = await supabase
        .from('factures')
        .select('id, numero_facture')
        .eq('numero_ligne_rapprochement', numeroLigne);

      if (fetchError) throw fetchError;

      if (!facturesLiees || facturesLiees.length === 0) {
        throw new Error("Aucune facture liée trouvée");
      }

      // Réinitialiser toutes les factures liées
      const { error: updateError } = await supabase
        .from('factures')
        .update({
          numero_rapprochement: null,
          numero_ligne_rapprochement: null,
          date_rapprochement: null,
          statut: 'VALIDEE',
        })
        .eq('numero_ligne_rapprochement', numeroLigne);

      if (updateError) throw updateError;

      toast({
        title: "Dérapprochement effectué",
        description: `${facturesLiees.length} document(s) ont été dérapproché(s) avec succès`,
      });

      fetchFactures();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible d'annuler le rapprochement",
        variant: "destructive",
      });
    }
  };

  const toggleFactureSelection = (factureId: string) => {
    const newSelection = new Set(selectedFactureIds);
    if (newSelection.has(factureId)) {
      newSelection.delete(factureId);
    } else {
      newSelection.add(factureId);
    }
    setSelectedFactureIds(newSelection);
  };

  const toggleAllFactures = () => {
    if (selectedFactureIds.size === factures.length) {
      setSelectedFactureIds(new Set());
    } else {
      setSelectedFactureIds(new Set(factures.map(f => f.id)));
    }
  };

  const downloadSelectedFactures = async () => {
    if (selectedFactureIds.size === 0) {
      toast({
        title: "Aucune facture sélectionnée",
        description: "Veuillez sélectionner au moins une facture à télécharger",
        variant: "destructive",
      });
      return;
    }

    setIsDownloading(true);
    let successCount = 0;
    let errorCount = 0;

    const cleanString = cleanFilenameSegment;

    for (const factureId of Array.from(selectedFactureIds)) {
      try {
        const facture = factures.find(f => f.id === factureId);
        if (!facture) throw new Error("Facture introuvable dans la liste");

        let blob: Blob;
        let extension = "pdf";

        // Priorité au fichier original si c'est une vraie référence storage, sinon fallback génération PDF
        const storageRef = parseStorageFileReference(facture.reference_societe);
        if (storageRef) {
          try {
            const { data: storageData, error: storageError } = await supabase.storage
              .from(storageRef.bucket)
              .download(storageRef.filePath);

            if (storageError || !storageData) {
              throw storageError || new Error("Aucune donnée reçue");
            }

            blob = storageData;
            extension = storageRef.extension;
          } catch (storageDownloadError) {
            console.warn(`Téléchargement du fichier original impossible pour ${facture.numero_facture}, fallback génération PDF`, storageDownloadError);

            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-facture-pdf`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ facture_id: factureId }),
              }
            );

            if (!response.ok) throw new Error('Erreur lors de la génération du PDF');
            blob = await response.blob();
          }
        } else {
          // Référence absente/invalide (ex: identifiant métier), on génère le PDF
          const { data: { session } } = await supabase.auth.getSession();
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-facture-pdf`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`,
              },
              body: JSON.stringify({ facture_id: factureId }),
            }
          );

          if (!response.ok) throw new Error('Erreur lors de la génération du PDF');
          blob = await response.blob();
        }

        const dateEmission = facture.date_emission ? new Date(facture.date_emission) : null;
        const anneeMois = dateEmission
          ? `${dateEmission.getFullYear()}${String(dateEmission.getMonth() + 1).padStart(2, "0")}`
          : "";

        const refClient = await getReferenceClientForInvoice({
          destinataire_id: facture.destinataire_id,
          destinataire_nom: facture.destinataire_nom,
        });
        const refPart = refClient ? `_${cleanString(refClient)}` : "";

        const societeNom = cleanString(facture.emetteur_nom || "Societe");
        const clientNom = cleanString(facture.destinataire_nom || "Client");
        const datePart = anneeMois ? `_${anneeMois}` : "";
        const filename = `${facture.numero_facture || factureId}_${societeNom}_${clientNom}${refPart}${datePart}.${extension}`;
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        successCount++;
        
        // Petit délai entre chaque téléchargement pour éviter de bloquer le navigateur
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Erreur lors du téléchargement de la facture ${factureId}:`, error);
        errorCount++;
      }
    }

    setIsDownloading(false);
    
    if (successCount > 0) {
      toast({
        title: "Téléchargement terminé",
        description: `${successCount} facture(s) téléchargée(s)${errorCount > 0 ? `, ${errorCount} erreur(s)` : ''}`,
      });
    } else {
      toast({
        title: "Erreur",
        description: "Impossible de télécharger les factures",
        variant: "destructive",
      });
    }
    
    setSelectedFactureIds(new Set());
  };

  const columns: ColumnDef<Facture>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={selectedFactureIds.size === factures.length && factures.length > 0}
          onCheckedChange={toggleAllFactures}
          aria-label="Tout sélectionner"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedFactureIds.has(row.original.id)}
          onCheckedChange={() => toggleFactureSelection(row.original.id)}
          aria-label="Sélectionner la ligne"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { className: "w-8" },
    },
    {
      accessorKey: "numero_facture",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-accent p-0 h-auto"
        >
          N° Facture
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-medium text-xs">{row.getValue("numero_facture")}</span>
      ),
      size: 100,
    },
    {
      accessorKey: "date_emission",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-accent"
        >
          Date émission
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const dateValue = row.getValue("date_emission");
        if (!dateValue) return <span>-</span>;
        try {
          return <span>{format(new Date(dateValue as string), "dd/MM/yyyy", { locale: fr })}</span>;
        } catch {
          return <span>-</span>;
        }
      },
    },
    {
      accessorKey: "destinataire_nom",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-accent p-0 h-auto"
        >
          Client
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="truncate block max-w-[200px]" title={row.getValue("destinataire_nom") as string}>
          {row.getValue("destinataire_nom")}
        </span>
      ),
      size: 180,
    },
    {
      accessorKey: "activite",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-accent"
        >
          Activité
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const activite = row.getValue("activite") as string;
        const typeMission = typesMission.find(t => t.code === activite);
        return (
          <span className="text-sm">
            {typeMission?.libelle || activite || '-'}
          </span>
        );
      },
    },
    {
      accessorKey: "total_ht",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-accent"
        >
          Total HT
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span>
          {new Intl.NumberFormat('fr-FR', { 
            style: 'currency', 
            currency: 'EUR' 
          }).format(row.getValue("total_ht") || 0)}
        </span>
      ),
    },
    {
      accessorKey: "total_ttc",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-accent"
        >
          Total TTC
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="font-medium">
          {new Intl.NumberFormat('fr-FR', { 
            style: 'currency', 
            currency: 'EUR' 
          }).format(row.getValue("total_ttc") || 0)}
        </span>
      ),
    },
    {
      accessorKey: "statut",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-accent"
        >
          Statut
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const statut = row.getValue("statut") as string;
        const colors = {
          BROUILLON: 'bg-gray-100 text-gray-800',
          VALIDEE: 'bg-blue-100 text-blue-800',
          PAYEE: 'bg-green-100 text-green-800',
          ANNULEE: 'bg-red-100 text-red-800',
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[statut as keyof typeof colors]}`}>
            {statut}
          </span>
        );
      },
    },
    {
      accessorKey: "numero_rapprochement",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-accent p-0 h-auto"
        >
          Rapprochement
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      sortingFn: (rowA, rowB) => {
        const a = rowA.getValue("numero_rapprochement") as string | null;
        const b = rowB.getValue("numero_rapprochement") as string | null;
        // Mettre les non-rapprochées en dernier
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        return a.localeCompare(b);
      },
      cell: ({ row }) => {
        const numero = row.getValue("numero_rapprochement") as string;
        return numero ? (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {numero}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">Non rapproché</span>
        );
      },
    },
    {
      accessorKey: "numero_ligne_rapprochement",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="hover:bg-accent p-0 h-auto"
        >
          N° Ligne
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      sortingFn: (rowA, rowB) => {
        const a = rowA.getValue("numero_ligne_rapprochement") as string | null;
        const b = rowB.getValue("numero_ligne_rapprochement") as string | null;
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        return a.localeCompare(b);
      },
      cell: ({ row }) => {
        const numeroLigne = row.getValue("numero_ligne_rapprochement") as string;
        return numeroLigne ? (
          <Badge 
            variant="outline" 
            className="font-mono cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => {
              setSelectedNumeroLigne(numeroLigne);
              setOpenDetailRapprochementDialog(true);
            }}
            title="Cliquer pour voir les détails"
          >
            {numeroLigne}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedFacture(row.original);
              setOpenViewDialog(true);
            }}
            title="Visualiser"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedFacture(row.original);
              setOpenEditDialog(true);
            }}
            title="Modifier"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCopy(row.original)}
            title="Copier"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCreateAvoir(row.original)}
            title="Créer une facture d'avoir"
            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
          >
            <FileX className="h-4 w-4" />
          </Button>
          {/* Bouton rapprochement avec avoir - visible seulement pour les factures non rapprochées et positives */}
          {!row.original.numero_ligne_rapprochement && (row.original.total_ttc || 0) > 0 && row.original.statut !== 'BROUILLON' && row.original.statut !== 'ANNULEE' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedFacture(row.original);
                setOpenRapprochementAvoirDialog(true);
              }}
              title="Rapprocher avec un avoir"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <Link2 className="h-4 w-4" />
            </Button>
          )}
          {/* Bouton dérapprochement - visible seulement pour les factures rapprochées avec un avoir (AVOIR-INT) */}
          {row.original.numero_ligne_rapprochement?.startsWith('AVOIR-INT') && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDerapprochementAvoir(row.original)}
              title="Annuler le rapprochement avec avoir"
              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            >
              <Link2Off className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(row.original.id)}
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: factures,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    autoResetPageIndex: false,
    globalFilterFn: (row, columnId, filterValue) => {
      const search = filterValue.toLowerCase();
      return (
        row.original.numero_facture?.toLowerCase().includes(search) ||
        row.original.destinataire_nom?.toLowerCase().includes(search) ||
        row.original.activite?.toLowerCase().includes(search)
      );
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      pagination,
    },
  });

  // Recalculer les stats basées sur les données filtrées du tableau
  useEffect(() => {
    const filteredRows = table.getFilteredRowModel().rows;
    const filteredData = filteredRows.map(row => row.original);
    
    const totalHT = filteredData.reduce((sum, f) => sum + (f.total_ht || 0), 0);
    const totalTTC = filteredData.reduce((sum, f) => sum + (f.total_ttc || 0), 0);
    const totalPayees = filteredData.filter(f => f.statut === 'PAYEE').length;
    const totalEnAttente = filteredData.filter(f => f.statut === 'VALIDEE').length;
    
    setStats({
      totalFactures: filteredData.length,
      totalHT,
      totalTTC,
      totalPayees,
      totalEnAttente,
    });
  }, [table.getFilteredRowModel().rows]);

  return (
    <div className="w-full px-2 py-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-green-600" />
            Factures de Vente
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos factures clients et suivez vos paiements
          </p>
        </div>
        <div className="flex gap-2">
          {selectedFactureIds.size > 0 && (
            <Button
              onClick={downloadSelectedFactures}
              disabled={isDownloading}
              variant="outline"
            >
              <Download className="mr-2 h-4 w-4" />
              {isDownloading ? 'Téléchargement...' : `Télécharger (${selectedFactureIds.size})`}
            </Button>
          )}
          <ExportFacturesVentesDialog />
          <Button 
            onClick={handleAutoLinkClients}
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
            title="Rattacher automatiquement les factures orphelines aux clients existants (match exact sur le nom)"
          >
            <Link2 className="mr-2 h-4 w-4" />
            Rattacher clients
          </Button>
          <Button 
            onClick={() => {
              console.log("🔵 Clic sur Extraire par IA - openExtractionDialog:", openExtractionDialog);
              setOpenExtractionDialog(true);
              console.log("🔵 État après setOpenExtractionDialog(true)");
            }}
            variant="outline"
            className="border-purple-600 text-purple-600 hover:bg-purple-50"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Extraire par IA
          </Button>
          <Button 
            onClick={() => {
              // Calculer la date d'émission basée sur le mois sélectionné
              let initialData: Partial<Facture> | null = null;
              
              if (selectedYear !== "all" && selectedMonths.length === 1) {
                const year = parseInt(selectedYear);
                const month = parseInt(selectedMonths[0]);
                // Dernier jour du mois sélectionné
                const lastDayOfMonth = new Date(year, month, 0);
                const dateEmission = lastDayOfMonth.toISOString().split('T')[0];
                // Date d'échéance = 30 jours après
                const dateEcheance = new Date(lastDayOfMonth);
                dateEcheance.setDate(dateEcheance.getDate() + 30);
                
                initialData = {
                  type_facture: 'VENTES',
                  date_emission: dateEmission,
                  date_echeance: dateEcheance.toISOString().split('T')[0],
                  statut: 'VALIDEE',
                } as Partial<Facture>;
              }
              
              setSelectedFacture(initialData as Facture | null);
              setOpenAddDialog(true);
            }}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="mr-2 h-4 w-4" /> Nouvelle facture de vente
          </Button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total factures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFactures}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total HT</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('fr-FR', { 
                style: 'currency', 
                currency: 'EUR',
                maximumFractionDigits: 0
              }).format(stats.totalHT)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total TTC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('fr-FR', { 
                style: 'currency', 
                currency: 'EUR',
                maximumFractionDigits: 0
              }).format(stats.totalTTC)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Payées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.totalPayees}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.totalEnAttente}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center py-4 gap-4">
        <Input
          placeholder="Rechercher par numéro ou client..."
          value={globalFilter ?? ""}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="max-w-sm"
        />
        
        <Select 
          value={selectedYear} 
          onValueChange={(value) => {
            setSelectedYear(value);
            setSelectedMonths([]);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les années</SelectItem>
            {availableYears.map(year => (
              <SelectItem key={year} value={year}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedYear !== "all" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-between">
                {selectedMonths.length === 0 
                  ? "Tous les mois" 
                  : selectedMonths.length === 12
                  ? "Tous les mois"
                  : `${selectedMonths.length} mois sélectionné${selectedMonths.length > 1 ? 's' : ''}`
                }
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px]" align="start">
              <div className="p-2 border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    const allMonths = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
                    setSelectedMonths(selectedMonths.length === 12 ? [] : allMonths);
                  }}
                >
                  {selectedMonths.length === 12 ? 'Désélectionner tous' : 'Sélectionner tous les mois'}
                </Button>
              </div>
              {[
                { value: '1', label: 'Janvier' },
                { value: '2', label: 'Février' },
                { value: '3', label: 'Mars' },
                { value: '4', label: 'Avril' },
                { value: '5', label: 'Mai' },
                { value: '6', label: 'Juin' },
                { value: '7', label: 'Juillet' },
                { value: '8', label: 'Août' },
                { value: '9', label: 'Septembre' },
                { value: '10', label: 'Octobre' },
                { value: '11', label: 'Novembre' },
                { value: '12', label: 'Décembre' },
              ].map((month) => (
                <DropdownMenuCheckboxItem
                  key={month.value}
                  checked={selectedMonths.includes(month.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedMonths([...selectedMonths, month.value].sort((a, b) => parseInt(a) - parseInt(b)));
                    } else {
                      setSelectedMonths(selectedMonths.filter(m => m !== month.value));
                    }
                  }}
                >
                  {month.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Select value={selectedActivite} onValueChange={setSelectedActivite}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Activité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les activités</SelectItem>
            {typesMission.map(type => (
              <SelectItem key={type.code} value={type.code}>
                {type.libelle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Séparateur visuel */}
        <div className="h-8 w-px bg-border mx-1" />
        
        {/* Filtres par date d'échéance */}
        <span className="text-xs text-muted-foreground whitespace-nowrap">Échéance:</span>
        <Select 
          value={selectedEcheanceYear} 
          onValueChange={(value) => {
            setSelectedEcheanceYear(value);
            setSelectedEcheanceMonths([]);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Année éch." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {availableEcheanceYears.map(year => (
              <SelectItem key={year} value={year}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedEcheanceYear !== "all" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-[180px] justify-between">
                {selectedEcheanceMonths.length === 0 
                  ? "Tous les mois" 
                  : selectedEcheanceMonths.length === 12
                  ? "Tous les mois"
                  : `${selectedEcheanceMonths.length} mois`
                }
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px]" align="start">
              <div className="p-2 border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    const allMonths = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
                    setSelectedEcheanceMonths(selectedEcheanceMonths.length === 12 ? [] : allMonths);
                  }}
                >
                  {selectedEcheanceMonths.length === 12 ? 'Désélectionner tous' : 'Sélectionner tous'}
                </Button>
              </div>
              {[
                { value: '1', label: 'Janvier' },
                { value: '2', label: 'Février' },
                { value: '3', label: 'Mars' },
                { value: '4', label: 'Avril' },
                { value: '5', label: 'Mai' },
                { value: '6', label: 'Juin' },
                { value: '7', label: 'Juillet' },
                { value: '8', label: 'Août' },
                { value: '9', label: 'Septembre' },
                { value: '10', label: 'Octobre' },
                { value: '11', label: 'Novembre' },
                { value: '12', label: 'Décembre' },
              ].map((month) => (
                <DropdownMenuCheckboxItem
                  key={month.value}
                  checked={selectedEcheanceMonths.includes(month.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedEcheanceMonths([...selectedEcheanceMonths, month.value].sort((a, b) => parseInt(a) - parseInt(b)));
                    } else {
                      setSelectedEcheanceMonths(selectedEcheanceMonths.filter(m => m !== month.value));
                    }
                  }}
                >
                  {month.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Colonnes
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une facture..."
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Lignes par page:</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b sticky top-0 bg-background z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b transition-colors hover:bg-muted/50">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={`h-8 px-1 text-left align-middle text-xs font-medium text-muted-foreground bg-background whitespace-nowrap ${(header.column.columnDef.meta as any)?.className || ""}`}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className={`px-1 py-1 align-middle text-xs ${(cell.column.columnDef.meta as any)?.className || ""}`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="h-24 text-center">
                    {loading ? "Chargement..." : "Aucune facture de vente trouvée"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between py-4">
        <div className="text-sm text-muted-foreground">
          Affichage de {table.getFilteredRowModel().rows.length > 0 ? table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1 : 0} à {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} sur {table.getFilteredRowModel().rows.length} résultats
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            Page {table.getPageCount() > 0 ? table.getState().pagination.pageIndex + 1 : 0} sur {table.getPageCount()}
          </span>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => table.nextPage()} 
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AddFactureDialog 
        open={openAddDialog} 
        onOpenChange={setOpenAddDialog}
        onSuccess={fetchFactures}
        initialData={selectedFacture}
      />

      <ExtractionFactureVenteDialog
        open={openExtractionDialog}
        onOpenChange={setOpenExtractionDialog}
        onSuccess={fetchFactures}
      />
      
      {selectedFacture && (
        <>
          <EditFactureDialog
            open={openEditDialog}
            onOpenChange={setOpenEditDialog}
            facture={selectedFacture}
            onSuccess={fetchFactures}
          />
          
          <ViewFactureDialog
            open={openViewDialog}
            onOpenChange={setOpenViewDialog}
            facture={selectedFacture}
          />

          <RapprochementAvoirDialog
            open={openRapprochementAvoirDialog}
            onOpenChange={setOpenRapprochementAvoirDialog}
            facture={selectedFacture}
            onSuccess={fetchFactures}
          />
        </>
      )}

      {selectedNumeroLigne && (
        <RapprochementDetailDialog
          open={openDetailRapprochementDialog}
          onOpenChange={setOpenDetailRapprochementDialog}
          numeroLigne={selectedNumeroLigne}
        />
      )}
    </div>
  );
}