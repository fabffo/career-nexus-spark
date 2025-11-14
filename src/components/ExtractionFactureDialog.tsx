import { useState } from "react";
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Settings,
  Trash2,
  Eye,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FactureData {
  fournisseur: string | null;
  numero_facture: string | null;
  libelle: string | null;
  montant_ht: number | null;
  montant_ttc: number | null;
  montant_tva: number | null;
  date_facture: string | null;
}

interface FactureExtraite {
  id: string;
  fichier: string;
  fileObject: File;
  donnees: FactureData;
  valide: boolean;
  tokens?: { input: number; output: number };
  cout_estime?: number;
  erreur?: string;
}

interface ExtractionFactureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
interface ExtractionFactureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ========== AJOUTEZ CE BLOC ICI ==========
// SYSTÈME DE NORMALISATION DES FOURNISSEURS
const FOURNISSEURS_REGLES = {
  // SNCF et variantes
  SNCF: ["SNCF CONNECT", "SNCF TGV", "SNCF VOYAGES", "SNCF RESEAU", "SNCF Voyageurs"],

  // Adobe et variantes
  Adobe: ["Adobe Systems Software Ireland Ltd", "Adobe Inc", "Adobe Systems", "Adobe Ireland"],

  // Shell et variantes
  "STATION SHELL": [
    "STATION SHELL A10 AIRE DES PLAINES DE BEAUCE",
    "STATION SHELL SARL ROUX",
    "SHELL EXPRESS",
    "SHELL FRANCE",
  ],

  // TotalEnergies
  TotalEnergies: [
    "TotalEnergies SARL ARTSTATIONS RELAIS MARNE VERDUN",
    "TOTAL ENERGIES",
    "TOTAL ACCESS",
    "STATION TOTAL",
  ],

  // Fournisseurs
  RHSOLUTIONS: ["RHSOLUTIONS PORTAGE SALARIAL", "RH SOLUTIONS"],
  BENOME: ["SASU BENOME"],

  // Uber
  Uber: ["Uber B.V.", "Uber BV", "Uber France", "UBER EATS"],

  // Services IT
  OpenAI: ["OpenAI, LLC", "OpenAI Inc"],
  LinkedIn: ["LinkedIn Ireland Unlimited Company", "LinkedIn Corporation"],
  Indeed: ["Indeed Ireland Operations Limited", "Indeed Inc"],
  Microsoft: ["Microsoft Corporation", "Microsoft Ireland"],

  // Restaurants
  "AU BUREAU": ["AU BUREAU PUB & BRASSERIE", "AU BUREAU PUB BRASSERIE"],
  HIPPOPOTAMUS: ["HIPPOPOTAMUS RESTAURANT", "HIPPOPOTAMUS GRILL"],
  COJEAN: ["COJEAN BEAUGRENELLE", "COJEAN PARIS"],

  // Hotel
  IBIS: ["IBIS MARSEILLE EUROMEDITERRANÉE"],

  // Autres
  BOULANGER: ["BOULANGER PARIS MARAIS BHV", "BOULANGER FRANCE"],
  "Les Echos": ["LES ECHOS SAS", "LES ECHOS SA"],
};

// Fonction de normalisation intelligente
const normaliserFournisseur = (nom: string): string => {
  if (!nom) return nom;

  const nomUpper = nom.toUpperCase().trim();

  // Chercher dans les règles exactes
  for (const [nomNormalise, variantes] of Object.entries(FOURNISSEURS_REGLES)) {
    if (variantes.some((v) => nomUpper.includes(v.toUpperCase()))) {
      return nomNormalise;
    }
  }

  // Règles génériques pour nettoyer
  let nomNettoye = nom;

  // Retirer les suffixes juridiques
  nomNettoye = nomNettoye.replace(/\b(SAS|SARL|SA|EURL|Ltd|LLC|Inc|Corporation|Limited|BV|B\.V\.)\b/gi, "").trim();

  // Retirer les localisations génériques
  nomNettoye = nomNettoye.replace(/\b(PARIS|FRANCE|IRELAND|AIRE DES?|STATION|RELAIS)\s+.*/i, "").trim();

  // Si ça commence par STATION, garder le nom principal
  if (nomNettoye.match(/^STATION\s+(\w+)/i)) {
    const match = nomNettoye.match(/^STATION\s+(\w+)/i);
    return `STATION ${match![1].toUpperCase()}`;
  }

  return nomNettoye.trim();
};
// ========== FIN DU BLOC À AJOUTER ==========

