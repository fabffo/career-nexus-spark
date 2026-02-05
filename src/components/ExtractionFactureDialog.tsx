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
  AlertTriangle,
  SkipBack,
  SkipForward,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Building2,
  Briefcase,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface FactureLigne {
  description: string;
  quantite: number;
  prix_unitaire_ht: number;
  prix_ht: number;
  taux_tva: number;
  prix_ttc: number;
}

interface FactureLigne {
  description: string;
  quantite: number;
  prix_unitaire_ht: number;
  prix_ht: number;
  taux_tva: number;
  prix_ttc: number;
}

interface FactureData {
  fournisseur: string | null;
  numero_facture: string | null;
  libelle: string | null;
  montant_ht: number | null;
  montant_ttc: number | null;
  montant_tva: number | null;
  date_facture: string | null;
  lignes?: FactureLigne[];
  // Nouveau: données de corrélation
  fournisseur_id?: string | null;
  fournisseur_score?: number;
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
  // Nouveau: type de fournisseur utilisé pour l'extraction
  typeFournisseur?: "services" | "generaux";
}

interface ExtractionFactureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Types pour les fournisseurs référents
type TypeFournisseur = "services" | "generaux";

interface FournisseurReferent {
  id: string;
  raison_sociale: string;
  mots_cles_rapprochement: string | null;
}

// ========== SYSTÈME DE NORMALISATION DES FOURNISSEURS ==========
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
  BENOME: ["BENOME", "SASU BENOME", "BENOME SASU"],
  RHSOLUTIONS: ["RHSOLUTIONS PORTAGE SALARIAL", "RH SOLUTIONS", "PORTAGE 92"],

  // Uber - TRÈS IMPORTANT : Le numéro de facture Uber contient toujours des patterns spécifiques
  Uber: ["Uber B.V.", "Uber BV", "Uber France", "UBER EATS", "UBER", "Uber Netherlands", "UBER B.V", "uber.com"],
  
  // Autres VTC et transports
  Bolt: ["BOLT TECHNOLOGY", "BOLT", "BOLT OÜ"],
  Kapten: ["KAPTEN", "TAXIFY"],
  FreeNow: ["FREE NOW", "FREENOW", "MYTAXI"],
  Heetch: ["HEETCH"],

  // Services IT
  OpenAI: ["OpenAI, LLC", "OpenAI Inc", "OPENAI", "OPEN AI", "OpenAI LLC"],
  LinkedIn: ["LinkedIn Ireland Unlimited Company", "LinkedIn Corporation", "LINKEDIN"],
  Indeed: ["Indeed Ireland Operations Limited", "Indeed Inc", "INDEED"],
  Microsoft: ["Microsoft Corporation", "Microsoft Ireland", "MICROSOFT"],

  // Télécoms
  Orange: ["ORANGE", "ORANGE SA", "ORANGE FRANCE", "ORANGE BUSINESS", "ORANGE BUSINESS SERVICES"],

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
// ========== FIN DU SYSTÈME DE NORMALISATION ==========

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

⚠️ RÈGLES CRITIQUES POUR IDENTIFIER LE FOURNISSEUR :

1. Le FOURNISSEUR est celui qui ÉMET la facture, la société qui fournit le service
2. Le CLIENT/DESTINATAIRE est celui qui PAYE, généralement un nom de personne ou de société cliente

🚨 RÈGLES SPÉCIALES POUR LES FACTURES DE VTC / TRANSPORT :
- Si tu vois "Uber", "Uber B.V.", "uber.com", ou un logo Uber → FOURNISSEUR = "Uber"
- Si tu vois "Bolt", "Bolt Technology" → FOURNISSEUR = "Bolt"
- Si tu vois "FreeNow", "Mytaxi" → FOURNISSEUR = "FreeNow"
- Le NOM D'UNE PERSONNE (prénom + nom) est TOUJOURS le CLIENT, jamais le fournisseur
- Les factures Uber/Bolt ont un format particulier avec le logo en haut

EXEMPLES CONCRETS :
- ✅ Si tu vois "Uber B.V." quelque part sur la facture → FOURNISSEUR = "Uber"
- ✅ Si tu vois "uber.com" dans le pied de page → FOURNISSEUR = "Uber"
- ❌ Si tu vois "Jean DUPONT" ou "Société X" comme destinataire → C'EST LE CLIENT
- ❌ Ne JAMAIS mettre un nom de personne comme fournisseur pour une facture de transport

3. Indices que c'est le FOURNISSEUR (entreprise qui vend/facture) :
   - Logo de la marque en haut de la facture
   - SIREN, SIRET, TVA intracommunautaire 
   - IBAN/RIB (coordonnées bancaires pour recevoir le paiement)
   - Mentions "SASU au capital de...", "RCS", "NAF"
   - URL du site web (uber.com, bolt.eu, etc.)

4. Indices que c'est le CLIENT (NE PAS mettre comme fournisseur) :
   - Un nom de personne physique (prénom + nom)
   - Précédé de "Destinataire:", "Facturé à:", "Client:", "Passager:"
   - Adresse personnelle

