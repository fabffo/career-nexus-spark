import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RapprochementSearchSection } from "@/components/RapprochementSearchSection";
import { MatchingHistorySection } from "@/components/MatchingHistorySection";

interface EditDeclarationChargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  declaration: any;
}

export default function EditDeclarationChargeDialog({ 
  open, 
  onOpenChange, 
  declaration 
}: EditDeclarationChargeDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    nom: "",
    organisme: "",
    type_charge: "CHARGES_SOCIALES",
    periodicite: "MENSUEL",
    montant_estime: "",
    jour_echeance: "",
    notes: "",
    mots_cles_rapprochement: ""
  });

  useEffect(() => {
    if (declaration) {
      const defaultKeywords = declaration.nom;
      setFormData({
        nom: declaration.nom || "",
        organisme: declaration.organisme || "",
        type_charge: declaration.type_charge || "CHARGES_SOCIALES",
        periodicite: declaration.periodicite || "MENSUEL",
        montant_estime: declaration.montant_estime?.toString() || "",
        jour_echeance: declaration.jour_echeance?.toString() || "",
        notes: declaration.notes || "",
        mots_cles_rapprochement: declaration.mots_cles_rapprochement || defaultKeywords
      });
    }
  }, [declaration]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('declarations_charges_sociales')
        .update({
          ...data,
          montant_estime: data.montant_estime ? parseFloat(data.montant_estime) : null,
          jour_echeance: data.jour_echeance ? parseInt(data.jour_echeance) : null
        })
        .eq('id', declaration.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['declarations-charges-sociales'] });
      toast.success("Déclaration mise à jour");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error updating declaration:', error);
      toast.error("Erreur lors de la mise à jour");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier la déclaration</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom *</Label>
              <Input
                id="nom"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organisme">Organisme *</Label>
              <Input
                id="organisme"
                value={formData.organisme}
                onChange={(e) => setFormData({ ...formData, organisme: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type_charge">Type de charge *</Label>
              <Select
                value={formData.type_charge}
                onValueChange={(value) => setFormData({ ...formData, type_charge: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SALAIRE">Salaire</SelectItem>
                  <SelectItem value="CHARGES_SOCIALES">Charges sociales</SelectItem>
                  <SelectItem value="RETRAITE">Retraite</SelectItem>
                  <SelectItem value="MUTUELLE">Mutuelle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="periodicite">Périodicité *</Label>
              <Select
                value={formData.periodicite}
                onValueChange={(value) => setFormData({ ...formData, periodicite: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MENSUEL">Mensuel</SelectItem>
                  <SelectItem value="TRIMESTRIEL">Trimestriel</SelectItem>
                  <SelectItem value="ANNUEL">Annuel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="montant_estime">Montant estimé (€)</Label>
              <Input
                id="montant_estime"
                type="number"
                step="0.01"
                value={formData.montant_estime}
                onChange={(e) => setFormData({ ...formData, montant_estime: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jour_echeance">Jour d'échéance</Label>
              <Input
                id="jour_echeance"
                type="number"
                min="1"
                max="31"
                value={formData.jour_echeance}
                onChange={(e) => setFormData({ ...formData, jour_echeance: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mots_cles_rapprochement">Mots-clés de rapprochement bancaire</Label>
            <Input
              id="mots_cles_rapprochement"
              value={formData.mots_cles_rapprochement}
              onChange={(e) => setFormData({ ...formData, mots_cles_rapprochement: e.target.value })}
              placeholder="Ex: URSSAF ou URSSAF, CPAM"
            />
            <p className="text-xs text-muted-foreground">
              <strong>Syntaxe :</strong> Espace = ET (tous les mots), Virgule = OU (l'un ou l'autre)
            </p>
          </div>

          {/* Rapprochement sections */}
          {declaration && (
            <>
              <RapprochementSearchSection 
                entityType="declaration"
                entityId={declaration.id}
                entityName={declaration.nom}
                savedKeywords={formData.mots_cles_rapprochement}
              />
              <MatchingHistorySection 
                entityType="declaration"
                entityId={declaration.id}
                entityName={declaration.nom}
              />
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Mise à jour..." : "Mettre à jour"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
