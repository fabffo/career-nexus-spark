import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface TypeImpot {
  id: string;
  libelle: string;
}

interface AddEcheanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultDate?: Date;
}

export default function AddEcheanceDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultDate,
}: AddEcheanceDialogProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [typesImpots, setTypesImpots] = useState<TypeImpot[]>([]);
  const [formData, setFormData] = useState({
    type_impot_id: "",
    libelle: "",
    description: "",
    date_echeance: defaultDate || new Date(),
    montant_estime: "",
  });

  useEffect(() => {
    if (open) {
      loadTypesImpots();
    }
  }, [open]);

  useEffect(() => {
    if (defaultDate) {
      setFormData(prev => ({ ...prev, date_echeance: defaultDate }));
    }
  }, [defaultDate]);

  const loadTypesImpots = async () => {
    try {
      const { data, error } = await supabase
        .from("types_impots")
        .select("id, libelle")
        .eq("is_active", true)
        .order("ordre");

      if (error) throw error;
      setTypesImpots(data);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des types d'impôts");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("echeances_fiscales").insert({
        type_impot_id: formData.type_impot_id,
        libelle: formData.libelle,
        description: formData.description || null,
        date_echeance: format(formData.date_echeance, "yyyy-MM-dd"),
        montant_estime: parseFloat(formData.montant_estime) || 0,
        created_by: profile?.id,
        statut: "A_PAYER",
      });

      if (error) throw error;

      toast.success("Échéance ajoutée avec succès");
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'ajout de l'échéance");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      type_impot_id: "",
      libelle: "",
      description: "",
      date_echeance: defaultDate || new Date(),
      montant_estime: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une échéance fiscale</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type_impot_id">Type d'impôt *</Label>
            <Select
              value={formData.type_impot_id}
              onValueChange={(value) =>
                setFormData({ ...formData, type_impot_id: value })
              }
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                {typesImpots.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="libelle">Libellé *</Label>
            <Input
              id="libelle"
              value={formData.libelle}
              onChange={(e) =>
                setFormData({ ...formData, libelle: e.target.value })
              }
              required
              placeholder="Ex: TVA Janvier 2025"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Détails complémentaires..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Date d'échéance *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(formData.date_echeance, "dd MMMM yyyy", { locale: fr })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.date_echeance}
                  onSelect={(date) =>
                    date && setFormData({ ...formData, date_echeance: date })
                  }
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="montant_estime">Montant estimé (€) *</Label>
            <Input
              id="montant_estime"
              type="number"
              step="0.01"
              value={formData.montant_estime}
              onChange={(e) =>
                setFormData({ ...formData, montant_estime: e.target.value })
              }
              required
              placeholder="0.00"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Ajout..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
