import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2, AlertTriangle, Link, Unlink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface RapprochementInfo {
  id: string;
  numero_ligne: string;
  transaction_date: string;
  transaction_libelle: string;
  transaction_debit: number;
  transaction_credit: number;
  transaction_montant: number;
  notes?: string;
  fichier?: {
    numero_rapprochement: string;
    statut: string;
  };
}

interface FactureRapprochementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factureId: string;
  factureNumero: string;
  onSuccess?: () => void;
}

export default function FactureRapprochementDialog({
  open,
  onOpenChange,
  factureId,
  factureNumero,
  onSuccess,
}: FactureRapprochementDialogProps) {
  const [loading, setLoading] = useState(true);
  const [rapprochements, setRapprochements] = useState<RapprochementInfo[]>([]);
  const [unlinking, setUnlinking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadRapprochements();
    }
  }, [open, factureId]);

  const loadRapprochements = async () => {
    setLoading(true);
    try {
      // Charger les rapprochements liés à cette facture via rapprochements_factures
      const { data, error } = await supabase
        .from("rapprochements_factures")
        .select(`
          rapprochement_id,
          rapprochements_bancaires!inner(
            id,
            numero_ligne,
            transaction_date,
            transaction_libelle,
            transaction_debit,
            transaction_credit,
            transaction_montant,
            notes
          )
        `)
        .eq("facture_id", factureId);

      if (error) throw error;

      // Pour chaque rapprochement, charger le fichier de rapprochement associé
      const rapprochementsWithFiles = await Promise.all(
        (data || []).map(async (item) => {
          const rapprochementData = item.rapprochements_bancaires as any;
          
          // Trouver le fichier de rapprochement qui contient ce rapprochement
          const { data: fichierData } = await supabase
            .from("fichiers_rapprochement")
            .select("numero_rapprochement, statut, fichier_data")
            .eq("statut", "VALIDE")
            .order("created_at", { ascending: false });

          let fichierInfo = null;
          if (fichierData) {
            for (const fichier of fichierData) {
              const fichierDataParsed = fichier.fichier_data as any;
              if (fichierDataParsed?.rapprochementsManuels) {
                const found = fichierDataParsed.rapprochementsManuels.find(
                  (rm: any) => rm.id === rapprochementData.id
                );
                if (found) {
                  fichierInfo = {
                    numero_rapprochement: fichier.numero_rapprochement,
                    statut: fichier.statut,
                  };
                  break;
                }
              }
            }
          }

          return {
            id: rapprochementData.id,
            numero_ligne: rapprochementData.numero_ligne,
            transaction_date: rapprochementData.transaction_date,
            transaction_libelle: rapprochementData.transaction_libelle,
            transaction_debit: rapprochementData.transaction_debit,
            transaction_credit: rapprochementData.transaction_credit,
            transaction_montant: rapprochementData.transaction_montant,
            notes: rapprochementData.notes,
            fichier: fichierInfo,
          };
        })
      );

      setRapprochements(rapprochementsWithFiles);
    } catch (error: any) {
      console.error("Erreur chargement rapprochements:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les rapprochements",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async (rapprochementId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir annuler ce rapprochement ? La facture redeviendra disponible pour un nouveau rapprochement.")) {
      return;
    }

    setUnlinking(true);
    try {
      // Supprimer la liaison dans rapprochements_factures
      const { error: deleteError } = await supabase
        .from("rapprochements_factures")
        .delete()
        .eq("rapprochement_id", rapprochementId)
        .eq("facture_id", factureId);

      if (deleteError) throw deleteError;

      // Mettre à jour le statut de la facture si plus aucun rapprochement
      const remainingRapprochements = rapprochements.filter(r => r.id !== rapprochementId);
      
      if (remainingRapprochements.length === 0) {
        // Remettre la facture en statut VALIDEE
        const { error: updateError } = await supabase
          .from("factures")
          .update({
            statut: "VALIDEE",
            numero_rapprochement: null,
            date_rapprochement: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", factureId);

        if (updateError) throw updateError;
      }

      toast({
        title: "Succès",
        description: "Rapprochement annulé avec succès",
      });

      // Recharger les rapprochements
      await loadRapprochements();
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Erreur lors de l'annulation:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'annuler le rapprochement",
        variant: "destructive",
      });
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rapprochements bancaires - Facture {factureNumero}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : rapprochements.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucun rapprochement trouvé pour cette facture</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rapprochements.map((rapprochement) => (
              <Card key={rapprochement.id}>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {/* Numéro de ligne */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Link className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">N° Ligne:</span>
                        <Badge variant="outline" className="font-mono">
                          {rapprochement.numero_ligne}
                        </Badge>
                      </div>
                      {rapprochement.fichier && (
                        <Badge variant="secondary">
                          {rapprochement.fichier.numero_rapprochement}
                        </Badge>
                      )}
                    </div>

                    {/* Date de transaction */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Date transaction:</span>
                        <p className="font-medium">
                          {format(new Date(rapprochement.transaction_date), "dd/MM/yyyy", { locale: fr })}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Montant:</span>
                        <p className="font-medium">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                          }).format(rapprochement.transaction_montant)}
                        </p>
                      </div>
                    </div>

                    {/* Libellé */}
                    <div>
                      <span className="text-sm text-muted-foreground">Libellé bancaire:</span>
                      <p className="font-medium">{rapprochement.transaction_libelle}</p>
                    </div>

                    {/* Débit/Crédit */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Débit:</span>
                        <p className="font-medium text-red-600">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                          }).format(rapprochement.transaction_debit)}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Crédit:</span>
                        <p className="font-medium text-green-600">
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                          }).format(rapprochement.transaction_credit)}
                        </p>
                      </div>
                    </div>

                    {/* Notes */}
                    {rapprochement.notes && (
                      <div>
                        <span className="text-sm text-muted-foreground">Notes:</span>
                        <p className="text-sm">{rapprochement.notes}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-2 border-t">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleUnlink(rapprochement.id)}
                        disabled={unlinking}
                      >
                        {unlinking ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Unlink className="h-4 w-4 mr-2" />
                        )}
                        Annuler ce rapprochement
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
