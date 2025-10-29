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
  { value: "ABONNEMENT", label: "Abonnement partenaire" },
  { value: "DECLARATION_CHARGE", label: "Déclaration de charges" },
  { value: "PERSONNALISEE", label: "Personnalisée" },
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
    
    if (typeRegle === "ABONNEMENT") {
      finalConditionJson = {
        keywords: keywords.split(",").map(k => k.trim()).filter(k => k),
      };
      if (selectedAbonnementId) {
        finalConditionJson.abonnement_id = selectedAbonnementId;
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

      const { error } = await supabase
        .from("regles_rapprochement")
        .insert({
          nom,
          type_regle: typeRegle,
          description,
          condition_json: finalConditionJson,
          score_attribue: score,
          priorite: parseInt(priorite),
          actif: true,
          created_by: user?.id,
        });

      if (error) throw error;

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

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erreur:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la règle",
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
              placeholder="Ex: Correspondance numéro de commande"
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

          {typeRegle !== "ABONNEMENT" && (
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