const DEFAULT_PROMPT = `Extrais ces données de la facture en JSON strict :
{
  "fournisseur": "nom complet du fournisseur",
  "numero_facture": "numéro exact de la facture",
  "libelle": "description/objet de la facture",
  "montant_ht": 0.00,
  "montant_ttc": 0.00,
  "montant_tva": 0.00,
  "date_facture": "YYYY-MM-DD"
}

Règles importantes :
- Si une valeur est absente, mettre null
- Montants en nombre décimal (pas de string)
- Date au format ISO (YYYY-MM-DD)
- Numéro de facture exact avec tous les préfixes

Retourne UNIQUEMENT le JSON valide, sans markdown ni texte additionnel.`;

export default function ExtractionFactureDialog({ open, onOpenChange, onSuccess }: ExtractionFactureDialogProps) {
  const [factures, setFactures] = useState<FactureExtraite[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [currentFile, setCurrentFile] = useState("");
  const [progress, setProgress] = useState(0);
  const [selectedFacture, setSelectedFacture] = useState<FactureExtraite | null>(null);
  const [editedData, setEditedData] = useState<FactureData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;
  const { toast } = useToast();

  const extraireFacture = async (file: File): Promise<FactureExtraite> => {
    setCurrentFile(file.name);

    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          console.log("📄 Lecture du fichier:", file.name);
          const base64Data = (reader.result as string).split(",")[1];
          console.log("✓ Base64 encodé:", base64Data.length, "bytes");

          // Appel de l'edge function
          console.log("🚀 Appel edge function extraire-facture...");
          const { data, error } = await supabase.functions.invoke("extraire-facture", {
            body: {
              pdfBase64: base64Data,
              prompt: prompt,
            },
          });

          console.log("📥 Réponse reçue:", { data, error });

          if (error) {
            console.error("❌ Erreur edge function:", error);
            throw new Error(`Erreur serveur: ${error.message}`);
          }

          if (data?.error) {
            console.error("❌ Erreur dans la réponse:", data.error);
            throw new Error(data.error);
          }

          if (!data?.donnees) {
            console.error("❌ Pas de données dans la réponse");
            throw new Error("Pas de données extraites");
          }

          const donnees = data.donnees;

          // ========== AJOUTEZ CES 4 LIGNES ==========
          // Normaliser le nom du fournisseur
          if (donnees.fournisseur) {
            donnees.fournisseur = normaliserFournisseur(donnees.fournisseur);
          }
          // ==========================================

          // Validation détaillée avec génération de messages d'erreur
          const errors: string[] = [];
          const warnings: string[] = [];
          
          if (!donnees.fournisseur) errors.push("Fournisseur manquant");
          if (!donnees.montant_ttc) errors.push("Montant TTC manquant");
          if (!donnees.numero_facture) warnings.push("Numéro de facture sera généré automatiquement");
          
          const valide = errors.length === 0; // Valide si fournisseur + montant présents
          const erreur = errors.length > 0 ? errors.join(", ") : warnings.length > 0 ? warnings.join(", ") : undefined;

          console.log("✅ Extraction réussie:", { valide, donnees: Object.keys(donnees) });

          const facture: FactureExtraite = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            fichier: file.name,
            fileObject: file,
            donnees,
            valide,
            erreur,
            tokens: data.tokens,
            cout_estime: data.cout_estime,
          };

          resolve(facture);
        } catch (error) {
          console.error("❌ Erreur extraction:", error);
          reject(error);
        }
      };

      reader.onerror = () => {
        console.error("❌ Erreur lecture fichier");
        reject(new Error("Erreur lecture fichier"));
      };

      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    const nouvelles: FactureExtraite[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(Math.round(((i + 1) / files.length) * 100));

      try {
        const facture = await extraireFacture(file);
        nouvelles.push(facture);
      } catch (error) {
        nouvelles.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          fichier: file.name,
          fileObject: file,
          donnees: {
            fournisseur: null,
            numero_facture: null,
            libelle: null,
            montant_ht: null,
            montant_ttc: null,
            montant_tva: null,
            date_facture: null,
          },
          valide: false,
          erreur: error instanceof Error ? error.message : "Erreur inconnue",
        });
      }
    }

    setFactures((prev) => [...nouvelles, ...prev]);
    setIsProcessing(false);
    setCurrentFile("");
    setProgress(0);
    setCurrentPage(1); // Réinitialiser la pagination

    toast({
      title: "Extraction terminée",
      description: `${nouvelles.filter((f) => f.valide).length}/${nouvelles.length} factures extraites avec succès`,
    });
  };

  const sauvegarderFactures = async () => {
    const facturesValides = factures.filter((f) => f.valide);

    if (facturesValides.length === 0) {
      toast({
        title: "Aucune facture valide",
        description: "Veuillez extraire au moins une facture valide",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const facture of facturesValides) {
      try {
        console.log('🔄 Traitement de:', facture.fichier, facture.donnees);
        
        // 1. Upload le fichier PDF dans Supabase Storage
        const timestamp = Date.now();
        // Nettoyer le nom du fichier : supprimer espaces et caractères spéciaux
        const cleanFileName = facture.fichier
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9._-]/g, '')
          .substring(0, 100);
        const fileName = `${timestamp}_${cleanFileName}`;
        const filePath = `factures-achats/${fileName}`;

        console.log('📤 Upload du fichier vers:', filePath);
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("factures")
          .upload(filePath, facture.fileObject, {
            contentType: "application/pdf",
          });

        if (uploadError) {
          console.error('❌ Erreur upload:', uploadError);
          throw new Error(`Erreur upload: ${uploadError.message}`);
        }
        console.log('✅ Fichier uploadé:', uploadData);

        // 2. Récupérer l'utilisateur connecté
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error('❌ Erreur récupération utilisateur:', userError);
          throw new Error(`Erreur utilisateur: ${userError.message}`);
        }
        console.log('👤 Utilisateur:', user?.email);

        // 3. Générer un numéro de facture si manquant
        let numeroFacture = facture.donnees.numero_facture;
        if (!numeroFacture) {
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
          const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
          numeroFacture = `FACHAT_${dateStr}_${timeStr}`;
        }
        
        // Vérifier si le numéro existe déjà
        const { data: existingFacture } = await supabase
          .from("factures")
          .select("numero_facture")
          .eq("numero_facture", numeroFacture)
          .maybeSingle();
        
        if (existingFacture) {
          console.error('❌ Numéro de facture déjà existant:', numeroFacture);
          throw new Error(`Impossible de sauvegarder car la facture "${numeroFacture}" existe déjà`);
        }

        // 4. Préparer les données de la facture
        const factureData = {
          numero_facture: numeroFacture,
          type_facture: "ACHATS",
          date_emission: facture.donnees.date_facture || new Date().toISOString().split("T")[0],
          date_echeance: facture.donnees.date_facture || new Date().toISOString().split("T")[0],
          emetteur_type: "Fournisseur",
          emetteur_nom: facture.donnees.fournisseur || "Fournisseur inconnu",
          destinataire_type: "Entreprise",
          destinataire_nom: "Votre Entreprise",
          total_ht: facture.donnees.montant_ht || 0,
          total_tva: facture.donnees.montant_tva || 0,
          total_ttc: facture.donnees.montant_ttc || 0,
          informations_paiement: facture.donnees.libelle,
          reference_societe: filePath,
          statut: "VALIDEE",
          created_by: user?.id,
        };

        console.log('💾 Insertion de la facture:', factureData);
        
        // 5. Insérer la facture dans la base de données
        const { data: insertData, error: insertError } = await supabase
          .from("factures")
          .insert(factureData)
          .select();

        if (insertError) {
          console.error('❌ Erreur insertion:', insertError);
          throw new Error(`Erreur insertion: ${insertError.message} (${insertError.code})`);
        }
        
        console.log('✅ Facture insérée:', insertData);
        successCount++;
      } catch (error: any) {
        console.error(`❌ Erreur complète pour ${facture.fichier}:`, error);
        toast({
          title: `Erreur: ${facture.fichier}`,
          description: error.message || "Erreur inconnue",
          variant: "destructive",
        });
        errorCount++;
      }
    }

    setIsSaving(false);

    if (successCount > 0) {
      toast({
        title: "Factures sauvegardées",
        description: `${successCount} facture(s) ajoutée(s) avec succès${errorCount > 0 ? `, ${errorCount} erreur(s)` : ""}`,
      });

      // Réinitialiser et fermer
      setFactures([]);
      onSuccess();
      onOpenChange(false);
    }
    // Ne pas afficher de toast global en cas d'erreur car les messages détaillés 
    // ont déjà été affichés pour chaque facture individuellement
  };

  const handleEditFacture = (facture: FactureExtraite) => {
    setSelectedFacture(facture);
    setEditedData({ ...facture.donnees });
  };

  const handleSaveEdit = () => {
    if (!selectedFacture || !editedData) return;

    // Revalider avec les nouvelles données
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!editedData.fournisseur) errors.push("Fournisseur manquant");
    if (!editedData.montant_ttc) errors.push("Montant TTC manquant");
    if (!editedData.numero_facture) warnings.push("Numéro de facture sera généré automatiquement");
    
    const valide = errors.length === 0;
    const erreur = errors.length > 0 ? errors.join(", ") : warnings.length > 0 ? warnings.join(", ") : undefined;

    // Mettre à jour la facture dans la liste
    setFactures((prev) =>
      prev.map((f) =>
        f.id === selectedFacture.id
          ? { ...f, donnees: editedData, valide, erreur }
          : f
      )
    );

    toast({
      title: "Données mises à jour",
      description: valide ? "Facture prête à être sauvegardée" : "Veuillez compléter les champs manquants",
    });

    setSelectedFacture(null);
    setEditedData(null);
  };

  const stats = {
    total: factures.length,
    valides: factures.filter((f) => f.valide).length,
    erreurs: factures.filter((f) => f.erreur).length,
    montantTotal: factures.reduce((acc, f) => acc + (f.donnees.montant_ttc || 0), 0),
    coutTotal: factures.reduce((acc, f) => acc + (f.cout_estime || 0), 0),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Extraction Automatique de Factures par IA
          </DialogTitle>
          <DialogDescription>
            Uploadez vos factures PDF et laissez l'IA extraire automatiquement les données
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="extraction" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="extraction">
              <Upload className="h-4 w-4 mr-2" />
              Extraction
            </TabsTrigger>
            <TabsTrigger value="prompt">
              <Settings className="h-4 w-4 mr-2" />
              Prompt
            </TabsTrigger>
          </TabsList>

          <TabsContent value="extraction" className="flex-1 overflow-y-auto space-y-4">
            {/* Zone d'upload */}
            <Card>
              <CardContent className="pt-6">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-accent transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">
                      {isProcessing ? `Traitement... ${progress}%` : "Cliquez ou glissez vos factures PDF"}
                    </p>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    disabled={isProcessing}
                    className="hidden"
                  />
                </label>

                {isProcessing && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Loader2 className="animate-spin h-4 w-4" />
                        {currentFile}
                      </span>
                      <span className="text-muted-foreground">{progress}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div className="bg-primary h-2 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Statistiques */}
            {factures.length > 0 && (
              <div className="grid grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.total}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Validées</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{stats.valides}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Erreurs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{stats.erreurs}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Montant</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {new Intl.NumberFormat("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 0,
                      }).format(stats.montantTotal)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Coût IA</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-purple-600">${(stats.coutTotal * 100).toFixed(3)}¢</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Liste des factures - Format tableau compact */}
            {factures.length > 0 && (
              <>
                <div className="border rounded-lg overflow-hidden">
                  {/* En-tête de table */}
                  <div className="grid grid-cols-12 gap-2 p-3 bg-muted/50 font-semibold text-sm border-b">
                    <div className="col-span-1 flex items-center justify-center">Statut</div>
                    <div className="col-span-3">Fichier</div>
                    <div className="col-span-2">Fournisseur</div>
                    <div className="col-span-2">N° Facture</div>
                    <div className="col-span-1">Montant TTC</div>
                    <div className="col-span-1">Date</div>
                    <div className="col-span-2 text-center">Actions</div>
                  </div>

                  {/* Liste scrollable */}
                  <ScrollArea className="h-[500px]">
                    <div className="divide-y">
                      {factures
                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                        .map((facture) => (
                        <div
                          key={facture.id}
                          className={`grid grid-cols-12 gap-2 p-3 hover:bg-muted/30 transition-colors ${
                            facture.valide
                              ? "bg-green-50/30"
                              : facture.erreur
                                ? "bg-red-50/30"
                                : "bg-yellow-50/30"
                          }`}
                        >
                          {/* Statut */}
                          <div className="col-span-1 flex items-center justify-center">
                            {facture.valide ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : facture.erreur ? (
                              <XCircle className="h-5 w-5 text-red-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-yellow-600" />
                            )}
                          </div>

                          {/* Fichier */}
                          <div className="col-span-3 flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <span className="text-sm font-medium truncate" title={facture.fichier}>
                              {facture.fichier}
                            </span>
                          </div>

                          {/* Fournisseur */}
                          <div className="col-span-2 flex items-center min-w-0">
                            <span 
                              className={`text-sm truncate ${!facture.donnees.fournisseur ? "text-red-600 font-semibold" : ""}`}
                              title={facture.donnees.fournisseur || "Fournisseur manquant"}
                            >
                              {facture.donnees.fournisseur || "⚠ Manquant"}
                            </span>
                          </div>

                          {/* N° Facture */}
                          <div className="col-span-2 flex items-center min-w-0">
                            <span 
                              className={`text-sm truncate ${!facture.donnees.numero_facture ? "text-amber-600 italic" : ""}`}
                              title={facture.donnees.numero_facture || "Sera généré automatiquement"}
                            >
                              {facture.donnees.numero_facture || "🔄 Auto"}
                            </span>
                          </div>

                          {/* Montant TTC */}
                          <div className="col-span-1 flex items-center">
                            <span 
                              className={`text-sm font-semibold ${
                                !facture.donnees.montant_ttc 
                                  ? "text-red-600" 
                                  : "text-green-600"
                              }`}
                              title={facture.donnees.montant_ttc ? undefined : "Montant manquant"}
                            >
                              {facture.donnees.montant_ttc
                                ? new Intl.NumberFormat("fr-FR", { 
                                    style: "currency", 
                                    currency: "EUR",
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                  }).format(facture.donnees.montant_ttc)
                                : "⚠"}
                            </span>
                          </div>

                          {/* Date */}
                          <div className="col-span-1 flex items-center">
                            <span className="text-sm" title={facture.donnees.date_facture || undefined}>
                              {facture.donnees.date_facture || "-"}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="col-span-2 flex items-center justify-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                const url = URL.createObjectURL(facture.fileObject);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = facture.fichier;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              }}
                              title="Télécharger le PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                const url = URL.createObjectURL(facture.fileObject);
                                window.open(url, '_blank');
                              }}
                              title="Voir le PDF"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditFacture(facture)}
                              title="Modifier"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
                              onClick={() => {
                                const newFactures = factures.filter((f) => f.id !== facture.id);
                                setFactures(newFactures);
                                // Ajuster la page si nécessaire
                                const maxPage = Math.max(1, Math.ceil(newFactures.length / itemsPerPage));
                                if (currentPage > maxPage) {
                                  setCurrentPage(maxPage);
                                }
                              }}
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                
                {/* Pagination */}
                {factures.length > itemsPerPage && (
                  <div className="flex items-center justify-between px-2 py-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Page {currentPage} sur {Math.ceil(factures.length / itemsPerPage)} • {factures.length} facture{factures.length > 1 ? 's' : ''} au total
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Précédent
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.min(Math.ceil(factures.length / itemsPerPage), prev + 1))}
                        disabled={currentPage === Math.ceil(factures.length / itemsPerPage)}
                      >
                        Suivant
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="prompt" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configuration du prompt</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="prompt">Prompt d'extraction</Label>
                  <Textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={() => setPrompt(DEFAULT_PROMPT)} className="mt-2">
                    Réinitialiser
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {factures.length > 0 && (
              <span>
                {stats.valides} facture{stats.valides > 1 ? "s" : ""} prête{stats.valides > 1 ? "s" : ""} à être
                sauvegardée{stats.valides > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={sauvegarderFactures} disabled={stats.valides === 0 || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Sauvegarder {stats.valides > 0 ? `(${stats.valides})` : ""}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Modal détails facture */}
        {selectedFacture && editedData && (
          <Dialog open={!!selectedFacture} onOpenChange={() => {
            setSelectedFacture(null);
            setEditedData(null);
          }}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Éditer la facture</DialogTitle>
                <DialogDescription>
                  Modifiez les données extraites avant sauvegarde
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Fichier</Label>
                  <p className="text-sm font-medium text-muted-foreground">{selectedFacture.fichier}</p>
                </div>

                {selectedFacture.erreur && (
                  <div className={`p-3 rounded-lg ${selectedFacture.valide ? "bg-amber-50 border border-amber-200" : "bg-red-50 border border-red-200"}`}>
                    <p className={`text-sm font-semibold mb-1 ${selectedFacture.valide ? "text-amber-700" : "text-red-700"}`}>
                      {selectedFacture.valide ? "⚠ Attention" : "❌ Erreurs à corriger"}
                    </p>
                    <p className={`text-sm ${selectedFacture.valide ? "text-amber-600" : "text-red-600"}`}>
                      {selectedFacture.erreur}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="edit-fournisseur" className={!editedData.fournisseur ? "text-red-600" : ""}>
                      Fournisseur {!editedData.fournisseur && <span className="text-red-600">*</span>}
                    </Label>
                    <Input
                      id="edit-fournisseur"
                      value={editedData.fournisseur || ""}
                      onChange={(e) => setEditedData({ ...editedData, fournisseur: e.target.value })}
                      placeholder="Nom du fournisseur"
                      className={!editedData.fournisseur ? "border-red-300" : ""}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-numero">N° Facture</Label>
                    <Input
                      id="edit-numero"
                      value={editedData.numero_facture || ""}
                      onChange={(e) => setEditedData({ ...editedData, numero_facture: e.target.value })}
                      placeholder="Auto-généré si vide"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-date">Date</Label>
                    <Input
                      id="edit-date"
                      type="date"
                      value={editedData.date_facture || ""}
                      onChange={(e) => setEditedData({ ...editedData, date_facture: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-ht">Montant HT (€)</Label>
                    <Input
                      id="edit-ht"
                      type="number"
                      step="0.01"
                      value={editedData.montant_ht || ""}
                      onChange={(e) => setEditedData({ ...editedData, montant_ht: parseFloat(e.target.value) || null })}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-tva">Montant TVA (€)</Label>
                    <Input
                      id="edit-tva"
                      type="number"
                      step="0.01"
                      value={editedData.montant_tva || ""}
                      onChange={(e) => setEditedData({ ...editedData, montant_tva: parseFloat(e.target.value) || null })}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="edit-ttc" className={!editedData.montant_ttc ? "text-red-600" : ""}>
                      Montant TTC (€) {!editedData.montant_ttc && <span className="text-red-600">*</span>}
                    </Label>
                    <Input
                      id="edit-ttc"
                      type="number"
                      step="0.01"
                      value={editedData.montant_ttc || ""}
                      onChange={(e) => setEditedData({ ...editedData, montant_ttc: parseFloat(e.target.value) || null })}
                      placeholder="0.00"
                      className={!editedData.montant_ttc ? "border-red-300" : ""}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="edit-libelle">Libellé / Description</Label>
                    <Textarea
                      id="edit-libelle"
                      value={editedData.libelle || ""}
                      onChange={(e) => setEditedData({ ...editedData, libelle: e.target.value })}
                      placeholder="Description de la facture"
                      rows={3}
                    />
                  </div>
                </div>

                {selectedFacture.tokens && (
                  <div className="text-xs text-muted-foreground">
                    Tokens: {selectedFacture.tokens.input + selectedFacture.tokens.output} • Coût: $
                    {(selectedFacture.cout_estime! * 100).toFixed(4)}¢
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedFacture(null);
                    setEditedData(null);
                  }}
                >
                  Annuler
                </Button>
                <Button onClick={handleSaveEdit}>
                  Enregistrer les modifications
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
