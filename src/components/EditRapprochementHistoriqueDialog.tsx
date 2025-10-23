import { useState, useEffect } from "react";
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
import { Search, CheckCircle, XCircle, AlertCircle } from "lucide-react";
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

interface Rapprochement {
  transaction: TransactionBancaire;
  facture: FactureMatch | null;
  score: number;
  status: "matched" | "unmatched" | "uncertain";
  isManual?: boolean;
  manualId?: string;
  notes?: string | null;
}

interface EditRapprochementHistoriqueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rapprochement: Rapprochement | null;
  factures: FactureMatch[];
  fichierId: string;
  onSuccess: () => void;
}

export default function EditRapprochementHistoriqueDialog({
  open,
  onOpenChange,
  rapprochement,
  factures,
  fichierId,
  onSuccess,
}: EditRapprochementHistoriqueDialogProps) {
  const [status, setStatus] = useState<"matched" | "unmatched" | "uncertain">("unmatched");
  const [selectedFactureId, setSelectedFactureId] = useState<string>("");
  const [selectedAbonnementId, setSelectedAbonnementId] = useState<string>("");
  const [abonnements, setAbonnements] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Charger les abonnements actifs
  useEffect(() => {
    const loadAbonnements = async () => {
      const { data, error } = await supabase
        .from("abonnements_partenaires")
        .select("*")
        .eq("actif", true)
        .order("nom");

      if (!error && data) {
        setAbonnements(data);
      }
    };

    if (open) {
      loadAbonnements();
    }
  }, [open]);

  // Initialiser les valeurs au chargement
  useEffect(() => {
    if (rapprochement && open) {
      setStatus(rapprochement.status);
      setSelectedFactureId(rapprochement.facture?.id || "");
      setNotes(rapprochement.notes || "");
      
      // Charger l'abonnement associé si existe dans rapprochements_bancaires
      const loadAbonnement = async () => {
        if (!rapprochement.manualId) return;
        
        const { data } = await supabase
          .from("rapprochements_bancaires")
          .select("abonnement_id")
          .eq("id", rapprochement.manualId)
          .maybeSingle();
        
        if (data?.abonnement_id) {
          setSelectedAbonnementId(data.abonnement_id);
        }
      };
      
      loadAbonnement();
    }
  }, [rapprochement, open]);

  const filteredFactures = factures.filter((f) => {
    const search = searchTerm.toLowerCase();
    return (
      f.numero_facture.toLowerCase().includes(search) ||
      f.partenaire_nom.toLowerCase().includes(search) ||
      f.total_ttc.toString().includes(search)
    );
  });

  const handleSave = async () => {
    if (!rapprochement) return;

    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const transaction = rapprochement.transaction;

      // 1. Mettre à jour ou créer le rapprochement manuel
      const { data: existing } = await supabase
        .from("rapprochements_bancaires")
        .select("id")
        .eq("transaction_date", transaction.date)
        .eq("transaction_libelle", transaction.libelle)
        .eq("transaction_montant", transaction.montant)
        .maybeSingle();

      let rapprochementId = existing?.id;

      if (existing) {
        const { error } = await supabase
          .from("rapprochements_bancaires")
          .update({
            facture_id: selectedFactureId && selectedFactureId !== "none" ? selectedFactureId : null,
            abonnement_id: selectedAbonnementId && selectedAbonnementId !== "none" ? selectedAbonnementId : null,
            notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { data: newRapprochement, error } = await supabase
          .from("rapprochements_bancaires")
          .insert({
            transaction_date: transaction.date,
            transaction_libelle: transaction.libelle,
            transaction_debit: transaction.debit,
            transaction_credit: transaction.credit,
            transaction_montant: transaction.montant,
            facture_id: selectedFactureId && selectedFactureId !== "none" ? selectedFactureId : null,
            abonnement_id: selectedAbonnementId && selectedAbonnementId !== "none" ? selectedAbonnementId : null,
            notes,
            created_by: authData.user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        rapprochementId = newRapprochement.id;
      }

      // 2. Créer le paiement d'abonnement si nécessaire
      if (selectedAbonnementId && selectedAbonnementId !== "none" && rapprochementId) {
        // Vérifier si un paiement existe déjà pour ce rapprochement
        const { data: existingPaiement } = await supabase
          .from("paiements_abonnements")
          .select("id")
          .eq("rapprochement_id", rapprochementId)
          .maybeSingle();

        if (!existingPaiement) {
          const { error: paiementError } = await supabase
            .from("paiements_abonnements")
            .insert({
              abonnement_id: selectedAbonnementId,
              rapprochement_id: rapprochementId,
              date_paiement: transaction.date,
              montant: Math.abs(transaction.montant),
              notes: `Créé depuis l'édition du rapprochement historique`,
              created_by: authData.user?.id,
            });

          if (paiementError) {
            console.error("Erreur lors de la création du paiement:", paiementError);
          }
        } else {
          // Mettre à jour le paiement existant
          const { error: updateError } = await supabase
            .from("paiements_abonnements")
            .update({
              abonnement_id: selectedAbonnementId,
              date_paiement: transaction.date,
              montant: Math.abs(transaction.montant),
              notes: notes || null,
            })
            .eq("id", existingPaiement.id);

          if (updateError) {
            console.error("Erreur lors de la mise à jour du paiement:", updateError);
          }
        }
      }

      // 3. Mettre à jour le fichier de rapprochement avec le nouveau statut
      const { data: fichierData } = await supabase
        .from("fichiers_rapprochement")
        .select("fichier_data")
        .eq("id", fichierId)
        .single();

      if (fichierData) {
        const fichier = fichierData.fichier_data as any;
        const transactionKey = `${transaction.date}-${transaction.libelle}-${transaction.montant}`;
        
        const updatedRapprochements = fichier.rapprochements.map((r: Rapprochement) => {
          const rKey = `${r.transaction.date}-${r.transaction.libelle}-${r.transaction.montant}`;
          if (rKey === transactionKey) {
            return {
              ...r,
              status,
              facture: selectedFactureId && selectedFactureId !== "none" ? factures.find(f => f.id === selectedFactureId) || null : null,
              notes,
              isManual: true,
              manualId: rapprochementId,
            };
          }
          return r;
        });

        const lignesRapprochees = updatedRapprochements.filter(
          (r: Rapprochement) => r.status === "matched"
        ).length;

        const { error: updateError } = await supabase
          .from("fichiers_rapprochement")
          .update({
            fichier_data: { ...fichier, rapprochements: updatedRapprochements },
            lignes_rapprochees: lignesRapprochees,
            updated_at: new Date().toISOString(),
          })
          .eq("id", fichierId);

        if (updateError) throw updateError;
      }

      toast({
        title: "Succès",
        description: "Rapprochement modifié avec succès",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le rapprochement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!rapprochement) return null;

  const transaction = rapprochement.transaction;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le rapprochement</DialogTitle>
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

          {/* Status selection */}
          <div className="space-y-2">
            <Label>Statut *</Label>
            <Select value={status} onValueChange={(value: any) => setStatus(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="matched">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Rapproché</span>
                  </div>
                </SelectItem>
                <SelectItem value="uncertain">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <span>Incertain</span>
                  </div>
                </SelectItem>
                <SelectItem value="unmatched">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span>Non rapproché</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
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
            <Label>Facture associée</Label>
            <Select value={selectedFactureId} onValueChange={setSelectedFactureId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une facture (optionnel)" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="none">
                  <span className="text-muted-foreground">Aucune facture</span>
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

          {/* Abonnement selection */}
          <div className="space-y-2">
            <Label>Abonnement partenaire</Label>
            <Select value={selectedAbonnementId} onValueChange={setSelectedAbonnementId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un abonnement (optionnel)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Aucun abonnement</span>
                </SelectItem>
                {abonnements.map((abonnement) => (
                  <SelectItem key={abonnement.id} value={abonnement.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{abonnement.nom}</span>
                      <Badge variant="outline" className="text-xs">
                        {abonnement.nature}
                      </Badge>
                      {abonnement.montant_mensuel && (
                        <span className="text-sm text-muted-foreground">
                          {Number(abonnement.montant_mensuel).toFixed(2)} €/mois
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAbonnementId && (
              <p className="text-xs text-muted-foreground">
                Un paiement d'abonnement sera créé ou mis à jour
              </p>
            )}
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
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
