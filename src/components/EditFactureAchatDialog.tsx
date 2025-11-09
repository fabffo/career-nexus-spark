import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Facture } from "@/pages/FacturesAchats";

interface EditFactureAchatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  facture: Facture;
}

export default function EditFactureAchatDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  facture 
}: EditFactureAchatDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date_emission: new Date(facture.date_emission),
    emetteur_nom: facture.emetteur_nom,
    destinataire_nom: facture.destinataire_nom,
  });

  useEffect(() => {
    if (open && facture) {
      setFormData({
        date_emission: new Date(facture.date_emission),
        emetteur_nom: facture.emetteur_nom,
        destinataire_nom: facture.destinataire_nom,
      });
    }
  }, [open, facture]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('factures')
        .update({
          date_emission: format(formData.date_emission, 'yyyy-MM-dd'),
          emetteur_nom: formData.emetteur_nom,
          destinataire_nom: formData.destinataire_nom,
          updated_at: new Date().toISOString(),
        })
        .eq('id', facture.id);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Facture d'achat modifiée avec succès",
      });

      onSuccess();
    } catch (error: any) {
      console.error('Erreur lors de la modification:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier la facture",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier la facture d'achat</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Informations non modifiables */}
          <div className="space-y-2 p-3 bg-muted rounded-md">
            <div className="text-sm">
              <span className="font-medium">N° Facture:</span> {facture.numero_facture}
            </div>
            <div className="text-sm">
              <span className="font-medium">Type:</span> Achat
            </div>
            <div className="text-sm">
              <span className="font-medium">Montant TTC:</span> {new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR',
              }).format(facture.total_ttc || 0)}
            </div>
          </div>

          {/* Date d'émission */}
          <div className="space-y-2">
            <Label>
              Date d'émission <span className="text-destructive">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.date_emission && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.date_emission ? (
                    format(formData.date_emission, "dd/MM/yyyy", { locale: fr })
                  ) : (
                    <span>Sélectionner une date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.date_emission}
                  onSelect={(date) => date && setFormData({ ...formData, date_emission: date })}
                  locale={fr}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Émetteur */}
          <div className="space-y-2">
            <Label htmlFor="emetteur_nom">
              Émetteur (Fournisseur) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="emetteur_nom"
              value={formData.emetteur_nom}
              onChange={(e) => setFormData({ ...formData, emetteur_nom: e.target.value })}
              placeholder="Nom du fournisseur"
              required
            />
          </div>

          {/* Destinataire */}
          <div className="space-y-2">
            <Label htmlFor="destinataire_nom">
              Destinataire <span className="text-destructive">*</span>
            </Label>
            <Input
              id="destinataire_nom"
              value={formData.destinataire_nom}
              onChange={(e) => setFormData({ ...formData, destinataire_nom: e.target.value })}
              placeholder="Nom du destinataire"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Modification..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
