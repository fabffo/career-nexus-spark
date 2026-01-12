import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PARTENAIRE_TYPES = [
  { value: "salarie", label: "Salarié" },
  { value: "fournisseur_etat", label: "Fournisseur État & organismes" },
];

interface AddDeclarationChargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddDeclarationChargeDialog({ open, onOpenChange }: AddDeclarationChargeDialogProps) {
  const queryClient = useQueryClient();
  const [partenaireType, setPartenaireType] = useState<string | null>(null);
  const [partenaireId, setPartenaireId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nom: "",
    organisme: "",
    type_charge: "CHARGES_SOCIALES",
    periodicite: "MENSUEL",
    montant_estime: "",
    jour_echeance: "",
    notes: ""
  });

  // Fetch partenaires based on type
  const { data: partenaires = [] } = useQuery({
    queryKey: ['partenaires-declaration', partenaireType],
    queryFn: async () => {
      if (!partenaireType) return [];
      
      if (partenaireType === 'salarie') {
        const { data, error } = await supabase
          .from('salaries')
          .select('id, nom, prenom')
          .order('nom');
        if (error) throw error;
        return (data || []).map(s => ({ id: s.id, label: `${s.prenom} ${s.nom}` }));
      } else if (partenaireType === 'fournisseur_etat') {
        const { data, error } = await supabase
          .from('fournisseurs_etat_organismes')
          .select('id, raison_sociale')
          .order('raison_sociale');
        if (error) throw error;
        return (data || []).map(f => ({ id: f.id, label: f.raison_sociale }));
      }
      return [];
    },
    enabled: !!partenaireType
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { error } = await supabase
        .from('declarations_charges_sociales')
        .insert({
          ...data,
          montant_estime: data.montant_estime ? parseFloat(data.montant_estime) : null,
          jour_echeance: data.jour_echeance ? parseInt(data.jour_echeance) : null,
          partenaire_type: partenaireType,
          partenaire_id: partenaireId,
          created_by: user.id
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['declarations-charges-sociales'] });
      toast.success("Déclaration créée");
      onOpenChange(false);
      setFormData({
        nom: "",
        organisme: "",
        type_charge: "CHARGES_SOCIALES",
        periodicite: "MENSUEL",
        montant_estime: "",
        jour_echeance: "",
        notes: ""
      });
      setPartenaireType(null);
      setPartenaireId(null);
    },
    onError: (error) => {
      console.error('Error creating declaration:', error);
      toast.error("Erreur lors de la création");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvelle déclaration de charges sociales</DialogTitle>
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
                placeholder="URSSAF, Retraite, Mutuelle..."
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
              <Label>Type de partenaire</Label>
              <Select
                value={partenaireType || "none"}
                onValueChange={(value) => {
                  setPartenaireType(value === "none" ? null : value);
                  setPartenaireId(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {PARTENAIRE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Partenaire</Label>
              <Select
                value={partenaireId || "none"}
                onValueChange={(value) => setPartenaireId(value === "none" ? null : value)}
                disabled={!partenaireType}
              >
                <SelectTrigger>
                  <SelectValue placeholder={partenaireType ? "Sélectionner" : "Choisir un type d'abord"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {partenaires.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
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
                placeholder="Ex: 15"
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
