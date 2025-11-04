import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface AddRegleRapprochementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const typeRegles = [
  { value: "MONTANT", label: "Montant" },
  { value: "DATE", label: "Date" },
  { value: "LIBELLE", label: "Libellé" },
  { value: "TYPE_TRANSACTION", label: "Type de transaction" },
  { value: "PARTENAIRE", label: "Partenaire" },
  { value: "PERSONNALISEE", label: "Fournisseur Mensuel (Mois/Année)" },
  { value: "ABONNEMENT", label: "Abonnement partenaire" },
  { value: "DECLARATION_CHARGE", label: "Déclaration de charges" },
];

export default function AddRegleRapprochementDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddRegleRapprochementDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [nom, setNom] = useState("");
  const [typeRegle, setTypeRegle] = useState<string>("");
  const [description, setDescription] = useState("");
  const [scoreAttribue, setScoreAttribue] = useState("10");
  const [priorite, setPriorite] = useState("10");
  const [conditionJson, setConditionJson] = useState("{}");
  const [selectedAbonnementId, setSelectedAbonnementId] = useState<string>("");
  const [keywords, setKeywords] = useState<string>("");
  const [fournisseurNom, setFournisseurNom] = useState("");
  const [tolerance, setTolerance] = useState("0.01");
  const [memeMois, setMemeMois] = useState(true);

  // Charger les abonnements
  const { data: abonnements } = useQuery({
    queryKey: ["abonnements-actifs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("abonnements_partenaires")
        .select("*")
        .eq("actif", true)
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  // Charger les déclarations de charges
  const { data: declarations } = useQuery({
    queryKey: ["declarations-charges-actives"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("declarations_charges_sociales")
        .select("*")
        .eq("actif", true)
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async () => {
    if (!nom || !typeRegle) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    const score = parseInt(scoreAttribue);
    if (isNaN(score) || score < 0 || score > 100) {
      toast({
        title: "Erreur",
        description: "Le score doit être entre 0 et 100",
        variant: "destructive",
      });
      return;
    }

    // Construire le condition_json selon le type de règle
    let finalConditionJson: any = {};
    
    // Si PERSONNALISEE avec un nom de fournisseur = règle fournisseur mensuel
    if (typeRegle === "PERSONNALISEE" && fournisseurNom && fournisseurNom.trim() !== "") {
      const toleranceNum = parseFloat(tolerance);
      if (isNaN(toleranceNum) || toleranceNum < 0) {
        toast({
          title: "Erreur",
          description: "La tolérance doit être un nombre positif",
          variant: "destructive",
        });
        return;
      }
      
      finalConditionJson = {
        type_interne: "FOURNISSEUR_MENSUEL",
        fournisseur_nom: fournisseurNom.trim(),
        keywords: keywords.split(",").map(k => k.trim()).filter(k => k),
        tolerance: toleranceNum,
        meme_mois: memeMois === true,
      };
      
      console.log("📋 FOURNISSEUR_MENSUEL - Condition JSON:", finalConditionJson);
    } else if (typeRegle === "ABONNEMENT") {
      finalConditionJson = {
        keywords: keywords.split(",").map(k => k.trim()).filter(k => k),
      };
      if (selectedAbonnementId) {
        finalConditionJson.abonnement_id = selectedAbonnementId;
      }
    } else if (typeRegle === "DECLARATION_CHARGE") {
      finalConditionJson = {
        keywords: keywords.split(",").map(k => k.trim()).filter(k => k),
      };
      if (selectedAbonnementId) {
        finalConditionJson.declaration_charge_id = selectedAbonnementId;
      }
    } else {
      // Pour les autres types, utiliser le JSON brut
      try {
        finalConditionJson = JSON.parse(conditionJson);
      } catch (e) {
        toast({
          title: "Erreur",
          description: "Le JSON des conditions est invalide",
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      console.log("📤 Envoi de la règle:", {
        nom,
        type_regle: typeRegle,
        description,
        condition_json: finalConditionJson,
        score_attribue: score,
        priorite: parseInt(priorite),
        actif: true,
      });

      // Déterminer le type réel à enregistrer en base
let typeRegleDB = typeRegle;

// Si c'est un fournisseur mensuel, forcer le type à "PERSONNALISEE" pour la BD
if (typeRegle === "PERSONNALISEE" && finalConditionJson.type_interne === "FOURNISSEUR_MENSUEL") {
  typeRegleDB = "PERSONNALISEE";
  console.log("🔧 Conversion type: Fournisseur Mensuel → PERSONNALISEE pour la BD");
}

const { error } = await supabase
  .from("regles_rapprochement")
  .insert({
    nom,
    type_regle: typeRegleDB, // ⭐ Utiliser le type converti
    description: description || null,
    condition_json: finalConditionJson,
    score_attribue: score,
    priorite: parseInt(priorite),
    actif: true,
    created_by: user?.id,
  });

      if (error) {
        console.error("❌ Erreur Supabase:", error);
        console.error("❌ Détails erreur:", JSON.stringify(error, null, 2));
        throw error;
      }

      toast({
        title: "Succès",
        description: "La règle a été créée avec succès",
      });

      // Reset form
      setNom("");
      setTypeRegle("");
      setDescription("");
      setScoreAttribue("10");
      setPriorite("10");
      setConditionJson("{}");
      setSelectedAbonnementId("");
      setKeywords("");
      setFournisseurNom("");
      setTolerance("0.01");
      setMemeMois(true);

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erreur:", error);
      const errorMessage = error?.message || error?.hint || "Impossible de créer la règle";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter une règle de rapprochement</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="nom">Nom de la règle *</Label>
            <Input
              id="nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex: LinkedIn - Facture mensuelle"
            />
          </div>

          <div>
            <Label htmlFor="type">Type de règle *</Label>
            <Select value={typeRegle} onValueChange={setTypeRegle}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                {typeRegles.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrire le fonctionnement de cette règle"
              rows={3}
            />
          </div>

          {typeRegle === "PERSONNALISEE" && (
            <>
              <div>
                <Label htmlFor="fournisseur">Nom du fournisseur (pour mode Fournisseur Mensuel)</Label>
                <Input
                  id="fournisseur"
                  value={fournisseurNom}
                  onChange={(e) => setFournisseurNom(e.target.value)}
                  placeholder="Ex: LINKEDIN, EDF, Orange"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Remplissez ce champ pour activer le mode Fournisseur Mensuel (mois/année + montant exact)
                </p>
              </div>

              {fournisseurNom && fournisseurNom.trim() !== "" && (
                <>
                  <div>
                    <Label htmlFor="keywords-fournisseur">Mots-clés additionnels (optionnel)</Label>
                    <Input
                      id="keywords-fournisseur"
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="Ex: FACTURE, PRELEVEMENT, RECRUTE"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Mots-clés à rechercher en plus du nom (séparés par des virgules)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="tolerance">Tolérance de montant (€)</Label>
                    <Input
                      id="tolerance"
                      type="number"
                      step="0.01"
                      min="0"
                      value={tolerance}
                      onChange={(e) => setTolerance(e.target.value)}
                      placeholder="0.01"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Différence maximale acceptée entre le montant de la transaction et de la facture
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/30">
                    <input
                      type="checkbox"
                      id="memeMois"
                      checked={memeMois}
                      onChange={(e) => setMemeMois(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="memeMois" className="cursor-pointer font-normal">
                      Vérifier que la facture est du même mois/année que la transaction
                    </Label>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>💡 Mode Fournisseur Mensuel activé !</strong> Cette règle vérifiera :
                    </p>
                    <ul className="text-sm text-blue-700 mt-2 ml-4 list-disc space-y-1">
                      <li>Le nom du fournisseur "{fournisseurNom}" apparaît dans le libellé</li>
                      <li>Le montant correspond (avec tolérance de {tolerance}€)</li>
                      <li>La facture est du même mois/année que la transaction</li>
                    </ul>
                  </div>
                </>
              )}

              {(!fournisseurNom || fournisseurNom.trim() === "") && (
                <div>
                  <Label htmlFor="condition">Conditions (JSON personnalisées)</Label>
                  <Textarea
                    id="condition"
                    value={conditionJson}
                    onChange={(e) => setConditionJson(e.target.value)}
                    placeholder='{"tolerance": 0.01, "keywords": ["facture", "paiement"]}'
                    rows={4}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Configuration JSON pour les paramètres de la règle personnalisée
                  </p>
                </div>
              )}
            </>
          )}

          {typeRegle === "ABONNEMENT" && (
            <>
              <div>
                <Label htmlFor="abonnement">Abonnement (optionnel)</Label>
                <Select value={selectedAbonnementId || undefined} onValueChange={setSelectedAbonnementId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les abonnements" />
                  </SelectTrigger>
                  <SelectContent>
                    {abonnements?.map((abo) => (
                      <SelectItem key={abo.id} value={abo.id}>
                        {abo.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Laisser vide pour tester tous les abonnements
                </p>
              </div>

              <div>
                <Label htmlFor="keywords">Mots-clés (séparés par des virgules)</Label>
                <Input
                  id="keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Ex: MMA IARD, 2456510036320241226526059501"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Recherchés dans le libellé de la transaction
                </p>
              </div>
            </>
          )}

          {typeRegle === "DECLARATION_CHARGE" && (
            <>
              <div>
                <Label htmlFor="declaration">Déclaration (optionnel)</Label>
                <Select value={selectedAbonnementId || undefined} onValueChange={setSelectedAbonnementId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes les déclarations" />
                  </SelectTrigger>
                  <SelectContent>
                    {declarations?.map((decl) => (
                      <SelectItem key={decl.id} value={decl.id}>
                        {decl.nom} - {decl.organisme}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Laisser vide pour tester toutes les déclarations
                </p>
              </div>

              <div>
                <Label htmlFor="keywords-declaration">Mots-clés (séparés par des virgules)</Label>
                <Input
                  id="keywords-declaration"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Ex: URSSAF, Retraite"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Recherchés dans le libellé de la transaction
                </p>
              </div>
            </>
          )}

          {typeRegle !== "ABONNEMENT" && typeRegle !== "DECLARATION_CHARGE" && typeRegle !== "PERSONNALISEE" && (
            <div>
              <Label htmlFor="condition">Conditions (JSON)</Label>
              <Textarea
                id="condition"
                value={conditionJson}
                onChange={(e) => setConditionJson(e.target.value)}
                placeholder='{"tolerance": 0.01, "keywords": ["facture", "paiement"]}'
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Configuration JSON pour les paramètres de la règle
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="score">Score attribué (0-100) *</Label>
              <Input
                id="score"
                type="number"
                min="0"
                max="100"
                value={scoreAttribue}
                onChange={(e) => setScoreAttribue(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="priorite">Priorité</Label>
              <Input
                id="priorite"
                type="number"
                value={priorite}
                onChange={(e) => setPriorite(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Plus la valeur est faible, plus la priorité est élevée
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer la règle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}