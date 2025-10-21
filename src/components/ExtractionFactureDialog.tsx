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

          const valide = !!(donnees.fournisseur && donnees.numero_facture && donnees.montant_ttc);

          console.log("✅ Extraction réussie:", { valide, donnees: Object.keys(donnees) });

          const facture: FactureExtraite = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            fichier: file.name,
            fileObject: file,
            donnees,
            valide,
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
        // 1. Upload le fichier PDF dans Supabase Storage
        const timestamp = Date.now();
        const fileName = `${timestamp}_${facture.fichier}`;
        const filePath = `factures-achats/${fileName}`;

        const { error: uploadError } = await supabase.storage.from("factures").upload(filePath, facture.fileObject, {
          contentType: "application/pdf",
        });

        if (uploadError) throw uploadError;

        // 2. Obtenir l'URL publique
        const {
          data: { publicUrl },
        } = supabase.storage.from("factures").getPublicUrl(filePath);

        // 3. Récupérer l'utilisateur connecté
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // 4. Insérer la facture dans la base de données
        const { error: insertError } = await supabase.from("factures").insert({
          numero_facture: facture.donnees.numero_facture || `FA-${timestamp}`,
          type_facture: "ACHATS",
          date_emission: facture.donnees.date_facture || new Date().toISOString().split("T")[0],
          date_echeance: facture.donnees.date_facture || new Date().toISOString().split("T")[0],
          emetteur_type: "Fournisseur",
          emetteur_nom: facture.donnees.fournisseur || "Fournisseur inconnu",
          destinataire_type: "Entreprise",
          destinataire_nom: "Votre Entreprise", // À adapter selon votre contexte
          total_ht: facture.donnees.montant_ht || 0,
          total_tva: facture.donnees.montant_tva || 0,
          total_ttc: facture.donnees.montant_ttc || 0,
          informations_paiement: facture.donnees.libelle,
          reference_societe: filePath,
          statut: "VALIDEE",
          created_by: user?.id,
        });

        if (insertError) throw insertError;

        successCount++;
      } catch (error) {
        console.error(`Erreur pour ${facture.fichier}:`, error);
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
    } else {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les factures",
        variant: "destructive",
      });
    }
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

            {/* Liste des factures */}
            {factures.length > 0 && (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3 pr-4">
                  {factures.map((facture) => (
                    <Card
                      key={facture.id}
                      className={`${
                        facture.valide
                          ? "border-green-300 bg-green-50/50"
                          : facture.erreur
                            ? "border-red-300 bg-red-50/50"
                            : "border-yellow-300 bg-yellow-50/50"
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {facture.valide ? (
                              <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                            ) : facture.erreur ? (
                              <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-6 w-6 text-yellow-600 flex-shrink-0" />
                            )}

                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText className="h-4 w-4" />
                                <h3 className="font-semibold">{facture.fichier}</h3>
                                {facture.valide && <Badge variant="default">Prête</Badge>}
                              </div>

                              {facture.erreur ? (
                                <p className="text-sm text-red-600">{facture.erreur}</p>
                              ) : (
                                <div className="grid grid-cols-4 gap-3 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Fournisseur:</span>
                                    <p className="font-medium">{facture.donnees.fournisseur || "-"}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">N° Facture:</span>
                                    <p className="font-medium">{facture.donnees.numero_facture || "-"}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Montant TTC:</span>
                                    <p className="font-semibold text-green-600">
                                      {facture.donnees.montant_ttc
                                        ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
                                            facture.donnees.montant_ttc,
                                          )
                                        : "-"}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Date:</span>
                                    <p className="font-medium">{facture.donnees.date_facture || "-"}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-1 ml-4">
                            <Button variant="ghost" size="icon" onClick={() => setSelectedFacture(facture)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setFactures((prev) => prev.filter((f) => f.id !== facture.id))}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
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
        {selectedFacture && (
          <Dialog open={!!selectedFacture} onOpenChange={() => setSelectedFacture(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Détails de la facture</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Fichier</Label>
                  <p className="text-sm font-medium">{selectedFacture.fichier}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Fournisseur</Label>
                    <p className="text-sm">{selectedFacture.donnees.fournisseur || "-"}</p>
                  </div>
                  <div>
                    <Label>N° Facture</Label>
                    <p className="text-sm">{selectedFacture.donnees.numero_facture || "-"}</p>
                  </div>
                  <div>
                    <Label>Date</Label>
                    <p className="text-sm">{selectedFacture.donnees.date_facture || "-"}</p>
                  </div>
                  <div>
                    <Label>Montant HT</Label>
                    <p className="text-sm">
                      {selectedFacture.donnees.montant_ht
                        ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
                            selectedFacture.donnees.montant_ht,
                          )
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <Label>TVA</Label>
                    <p className="text-sm">
                      {selectedFacture.donnees.montant_tva
                        ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
                            selectedFacture.donnees.montant_tva,
                          )
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <Label>Montant TTC</Label>
                    <p className="text-sm font-semibold text-green-600">
                      {selectedFacture.donnees.montant_ttc
                        ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
                            selectedFacture.donnees.montant_ttc,
                          )
                        : "-"}
                    </p>
                  </div>
                </div>
                {selectedFacture.donnees.libelle && (
                  <div>
                    <Label>Libellé</Label>
                    <p className="text-sm">{selectedFacture.donnees.libelle}</p>
                  </div>
                )}
                {selectedFacture.tokens && (
                  <div className="text-xs text-muted-foreground">
                    Tokens: {selectedFacture.tokens.input + selectedFacture.tokens.output} • Coût: $
                    {(selectedFacture.cout_estime! * 100).toFixed(4)}¢
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