AUTRES RÈGLES :
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
  const [selectedFactureIndex, setSelectedFactureIndex] = useState<number>(-1);
  const [editedData, setEditedData] = useState<FactureData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;
  const { toast } = useToast();

  // Nouveau: État pour le type de fournisseur et les référents
  const [typeFournisseur, setTypeFournisseur] = useState<TypeFournisseur>("services");
  const [fournisseursReferents, setFournisseursReferents] = useState<FournisseurReferent[]>([]);
  const [isLoadingReferents, setIsLoadingReferents] = useState(false);

  // Charger les fournisseurs référents selon le type sélectionné
  useEffect(() => {
    if (!open) return;
    
    const loadFournisseursReferents = async () => {
      setIsLoadingReferents(true);
      try {
        const tableName = typeFournisseur === "services" ? "fournisseurs_services" : "fournisseurs_generaux";
        
        const { data, error } = await supabase
          .from(tableName)
          .select("id, raison_sociale, mots_cles_rapprochement")
          .order("raison_sociale");

        if (error) throw error;
        
        setFournisseursReferents(data || []);
        console.log(`📋 ${data?.length || 0} fournisseurs ${typeFournisseur} chargés`);
      } catch (error) {
        console.error("Erreur chargement fournisseurs référents:", error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les fournisseurs référents",
          variant: "destructive",
        });
      } finally {
        setIsLoadingReferents(false);
      }
    };

    loadFournisseursReferents();
  }, [open, typeFournisseur]);

  // Fonction de corrélation intelligente
  const correlerFournisseur = (nomExtrait: string): { id: string | null; score: number; nom: string } => {
    if (!nomExtrait || fournisseursReferents.length === 0) {
      return { id: null, score: 0, nom: nomExtrait };
    }

    const nomExtraitLower = nomExtrait.toLowerCase().trim();
    const nomExtraitNormalise = normaliserPourComparaison(nomExtraitLower);
    
    let meilleurMatch: { id: string; score: number; nom: string } | null = null;

    for (const ref of fournisseursReferents) {
      let score = 0;
      
      // 1. Correspondance exacte sur raison_sociale
      const raisonSocialeLower = ref.raison_sociale.toLowerCase().trim();
      const raisonSocialeNormalisee = normaliserPourComparaison(raisonSocialeLower);
      
      if (nomExtraitNormalise === raisonSocialeNormalisee) {
        score = 100;
      } else if (nomExtraitLower.includes(raisonSocialeLower) || raisonSocialeLower.includes(nomExtraitLower)) {
        score = 80;
      }
      
      // 2. Correspondance sur mots-clés de rapprochement
      if (ref.mots_cles_rapprochement) {
        const motsClésGroupes = ref.mots_cles_rapprochement.split(",").map(g => g.trim());
        
        for (const groupe of motsClésGroupes) {
          const motsClés = groupe.split(" ").map(m => m.toLowerCase().trim()).filter(Boolean);
          
          // Tous les mots du groupe doivent être présents (opérateur ET)
          const tousPresents = motsClés.every(mot => nomExtraitLower.includes(mot));
          
          if (tousPresents && motsClés.length > 0) {
            const scoreMotsCles = 70 + (motsClés.length * 5); // Plus de mots = meilleur score
            score = Math.max(score, Math.min(scoreMotsCles, 95));
          }
        }
      }
      
      if (score > 0 && (!meilleurMatch || score > meilleurMatch.score)) {
        meilleurMatch = { id: ref.id, score, nom: ref.raison_sociale };
      }
    }

    return meilleurMatch || { id: null, score: 0, nom: nomExtrait };
  };

  // Normaliser pour comparaison (retire accents, ponctuation, suffixes juridiques)
  const normaliserPourComparaison = (texte: string): string => {
    return texte
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Retire accents
      .replace(/[^a-z0-9\s]/g, "") // Garde uniquement alphanumérique
      .replace(/\b(sas|sarl|sa|eurl|sasu|ltd|llc|inc|gmbh|bv|nv)\b/gi, "") // Retire suffixes juridiques
      .replace(/\s+/g, " ")
      .trim();
  };

  // Fonction utilitaire pour attendre
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Fonction d'extraction avec retry et gestion du rate limit
  const extraireFactureAvecRetry = async (file: File, maxRetries = 3, baseDelay = 10000): Promise<FactureExtraite> => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await extraireFacture(file);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Vérifier si c'est une erreur de rate limit
        const isRateLimit = lastError.message.includes('429') || 
                           lastError.message.includes('rate_limit') ||
                           lastError.message.includes('rate limit') ||
                           lastError.message.includes('tokens per minute');
        
        if (isRateLimit && attempt < maxRetries) {
          const delay = baseDelay * attempt; // Délai exponentiel: 10s, 20s, 30s
          console.log(`⏳ Rate limit atteint, tentative ${attempt}/${maxRetries}. Attente de ${delay/1000}s...`);
          setCurrentFile(`${file.name} (attente ${delay/1000}s - rate limit)`);
          await sleep(delay);
        } else if (!isRateLimit) {
          // Si ce n'est pas un rate limit, ne pas réessayer
          break;
        }
      }
    }
    
    throw lastError || new Error("Erreur d'extraction après plusieurs tentatives");
  };

  const extraireFacture = async (file: File): Promise<FactureExtraite> => {
    setCurrentFile(file.name);

    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          console.log("📄 Lecture du fichier:", file.name);
          const base64Data = (reader.result as string).split(",")[1];
          console.log("✓ Base64 encodé:", base64Data.length, "bytes");

          // Préparer les mots-clés des fournisseurs référents pour le contexte IA
          const fournisseursContext = fournisseursReferents
            .filter(f => f.raison_sociale)
            .map(f => ({
              nom: f.raison_sociale,
              mots_cles: f.mots_cles_rapprochement || ""
            }));

          // Enrichir le prompt avec le contexte des fournisseurs référents
          let promptEnrichi = prompt;
          if (fournisseursContext.length > 0) {
            const listeNoms = fournisseursContext.map(f => f.nom).join(", ");
            promptEnrichi += `\n\n📌 FOURNISSEURS RÉFÉRENTS (${typeFournisseur === "services" ? "Services" : "Généraux"}) :\nSi le fournisseur de la facture correspond à l'un de ces noms (ou variante proche), utilise le nom exact de la liste :\n${listeNoms}`;
          }

          // Appel de l'edge function
          console.log("🚀 Appel edge function extraire-facture...");
          console.log(`📋 Contexte: ${fournisseursContext.length} fournisseurs référents (${typeFournisseur})`);
          
          const { data, error } = await supabase.functions.invoke("extraire-facture", {
            body: {
              pdfBase64: base64Data,
              prompt: promptEnrichi,
              typeFournisseur: typeFournisseur,
              fournisseursReferents: fournisseursContext,
            },
          });

          console.log("📥 Réponse reçue:", { data, error });

          if (error) {
            console.error("❌ Erreur edge function:", error);
            
            // Message spécifique pour les problèmes de crédits
            if (error.message?.includes('credit') || error.message?.includes('billing') || error.message?.includes('402')) {
              throw new Error('Crédits Anthropic insuffisants. Veuillez ajouter des crédits sur https://console.anthropic.com/settings/billing pour utiliser cette fonctionnalité.');
            }
            
            // Propager l'erreur 429 pour le retry
            if (error.message?.includes('429')) {
              throw new Error(`Rate limit (429): ${error.message}`);
            }
            
            throw new Error(`Erreur serveur: ${error.message}`);
          }

          if (data?.error) {
            console.error("❌ Erreur dans la réponse:", data.error);
            
            // Message spécifique pour les problèmes de crédits
            if (typeof data.error === 'string' && (data.error.includes('credit') || data.error.includes('billing') || data.error.includes('Anthropic'))) {
              throw new Error('⚠️ Crédits Anthropic requis : Cette fonctionnalité nécessite des crédits Anthropic pour analyser les documents PDF. Veuillez ajouter des crédits sur https://console.anthropic.com/settings/billing');
            }
            
            // Propager l'erreur de rate limit pour le retry
            if (typeof data.error === 'string' && (data.error.includes('rate_limit') || data.error.includes('429') || data.details?.includes('rate_limit'))) {
              throw new Error(`Rate limit (429): ${data.error}`);
            }
            
            throw new Error(data.error);
          }

          if (!data?.donnees) {
            console.error("❌ Pas de données dans la réponse");
            throw new Error("Pas de données extraites");
          }

          const donnees = data.donnees;

          // ========== NORMALISATION DU FOURNISSEUR ==========
          if (donnees.fournisseur) {
            const fournisseurOriginal = donnees.fournisseur;
            donnees.fournisseur = normaliserFournisseur(donnees.fournisseur);
            console.log(`📝 Fournisseur: "${fournisseurOriginal}" → "${donnees.fournisseur}"`);
          }
          // ==================================================

          // ========== CORRÉLATION AVEC FOURNISSEURS RÉFÉRENTS ==========
          if (donnees.fournisseur) {
            const correlation = correlerFournisseur(donnees.fournisseur);
            donnees.fournisseur_id = correlation.id;
            donnees.fournisseur_score = correlation.score;
            
            if (correlation.score >= 70) {
              console.log(`🔗 Corrélation trouvée: "${donnees.fournisseur}" → "${correlation.nom}" (score: ${correlation.score}%)`);
              // Utiliser le nom du référent si le score est suffisant
              donnees.fournisseur = correlation.nom;
            } else if (correlation.score > 0) {
              console.log(`⚠️ Corrélation faible: "${donnees.fournisseur}" ≈ "${correlation.nom}" (score: ${correlation.score}%)`);
            } else {
              console.log(`❌ Aucune corrélation pour: "${donnees.fournisseur}"`);
            }
          }
          // =============================================================

          // Validation détaillée avec génération de messages d'erreur
          const errors: string[] = [];
          const warnings: string[] = [];

          if (!donnees.fournisseur) errors.push("Fournisseur manquant");
          if (!donnees.montant_ttc) errors.push("Montant TTC manquant");
          if (!donnees.numero_facture) warnings.push("Numéro de facture sera généré automatiquement");
          
          // Avertissement si fournisseur non corrélé
          if (donnees.fournisseur && (!donnees.fournisseur_id || donnees.fournisseur_score! < 70)) {
            warnings.push("Fournisseur non trouvé dans les référents");
          }

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
            typeFournisseur: typeFournisseur,
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

    // Traitement SÉQUENTIEL avec délai entre chaque fichier pour éviter les rate limits
    const DELAY_BETWEEN_FILES = 3000; // 3 secondes entre chaque fichier

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(Math.round(((i + 1) / files.length) * 100));

      // Attendre entre les fichiers (sauf pour le premier)
      if (i > 0) {
        setCurrentFile(`Attente avant ${file.name}...`);
        await sleep(DELAY_BETWEEN_FILES);
      }

      try {
        // Utiliser la version avec retry pour gérer les rate limits
        const facture = await extraireFactureAvecRetry(file);
        nouvelles.push(facture);
        
        // Mise à jour en temps réel pour afficher les résultats au fur et à mesure
        setFactures((prev) => [facture, ...prev]);
      } catch (error) {
        const factureErreur: FactureExtraite = {
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
        };
        nouvelles.push(factureErreur);
        setFactures((prev) => [factureErreur, ...prev]);
      }
    }

    setIsProcessing(false);
    setCurrentFile("");
    setProgress(0);
    setCurrentPage(1);

    const successCount = nouvelles.filter((f) => f.valide).length;
    const rateLimitErrors = nouvelles.filter((f) => f.erreur?.includes('rate_limit') || f.erreur?.includes('429')).length;
    
    if (rateLimitErrors > 0) {
      toast({
        title: "Extraction terminée avec limites",
        description: `${successCount}/${nouvelles.length} factures extraites. ${rateLimitErrors} fichier(s) bloqué(s) par le rate limit Anthropic. Réessayez dans quelques minutes.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Extraction terminée",
        description: `${successCount}/${nouvelles.length} factures extraites avec succès`,
      });
    }
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
        console.log("🔄 Traitement de:", facture.fichier, facture.donnees);

        const timestamp = Date.now();
        const cleanFileName = facture.fichier
          .replace(/\s+/g, "_")
          .replace(/[^a-zA-Z0-9._-]/g, "")
          .substring(0, 100);
        const fileName = `${timestamp}_${cleanFileName}`;
        const filePath = `factures-achats/${fileName}`;

        console.log("📤 Upload du fichier vers:", filePath);
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("factures")
          .upload(filePath, facture.fileObject, {
            contentType: "application/pdf",
          });

        if (uploadError) {
          console.error("❌ Erreur upload:", uploadError);
          throw new Error(`Erreur upload: ${uploadError.message}`);
        }
        console.log("✅ Fichier uploadé:", uploadData);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) {
          console.error("❌ Erreur récupération utilisateur:", userError);
          throw new Error(`Erreur utilisateur: ${userError.message}`);
        }
        console.log("👤 Utilisateur:", user?.email);

        let numeroFacture = facture.donnees.numero_facture;
        if (!numeroFacture) {
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
          const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
          numeroFacture = `FACHAT_${dateStr}_${timeStr}`;
        }

        const { data: existingFacture } = await supabase
          .from("factures")
          .select("numero_facture")
          .eq("numero_facture", numeroFacture)
          .maybeSingle();

        if (existingFacture) {
          console.error("❌ Numéro de facture déjà existant:", numeroFacture);
          throw new Error(`Impossible de sauvegarder car la facture "${numeroFacture}" existe déjà`);
        }

        // Utiliser l'ID corrélé ou déterminer le type de facture selon le type sélectionné
        let typeFacture = facture.typeFournisseur === "services" ? "ACHATS_SERVICES" : "ACHATS_GENERAUX";
        let emetteurType = facture.typeFournisseur === "services" ? "FOURNISSEUR_SERVICES" : "FOURNISSEUR_GENERAL";
        let emetteurId: string | null = facture.donnees.fournisseur_id || null;
        const fournisseurNom = facture.donnees.fournisseur || "";
        
        // Si pas d'ID corrélé, essayer de trouver le fournisseur dans la table correspondante
        if (!emetteurId && fournisseurNom) {
          const tableName = facture.typeFournisseur === "services" ? "fournisseurs_services" : "fournisseurs_generaux";
          const fournisseurNomLower = fournisseurNom.toLowerCase();
          
          const { data: fournisseursData } = await supabase
            .from(tableName)
            .select("id, raison_sociale");
          
          const fournisseurTrouve = fournisseursData?.find(f => 
            f.raison_sociale.toLowerCase().includes(fournisseurNomLower) ||
            fournisseurNomLower.includes(f.raison_sociale.toLowerCase())
          );
          
          if (fournisseurTrouve) {
            emetteurId = fournisseurTrouve.id;
            console.log(`🔍 Fournisseur ${facture.typeFournisseur} trouvé:`, fournisseurTrouve.raison_sociale);
          }
        }
        
        console.log(`📋 Type: ${typeFacture}, ID corrélé: ${emetteurId || 'aucun'}, Score: ${facture.donnees.fournisseur_score || 0}%`);

        // Récupérer la société interne pour le destinataire
        const { data: societeInterne } = await supabase
          .from("societe_interne")
          .select("*")
          .limit(1)
          .maybeSingle();

        const factureData: any = {
          numero_facture: numeroFacture,
          type_facture: typeFacture,
          date_emission: facture.donnees.date_facture || new Date().toISOString().split("T")[0],
          date_echeance: facture.donnees.date_facture || new Date().toISOString().split("T")[0],
          emetteur_type: emetteurType,
          emetteur_nom: facture.donnees.fournisseur || "Fournisseur inconnu",
          emetteur_id: emetteurId,
          // Destinataire = Société interne (Wavy services)
          destinataire_type: "SOCIETE_INTERNE",
          destinataire_id: societeInterne?.id || null,
          destinataire_nom: societeInterne?.raison_sociale || "Entreprise",
          destinataire_adresse: societeInterne?.adresse || "",
          destinataire_telephone: societeInterne?.telephone || "",
          destinataire_email: societeInterne?.email || "",
          total_ht: facture.donnees.montant_ht || 0,
          total_tva: facture.donnees.montant_tva || 0,
          total_ttc: facture.donnees.montant_ttc || 0,
          informations_paiement: facture.donnees.libelle,
          reference_societe: filePath,
          statut: "VALIDEE",
          created_by: user?.id,
        };

        console.log("💾 Insertion de la facture:", factureData);

        const { data: insertData, error: insertError } = await supabase.from("factures").insert(factureData).select();

        if (insertError) {
          console.error("❌ Erreur insertion:", insertError);
          throw new Error(`Erreur insertion: ${insertError.message} (${insertError.code})`);
        }

        console.log("✅ Facture insérée:", insertData);
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

      setFactures([]);
      onSuccess();
      onOpenChange(false);
    }
  };

  const handleEditFacture = (facture: FactureExtraite, index?: number) => {
    setSelectedFacture(facture);
    const factureIndex = index !== undefined ? index : factures.findIndex(f => f.id === facture.id);
    setSelectedFactureIndex(factureIndex);
    setEditedData({ ...facture.donnees, lignes: facture.donnees.lignes || [] });
  };

  const handleNavigatePrevious = () => {
    if (selectedFactureIndex > 0) {
      const prevIndex = selectedFactureIndex - 1;
      const prevFacture = factures[prevIndex];
      handleEditFacture(prevFacture, prevIndex);
    }
  };

  const handleNavigateNext = () => {
    if (selectedFactureIndex < factures.length - 1) {
      const nextIndex = selectedFactureIndex + 1;
      const nextFacture = factures[nextIndex];
      handleEditFacture(nextFacture, nextIndex);
    }
  };

  // Navigation vers l'erreur précédente
  const handleNavigateToPreviousError = () => {
    const errorsIndices = factures
      .map((f, i) => ({ index: i, hasError: !f.valide }))
      .filter((item) => item.hasError)
      .map((item) => item.index);

    if (errorsIndices.length === 0) return;

    // Si on édite actuellement une facture
    if (selectedFactureIndex >= 0) {
      const currentErrIdx = errorsIndices.findIndex((i) => i >= selectedFactureIndex);
      const prevErrIdx = currentErrIdx > 0 ? errorsIndices[currentErrIdx - 1] : errorsIndices[errorsIndices.length - 1];
      const prevFacture = factures[prevErrIdx];
      handleEditFacture(prevFacture, prevErrIdx);
    } else {
      // Aller à la dernière erreur
      const lastErrIdx = errorsIndices[errorsIndices.length - 1];
      const lastErrFacture = factures[lastErrIdx];
      handleEditFacture(lastErrFacture, lastErrIdx);
    }
  };

  // Navigation vers l'erreur suivante
  const handleNavigateToNextError = () => {
    const errorsIndices = factures
      .map((f, i) => ({ index: i, hasError: !f.valide }))
      .filter((item) => item.hasError)
      .map((item) => item.index);

    if (errorsIndices.length === 0) return;

    // Si on édite actuellement une facture
    if (selectedFactureIndex >= 0) {
      const nextErrIdx = errorsIndices.find((i) => i > selectedFactureIndex);
      if (nextErrIdx !== undefined) {
        const nextFacture = factures[nextErrIdx];
        handleEditFacture(nextFacture, nextErrIdx);
      } else {
        // Revenir à la première erreur
        const firstErrIdx = errorsIndices[0];
        const firstErrFacture = factures[firstErrIdx];
        handleEditFacture(firstErrFacture, firstErrIdx);
      }
    } else {
      // Aller à la première erreur
      const firstErrIdx = errorsIndices[0];
      const firstErrFacture = factures[firstErrIdx];
      handleEditFacture(firstErrFacture, firstErrIdx);
    }
  };

  // Navigation directe vers la première erreur (depuis la liste)
  const handleGoToFirstError = () => {
    const firstErrorIndex = factures.findIndex((f) => !f.valide);
    if (firstErrorIndex >= 0) {
      const errorFacture = factures[firstErrorIndex];
      handleEditFacture(errorFacture, firstErrorIndex);
    }
  };

  const handleSaveEdit = () => {
    if (!selectedFacture || !editedData) return;

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!editedData.fournisseur) errors.push("Fournisseur manquant");
    if (!editedData.montant_ttc) errors.push("Montant TTC manquant");
    if (!editedData.numero_facture) warnings.push("Numéro de facture sera généré automatiquement");

    const valide = errors.length === 0;
    const erreur = errors.length > 0 ? errors.join(", ") : warnings.length > 0 ? warnings.join(", ") : undefined;

    setFactures((prev) =>
      prev.map((f) => (f.id === selectedFacture.id ? { ...f, donnees: editedData, valide, erreur } : f)),
    );

    toast({
      title: "Données mises à jour",
      description: valide ? "Facture prête à être sauvegardée" : "Veuillez compléter les champs manquants",
    });

    setSelectedFacture(null);
    setEditedData(null);
  };

  const handleAddLigne = () => {
    if (!editedData) return;
    const nouvelleLigne: FactureLigne = {
      description: "",
      quantite: 1,
      prix_unitaire_ht: 0,
      prix_ht: 0,
      taux_tva: 20,
      prix_ttc: 0,
    };
    setEditedData({
      ...editedData,
      lignes: [...(editedData.lignes || []), nouvelleLigne],
    });
  };

  const handleUpdateLigne = (index: number, field: keyof FactureLigne, value: any) => {
    if (!editedData) return;
    const lignes = [...(editedData.lignes || [])];
    lignes[index] = { ...lignes[index], [field]: value };

    // Recalcul automatique
    if (field === "quantite" || field === "prix_unitaire_ht") {
      lignes[index].prix_ht = lignes[index].quantite * lignes[index].prix_unitaire_ht;
      lignes[index].prix_ttc = lignes[index].prix_ht * (1 + lignes[index].taux_tva / 100);
    } else if (field === "taux_tva" || field === "prix_ht") {
      lignes[index].prix_ttc = lignes[index].prix_ht * (1 + lignes[index].taux_tva / 100);
    }

    // Recalculer les totaux
    const montant_ht = lignes.reduce((sum, l) => sum + l.prix_ht, 0);
    const montant_ttc = lignes.reduce((sum, l) => sum + l.prix_ttc, 0);
    const montant_tva = montant_ttc - montant_ht;

    setEditedData({
      ...editedData,
      lignes,
      montant_ht,
      montant_ttc,
      montant_tva,
    });
  };

  const handleDeleteLigne = (index: number) => {
    if (!editedData) return;
    const lignes = [...(editedData.lignes || [])];
    lignes.splice(index, 1);

    // Recalculer les totaux
    const montant_ht = lignes.reduce((sum, l) => sum + l.prix_ht, 0);
    const montant_ttc = lignes.reduce((sum, l) => sum + l.prix_ttc, 0);
    const montant_tva = montant_ttc - montant_ht;

    setEditedData({
      ...editedData,
      lignes,
      montant_ht,
      montant_ttc,
      montant_tva,
    });
  };

  // Stats - Ne compter comme "erreurs" que les factures NON validées (erreurs bloquantes uniquement)
  const stats = {
    total: factures.length,
    valides: factures.filter((f) => f.valide).length,
    erreurs: factures.filter((f) => !f.valide).length, // Seulement les erreurs bloquantes (non validées)
    montantTotal: factures.reduce((acc, f) => acc + (f.donnees.montant_ttc || 0), 0),
    coutTotal: factures.reduce((acc, f) => acc + (f.cout_estime || 0), 0),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[95vh] overflow-hidden flex flex-col">
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

          <TabsContent value="extraction" className="flex-1 overflow-hidden flex flex-col space-y-3 mt-2">
            {/* Sélecteur du type de fournisseur */}
            <Card className="flex-shrink-0">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Label className="text-sm font-medium">Type de fournisseur :</Label>
                    <RadioGroup
                      value={typeFournisseur}
                      onValueChange={(value) => setTypeFournisseur(value as TypeFournisseur)}
                      className="flex gap-4"
                      disabled={isProcessing}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="services" id="services" />
                        <Label htmlFor="services" className="flex items-center gap-1 cursor-pointer">
                          <Briefcase className="h-4 w-4 text-blue-600" />
                          Services
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="generaux" id="generaux" />
                        <Label htmlFor="generaux" className="flex items-center gap-1 cursor-pointer">
                          <Building2 className="h-4 w-4 text-green-600" />
                          Généraux
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {isLoadingReferents ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Chargement...
                      </span>
                    ) : (
                      <Badge variant="secondary">
                        {fournisseursReferents.length} fournisseurs référents
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Zone d'upload compacte quand il y a des factures */}
            <Card className="flex-shrink-0">
              <CardContent className={factures.length > 0 ? "py-2" : "pt-6"}>
                <label className={`flex items-center justify-center w-full border-2 border-dashed rounded-lg cursor-pointer hover:border-primary hover:bg-accent transition-colors ${factures.length > 0 ? "h-12 flex-row gap-3" : "h-28 flex-col"}`}>
                  <Upload className={factures.length > 0 ? "h-5 w-5 text-muted-foreground" : "h-8 w-8 text-muted-foreground"} />
                  <p className="text-sm font-medium">
                    {isProcessing ? `Traitement... ${progress}%` : factures.length > 0 ? "Ajouter des factures PDF" : "Cliquez ou glissez vos factures PDF"}
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    disabled={isProcessing || isLoadingReferents}
                    className="hidden"
                  />
                </label>

                {isProcessing && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Loader2 className="animate-spin h-4 w-4" />
                        {currentFile}
                      </span>
                      <span className="text-muted-foreground">{progress}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                      <div className="bg-primary h-1.5 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {factures.length > 0 && (
              <div className="grid grid-cols-5 gap-2 flex-shrink-0">
                <Card className="py-2">
                  <CardContent className="p-2 text-center">
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="text-xl font-bold">{stats.total}</div>
                  </CardContent>
                </Card>
                <Card className="py-2">
                  <CardContent className="p-2 text-center">
                    <div className="text-xs text-muted-foreground">Validées</div>
                    <div className="text-xl font-bold text-green-600">{stats.valides}</div>
                  </CardContent>
                </Card>
                <Card 
                  className={`py-2 ${stats.erreurs > 0 ? "cursor-pointer hover:border-red-400 transition-colors" : ""}`}
                  onClick={stats.erreurs > 0 ? handleGoToFirstError : undefined}
                >
                  <CardContent className="p-2 text-center">
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      Erreurs
                      {stats.erreurs > 0 && <AlertTriangle className="h-3 w-3 text-red-600" />}
                    </div>
                    <div className="text-xl font-bold text-red-600">{stats.erreurs}</div>
                  </CardContent>
                </Card>
                <Card className="py-2">
                  <CardContent className="p-2 text-center">
                    <div className="text-xs text-muted-foreground">Montant</div>
                    <div className="text-lg font-bold">
                      {new Intl.NumberFormat("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 0,
                      }).format(stats.montantTotal)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="py-2">
                  <CardContent className="p-2 text-center">
                    <div className="text-xs text-muted-foreground">Coût IA</div>
                    <div className="text-lg font-bold text-purple-600">${(stats.coutTotal * 100).toFixed(3)}¢</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {factures.length > 0 && (
              <div className="flex-1 flex flex-col min-h-0 border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 p-2 bg-muted/50 font-semibold text-xs border-b flex-shrink-0">
                  <div className="col-span-1 flex items-center justify-center">Statut</div>
                  <div className="col-span-3">Fichier</div>
                  <div className="col-span-2">Fournisseur</div>
                  <div className="col-span-2">N° Facture</div>
                  <div className="col-span-1">Montant TTC</div>
                  <div className="col-span-1">Date</div>
                  <div className="col-span-2 text-center">Actions</div>
                </div>

                <ScrollArea className="flex-1">
                    <div className="divide-y">
                      {factures.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((facture, indexInSlice) => {
                        const actualIndex = (currentPage - 1) * itemsPerPage + indexInSlice;
                        return (
                        <div
                          key={facture.id}
                          className={`grid grid-cols-12 gap-2 p-3 hover:bg-muted/30 transition-colors ${
                            facture.valide ? "bg-green-50/30" : "bg-red-50/30"
                          }`}
                        >
                          <div className="col-span-1 flex items-center justify-center">
                            {facture.valide ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                          </div>

                          <div className="col-span-3 flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <span className="text-sm font-medium truncate" title={facture.fichier}>
                              {facture.fichier}
                            </span>
                          </div>

                          <div className="col-span-2 flex items-center gap-1 min-w-0">
                            <span
                              className={`text-sm truncate ${!facture.donnees.fournisseur ? "text-red-600 font-semibold" : ""}`}
                              title={`${facture.donnees.fournisseur || "Fournisseur manquant"}${facture.donnees.fournisseur_score ? ` (score: ${facture.donnees.fournisseur_score}%)` : ""}`}
                            >
                              {facture.donnees.fournisseur || "⚠ Manquant"}
                            </span>
                            {facture.donnees.fournisseur_id && facture.donnees.fournisseur_score && facture.donnees.fournisseur_score >= 70 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-green-50 text-green-700 border-green-200">
                                ✓ {facture.donnees.fournisseur_score}%
                              </Badge>
                            )}
                            {facture.donnees.fournisseur && !facture.donnees.fournisseur_id && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">
                                ?
                              </Badge>
                            )}
                          </div>

                          <div className="col-span-2 flex items-center min-w-0">
                            <span
                              className={`text-sm truncate ${!facture.donnees.numero_facture ? "text-amber-600 italic" : ""}`}
                              title={facture.donnees.numero_facture || "Sera généré automatiquement"}
                            >
                              {facture.donnees.numero_facture || "🔄 Auto"}
                            </span>
                          </div>

                          <div className="col-span-1 flex items-center">
                            <span
                              className={`text-sm font-semibold ${
                                !facture.donnees.montant_ttc ? "text-red-600" : "text-green-600"
                              }`}
                              title={facture.donnees.montant_ttc ? undefined : "Montant manquant"}
                            >
                              {facture.donnees.montant_ttc
                                ? new Intl.NumberFormat("fr-FR", {
                                    style: "currency",
                                    currency: "EUR",
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  }).format(facture.donnees.montant_ttc)
                                : "⚠"}
                            </span>
                          </div>

                          <div className="col-span-1 flex items-center">
                            <span className="text-sm" title={facture.donnees.date_facture || undefined}>
                              {facture.donnees.date_facture || "-"}
                            </span>
                          </div>

                          <div className="col-span-2 flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                const url = URL.createObjectURL(facture.fileObject);
                                const a = document.createElement("a");
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
                                window.open(url, "_blank");
                              }}
                              title="Voir le PDF"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditFacture(facture, actualIndex)}
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
                      );
                    })}
                    </div>
                  </ScrollArea>

                  {factures.length > itemsPerPage && (
                    <div className="flex items-center justify-between px-2 py-2 border-t flex-shrink-0">
                      <div className="text-xs text-muted-foreground">
                        Page {currentPage} sur {Math.ceil(factures.length / itemsPerPage)} • {factures.length} facture
                        {factures.length > 1 ? "s" : ""}
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
                          onClick={() =>
                            setCurrentPage((prev) => Math.min(Math.ceil(factures.length / itemsPerPage), prev + 1))
                          }
                          disabled={currentPage === Math.ceil(factures.length / itemsPerPage)}
                        >
                          Suivant
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
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
                    rows={18}
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

        {selectedFacture && editedData && (
          <Dialog
            open={!!selectedFacture}
            onOpenChange={() => {
              setSelectedFacture(null);
              setEditedData(null);
            }}
          >
            <DialogContent className="max-w-6xl max-h-[90vh]">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle>Éditer la facture et les lignes</DialogTitle>
                    <DialogDescription>{selectedFacture.fichier}</DialogDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Navigation vers les erreurs */}
                    {stats.erreurs > 0 && (
                      <div className="flex items-center gap-1 border-r pr-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleNavigateToPreviousError}
                          title="Erreur précédente"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <SkipBack className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-red-600 font-medium px-1">
                          {stats.erreurs} erreur{stats.erreurs > 1 ? "s" : ""}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleNavigateToNextError}
                          title="Erreur suivante"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <SkipForward className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    {/* Navigation standard */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNavigatePrevious}
                        disabled={selectedFactureIndex <= 0}
                        title="Facture précédente"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {selectedFactureIndex + 1} / {factures.length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNavigateNext}
                        disabled={selectedFactureIndex >= factures.length - 1}
                        title="Facture suivante"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="h-[calc(90vh-180px)] pr-4">
                <div className="space-y-6">
                  {/* Erreurs */}
                  {selectedFacture.erreur && (
                    <div
                      className={`p-3 rounded-lg ${selectedFacture.valide ? "bg-amber-50 border border-amber-200" : "bg-red-50 border border-red-200"}`}
                    >
                      <p
                        className={`text-sm font-semibold mb-1 ${selectedFacture.valide ? "text-amber-700" : "text-red-700"}`}
                      >
                        {selectedFacture.valide ? "⚠ Attention" : "❌ Erreurs à corriger"}
                      </p>
                      <p className={`text-sm ${selectedFacture.valide ? "text-amber-600" : "text-red-600"}`}>
                        {selectedFacture.erreur}
                      </p>
                    </div>
                  )}

                  {/* Informations générales */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-base">Informations générales</h3>
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
                          placeholder="Numéro de facture"
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

                      <div className="col-span-2">
                        <Label htmlFor="edit-libelle">Libellé</Label>
                        <Input
                          id="edit-libelle"
                          value={editedData.libelle || ""}
                          onChange={(e) => setEditedData({ ...editedData, libelle: e.target.value })}
                          placeholder="Description de la facture"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Lignes de facture */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-base">Lignes de facture</h3>
                      <Button onClick={handleAddLigne} size="sm" variant="outline">
                        Ajouter une ligne
                      </Button>
                    </div>

                    {(!editedData.lignes || editedData.lignes.length === 0) && (
                      <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                        Aucune ligne de facture. Cliquez sur "Ajouter une ligne" pour commencer.
                      </div>
                    )}

                    {editedData.lignes && editedData.lignes.length > 0 && (
                      <div className="space-y-3">
                        {editedData.lignes.map((ligne, index) => (
                          <Card key={index} className="bg-muted/30">
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <Label className="text-xs mb-1">Description</Label>
                                    <Input
                                      value={ligne.description}
                                      onChange={(e) => handleUpdateLigne(index, "description", e.target.value)}
                                      placeholder="Description de la prestation"
                                      className="text-sm"
                                    />
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 mt-5"
                                    onClick={() => handleDeleteLigne(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                  <div>
                                    <Label className="text-xs mb-1">Qté</Label>
                                    <Input
                                      type="number"
                                      value={ligne.quantite}
                                      onChange={(e) =>
                                        handleUpdateLigne(index, "quantite", parseFloat(e.target.value) || 0)
                                      }
                                      step="0.01"
                                      className="text-sm"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs mb-1">P.U. HT</Label>
                                    <Input
                                      type="number"
                                      value={ligne.prix_unitaire_ht}
                                      onChange={(e) =>
                                        handleUpdateLigne(index, "prix_unitaire_ht", parseFloat(e.target.value) || 0)
                                      }
                                      step="0.01"
                                      className="text-sm"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs mb-1">Prix HT</Label>
                                    <Input
                                      type="number"
                                      value={ligne.prix_ht.toFixed(2)}
                                      disabled
                                      className="text-sm bg-muted"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs mb-1">TVA %</Label>
                                    <Input
                                      type="number"
                                      value={ligne.taux_tva}
                                      onChange={(e) =>
                                        handleUpdateLigne(index, "taux_tva", parseFloat(e.target.value) || 0)
                                      }
                                      step="0.01"
                                      className="text-sm"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs mb-1">Prix TTC</Label>
                                    <Input
                                      type="number"
                                      value={ligne.prix_ttc.toFixed(2)}
                                      disabled
                                      className="text-sm bg-muted font-semibold"
                                    />
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Totaux */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-semibold text-base">Totaux</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="edit-ht">Montant HT</Label>
                        <Input
                          id="edit-ht"
                          type="number"
                          value={editedData.montant_ht || 0}
                          onChange={(e) => setEditedData({ ...editedData, montant_ht: parseFloat(e.target.value) || 0 })}
                          step="0.01"
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-tva">Montant TVA</Label>
                        <Input
                          id="edit-tva"
                          type="number"
                          value={editedData.montant_tva || 0}
                          onChange={(e) =>
                            setEditedData({ ...editedData, montant_tva: parseFloat(e.target.value) || 0 })
                          }
                          step="0.01"
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-ttc" className={!editedData.montant_ttc ? "text-red-600" : ""}>
                          Montant TTC {!editedData.montant_ttc && <span className="text-red-600">*</span>}
                        </Label>
                        <Input
                          id="edit-ttc"
                          type="number"
                          value={editedData.montant_ttc || 0}
                          onChange={(e) =>
                            setEditedData({ ...editedData, montant_ttc: parseFloat(e.target.value) || 0 })
                          }
                          step="0.01"
                          className={`font-semibold ${!editedData.montant_ttc ? "border-red-300" : ""}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedFacture(null);
                    setEditedData(null);
                  }}
                >
                  Annuler
                </Button>
                <Button onClick={handleSaveEdit}>Enregistrer les modifications</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
