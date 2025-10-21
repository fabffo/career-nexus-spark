import { useState, useEffect } from "react";
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
  client: string | null;
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

interface ExtractionFactureVenteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const DEFAULT_PROMPT = `Extrais ces données de la facture de VENTE en JSON strict :
{
  "client": "nom complet du client/destinataire",
  "numero_facture": "numéro exact de la facture (ex: FAC-F-xxxxx)",
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
- Pour une facture de vente, le client est le DESTINATAIRE de la facture

Retourne UNIQUEMENT le JSON valide, sans markdown ni texte additionnel.`;

export default function ExtractionFactureVenteDialog({ open, onOpenChange, onSuccess }: ExtractionFactureVenteDialogProps) {
  const [factures, setFactures] = useState<FactureExtraite[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [currentFile, setCurrentFile] = useState("");
  const [progress, setProgress] = useState(0);
  const [selectedFacture, setSelectedFacture] = useState<FactureExtraite | null>(null);
  const { toast } = useToast();

  console.log("🟢 ExtractionFactureVenteDialog - open:", open);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setFactures([]);
      setSelectedFacture(null);
      setProgress(0);
      setCurrentFile("");
    }
  }, [open]);

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
          const valide = !!(donnees.client && donnees.numero_facture && donnees.montant_ttc);

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
            client: null,
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

    // Récupérer la société interne
    const { data: societe } = await supabase.from("societe_interne").select("*").limit(1).single();

    for (const facture of facturesValides) {
      try {
        // 1. Upload le fichier PDF dans Supabase Storage
        const timestamp = Date.now();
        const cleanFileName = facture.fichier
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9._-]/g, '')
          .substring(0, 100);
        const fileName = `${timestamp}_${cleanFileName}`;
        const filePath = `factures-ventes/${fileName}`;

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
          numero_facture: facture.donnees.numero_facture || undefined,
          type_facture: "VENTES",
          date_emission: facture.donnees.date_facture || new Date().toISOString().split("T")[0],
          date_echeance: facture.donnees.date_facture || new Date().toISOString().split("T")[0],
          emetteur_type: "Entreprise",
          emetteur_nom: societe?.raison_sociale || "Votre Entreprise",
          emetteur_adresse: societe?.adresse,
          emetteur_telephone: societe?.telephone,
          emetteur_email: societe?.email,
          destinataire_type: "Client",
          destinataire_nom: facture.donnees.client || "Client inconnu",
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
            Extraction Factures de Vente par IA
          </DialogTitle>
          <DialogDescription>
            Uploadez vos factures de vente PDF et laissez l'IA extraire automatiquement les données
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

            {factures.length > 0 && (
              <>
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
                      <div className="text-2xl font-bold text-purple-600">
                        {new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                          minimumFractionDigits: 4,
                          maximumFractionDigits: 4,
                        }).format(stats.coutTotal)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Factures extraites</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-2">
                        {factures.map((facture) => (
                          <div
                            key={facture.id}
                            className={`p-3 rounded-lg border ${
                              facture.valide
                                ? "border-green-200 bg-green-50"
                                : "border-red-200 bg-red-50"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                {facture.valide ? (
                                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <span className="font-medium text-sm truncate">{facture.fichier}</span>
                                  </div>
                                  {facture.erreur ? (
                                    <p className="text-xs text-red-600">{facture.erreur}</p>
                                  ) : (
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                      <div>
                                        <span className="text-muted-foreground">Client:</span>{" "}
                                        <span className="font-medium">{facture.donnees.client || "-"}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">N° Facture:</span>{" "}
                                        <span className="font-medium">{facture.donnees.numero_facture || "-"}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Montant TTC:</span>{" "}
                                        <span className="font-medium">
                                          {facture.donnees.montant_ttc
                                            ? new Intl.NumberFormat("fr-FR", {
                                                style: "currency",
                                                currency: "EUR",
                                              }).format(facture.donnees.montant_ttc)
                                            : "-"}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Date:</span>{" "}
                                        <span className="font-medium">{facture.donnees.date_facture || "-"}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setSelectedFacture(facture)}
                                  title="Voir détails"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setFactures(factures.filter((f) => f.id !== facture.id))}
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="prompt" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Personnaliser le prompt d'extraction</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Prompt personnalisé</Label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={15}
                    className="font-mono text-sm"
                  />
                </div>
                <Button onClick={() => setPrompt(DEFAULT_PROMPT)} variant="outline" size="sm">
                  Réinitialiser au prompt par défaut
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {stats.valides > 0 && `${stats.valides} facture(s) prête(s) à être sauvegardée(s)`}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing || isSaving}>
              Annuler
            </Button>
            <Button onClick={sauvegarderFactures} disabled={stats.valides === 0 || isSaving || isProcessing}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Sauvegarder {stats.valides > 0 && `(${stats.valides})`}
                </>
              )}
            </Button>
          </div>
        </div>

        {selectedFacture && (
          <Dialog open={!!selectedFacture} onOpenChange={() => setSelectedFacture(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Détails de l'extraction</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Fichier</Label>
                  <Input value={selectedFacture.fichier} readOnly />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Client</Label>
                    <Input value={selectedFacture.donnees.client || "-"} readOnly />
                  </div>
                  <div>
                    <Label>N° Facture</Label>
                    <Input value={selectedFacture.donnees.numero_facture || "-"} readOnly />
                  </div>
                </div>
                <div>
                  <Label>Libellé</Label>
                  <Textarea value={selectedFacture.donnees.libelle || "-"} readOnly rows={3} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Montant HT</Label>
                    <Input value={selectedFacture.donnees.montant_ht?.toFixed(2) || "-"} readOnly />
                  </div>
                  <div>
                    <Label>TVA</Label>
                    <Input value={selectedFacture.donnees.montant_tva?.toFixed(2) || "-"} readOnly />
                  </div>
                  <div>
                    <Label>Montant TTC</Label>
                    <Input value={selectedFacture.donnees.montant_ttc?.toFixed(2) || "-"} readOnly />
                  </div>
                </div>
                <div>
                  <Label>Date facture</Label>
                  <Input value={selectedFacture.donnees.date_facture || "-"} readOnly />
                </div>
                {selectedFacture.tokens && (
                  <div className="text-xs text-muted-foreground">
                    Tokens: {selectedFacture.tokens.input} input + {selectedFacture.tokens.output} output ≈{" "}
                    {selectedFacture.cout_estime?.toFixed(4)}€
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
