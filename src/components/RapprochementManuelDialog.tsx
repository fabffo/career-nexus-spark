import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface TransactionBancaire {
  date: string;
  libelle: string;
  debit: number;
  credit: number;
  montant: number;
}

interface FactureMatch {
  id: string;
  numero_facture: string;
  type_facture: "VENTES" | "ACHATS";
  date_emission: string;
  partenaire_nom: string;
  total_ttc: number;
  statut: string;
}

interface RapprochementManuelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionBancaire | null;
  factures: FactureMatch[];
  onSuccess: () => void;
}

export default function RapprochementManuelDialog({
  open,
  onOpenChange,
  transaction,
  factures,
  onSuccess,
}: RapprochementManuelDialogProps) {
  const [selectedFactureId, setSelectedFactureId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const filteredFactures = factures.filter((f) => {
    const search = searchTerm.toLowerCase();
    return (
      f.numero_facture.toLowerCase().includes(search) ||
      f.partenaire_nom.toLowerCase().includes(search) ||
      f.total_ttc.toString().includes(search)
    );
  });

  const handleSave = async () => {
    if (!transaction || !selectedFactureId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une facture",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();

      // Vérifier si un rapprochement existe déjà pour cette transaction
      const { data: existing } = await supabase
        .from("rapprochements_bancaires")
        .select("id")
        .eq("transaction_date", transaction.date)
        .eq("transaction_libelle", transaction.libelle)
        .eq("transaction_montant", transaction.montant)
        .maybeSingle();

      if (existing) {
        // Mettre à jour
        const { error } = await supabase
          .from("rapprochements_bancaires")
          .update({
            facture_id: selectedFactureId === "aucune" ? null : selectedFactureId,
            notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Créer un nouveau
        const { error } = await supabase
          .from("rapprochements_bancaires")
          .insert({
            transaction_date: transaction.date,
            transaction_libelle: transaction.libelle,
            transaction_debit: transaction.debit,
            transaction_credit: transaction.credit,
            transaction_montant: transaction.montant,
            facture_id: selectedFactureId === "aucune" ? null : selectedFactureId,
            notes,
            created_by: authData.user?.id,
          });

        if (error) throw error;
      }

      toast({
        title: "Succès",
        description: "Rapprochement manuel enregistré",
      });

      onSuccess();
      onOpenChange(false);
      setSelectedFactureId("");
      setNotes("");
      setSearchTerm("");
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le rapprochement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rapprochement manuel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction info */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h3 className="font-semibold">Transaction bancaire</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Date:</span>{" "}
                {format(new Date(transaction.date), "dd MMMM yyyy", { locale: fr })}
              </div>
              <div>
                <span className="text-muted-foreground">Montant:</span>{" "}
                <span className={transaction.montant > 0 ? "text-green-600" : "text-red-600"}>
                  {new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  }).format(Math.abs(transaction.montant))}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Libellé:</span>{" "}
                {transaction.libelle}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="space-y-2">
            <Label>Rechercher une facture</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="N° facture, partenaire, montant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Facture selection */}
          <div className="space-y-2">
            <Label>Facture à rapprocher *</Label>
            <Select value={selectedFactureId} onValueChange={setSelectedFactureId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une facture" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="aucune">
                  <span className="text-muted-foreground">Aucune facture (dissocier)</span>
                </SelectItem>
                {filteredFactures.map((facture) => (
                  <SelectItem key={facture.id} value={facture.id}>
                    <div className="flex items-center justify-between gap-4 w-full">
                      <span className="font-medium">{facture.numero_facture}</span>
                      <Badge
                        variant="outline"
                        className={
                          facture.type_facture === "VENTES"
                            ? "border-green-600 text-green-600"
                            : "border-orange-600 text-orange-600"
                        }
                      >
                        {facture.type_facture}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{facture.partenaire_nom}</span>
                      <span className="font-medium">
                        {new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        }).format(facture.total_ttc)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(facture.date_emission), "dd/MM/yyyy")}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optionnel)</Label>
            <Textarea
              placeholder="Ajouter des notes sur ce rapprochement..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={loading || !selectedFactureId}>
            {loading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
