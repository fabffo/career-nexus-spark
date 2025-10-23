import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface TypeImpot {
  id: string;
  code: string;
  libelle: string;
  couleur: string;
}

interface Echeance {
  id: string;
  libelle: string;
  description: string | null;
  date_echeance: string;
  montant_estime: number;
  montant_paye: number | null;
  statut: string;
  date_paiement: string | null;
  notes: string | null;
  type_impot: TypeImpot;
}

interface EcheanceDetailsDialogProps {
  echeance: Echeance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function EcheanceDetailsDialog({
  echeance,
  open,
  onOpenChange,
  onSuccess,
}: EcheanceDetailsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    statut: echeance.statut,
    montant_paye: echeance.montant_paye?.toString() || "",
    date_paiement: echeance.date_paiement ? new Date(echeance.date_paiement) : null,
    notes: echeance.notes || "",
  });

  const handleUpdate = async () => {
    setLoading(true);

    try {
      const updateData: any = {
        statut: formData.statut,
        notes: formData.notes || null,
      };

      if (formData.statut === "PAYE") {
        updateData.montant_paye = parseFloat(formData.montant_paye) || echeance.montant_estime;
        updateData.date_paiement = formData.date_paiement 
          ? format(formData.date_paiement, "yyyy-MM-dd")
          : format(new Date(), "yyyy-MM-dd");
      }

      const { error } = await supabase
        .from("echeances_fiscales")
        .update(updateData)
        .eq("id", echeance.id);

      if (error) throw error;

      toast.success("Échéance mise à jour");
      onSuccess();
      setEditing(false);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette échéance ?")) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("echeances_fiscales")
        .delete()
        .eq("id", echeance.id);

      if (error) throw error;

      toast.success("Échéance supprimée");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setLoading(false);
    }
  };

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case "PAYE":
        return <Badge className="bg-green-600">Payé</Badge>;
      case "RETARD":
        return <Badge variant="destructive">En retard</Badge>;
      case "A_PAYER":
        return <Badge variant="secondary">À payer</Badge>;
      default:
        return <Badge variant="outline">{statut}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: echeance.type_impot.couleur }}
            />
            <DialogTitle>{echeance.libelle}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline">{echeance.type_impot.libelle}</Badge>
            {!editing && getStatutBadge(echeance.statut)}
          </div>

          {echeance.description && (
            <div>
              <Label>Description</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {echeance.description}
              </p>
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date d'échéance</Label>
              <p className="text-sm font-medium mt-1">
                {format(new Date(echeance.date_echeance), "dd MMMM yyyy", { locale: fr })}
              </p>
            </div>
            <div>
              <Label>Montant estimé</Label>
              <p className="text-sm font-medium mt-1">
                {echeance.montant_estime.toLocaleString("fr-FR")} €
              </p>
            </div>
          </div>

          {editing ? (
            <>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select
                  value={formData.statut}
                  onValueChange={(value) =>
                    setFormData({ ...formData, statut: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A_PAYER">À payer</SelectItem>
                    <SelectItem value="PAYE">Payé</SelectItem>
                    <SelectItem value="RETARD">En retard</SelectItem>
                    <SelectItem value="ANNULE">Annulé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.statut === "PAYE" && (
                <>
                  <div className="space-y-2">
                    <Label>Montant payé (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.montant_paye}
                      onChange={(e) =>
                        setFormData({ ...formData, montant_paye: e.target.value })
                      }
                      placeholder={echeance.montant_estime.toString()}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Date de paiement</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.date_paiement
                            ? format(formData.date_paiement, "dd MMMM yyyy", { locale: fr })
                            : "Sélectionner une date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.date_paiement || undefined}
                          onSelect={(date) =>
                            setFormData({ ...formData, date_paiement: date || null })
                          }
                          locale={fr}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Ajouter des notes..."
                />
              </div>
            </>
          ) : (
            <>
              {echeance.montant_paye && (
                <div>
                  <Label>Montant payé</Label>
                  <p className="text-sm font-medium text-green-600 mt-1">
                    {echeance.montant_paye.toLocaleString("fr-FR")} €
                  </p>
                </div>
              )}

              {echeance.date_paiement && (
                <div>
                  <Label>Date de paiement</Label>
                  <p className="text-sm font-medium mt-1">
                    {format(new Date(echeance.date_paiement), "dd MMMM yyyy", { locale: fr })}
                  </p>
                </div>
              )}

              {echeance.notes && (
                <div>
                  <Label>Notes</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {echeance.notes}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {editing ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(false)}
              >
                Annuler
              </Button>
              <Button onClick={handleUpdate} disabled={loading}>
                {loading ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
              >
                Supprimer
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                Modifier
              </Button>
              <Button onClick={() => onOpenChange(false)}>Fermer</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
