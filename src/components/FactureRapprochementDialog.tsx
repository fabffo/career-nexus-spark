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
      // Récupérer d'abord la facture pour obtenir son numero_rapprochement
      const { data: factureData, error: factureError } = await supabase
        .from("factures")
        .select("numero_rapprochement")
        .eq("id", factureId)
        .single();

      if (factureError) throw factureError;

      const numeroRapprochement = factureData?.numero_rapprochement;

      if (!numeroRapprochement) {
        setRapprochements([]);
        return;
      }

      // Charger le fichier de rapprochement avec ce numéro
      const { data: fichierData, error: fichierError } = await supabase
        .from("fichiers_rapprochement")
        .select("numero_rapprochement, statut, fichier_data")
        .eq("numero_rapprochement", numeroRapprochement)
        .eq("statut", "VALIDE")
        .single();

      if (fichierError) {
        if (fichierError.code === "PGRST116") {
          // Aucun fichier trouvé
          setRapprochements([]);
          return;
        }
        throw fichierError;
      }

      const fichierDataParsed = fichierData.fichier_data as any;
      const allRapprochements = [
        ...(fichierDataParsed?.rapprochements || []),
        ...(fichierDataParsed?.rapprochementsManuels || [])
      ];

      // Filtrer les rapprochements pour cette facture uniquement
      const factureRapprochements = allRapprochements
        .filter((item: any) => item.facture?.id === factureId)
        .map((item: any, index: number) => ({
          id: `${numeroRapprochement}-${index}`,
          numero_ligne: `Transaction ${index + 1}`,
          transaction_date: item.transaction?.date,
          transaction_libelle: item.transaction?.libelle,
          transaction_debit: item.transaction?.debit || 0,
          transaction_credit: item.transaction?.credit || 0,
          transaction_montant: item.transaction?.montant,
          notes: item.isManual ? "Rapprochement manuel" : "Rapprochement automatique",
          fichier: {
            numero_rapprochement: fichierData.numero_rapprochement,
            statut: fichierData.statut,
          },
        }));

      setRapprochements(factureRapprochements);
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
      // Récupérer le numero_rapprochement de la facture
      const { data: factureData, error: factureError } = await supabase
        .from("factures")
        .select("numero_rapprochement")
        .eq("id", factureId)
        .single();

      if (factureError) throw factureError;

      const numeroRapprochement = factureData?.numero_rapprochement;

      if (!numeroRapprochement) {
        throw new Error("Numéro de rapprochement introuvable");
      }

      // Charger le fichier de rapprochement
      const { data: fichierData, error: fichierError } = await supabase
        .from("fichiers_rapprochement")
        .select("fichier_data")
        .eq("numero_rapprochement", numeroRapprochement)
        .single();

      if (fichierError) throw fichierError;

      const fichierDataParsed = fichierData.fichier_data as any;

      // Retirer la facture de tous les rapprochements (automatiques et manuels)
      const updatedRapprochements = (fichierDataParsed?.rapprochements || [])
        .filter((item: any) => item.facture?.id !== factureId);

      const updatedRapprochementsManuels = (fichierDataParsed?.rapprochementsManuels || [])
        .filter((item: any) => item.facture?.id !== factureId);

      // Mettre à jour le fichier_data
      const { error: updateFichierError } = await supabase
        .from("fichiers_rapprochement")
        .update({
          fichier_data: {
            ...fichierDataParsed,
            rapprochements: updatedRapprochements,
            rapprochementsManuels: updatedRapprochementsManuels,
          },
        })
        .eq("numero_rapprochement", numeroRapprochement);

      if (updateFichierError) throw updateFichierError;

      // Remettre la facture en statut VALIDEE
      const { error: updateFactureError } = await supabase
        .from("factures")
        .update({
          statut: "VALIDEE",
          numero_rapprochement: null,
          date_rapprochement: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", factureId);

      if (updateFactureError) throw updateFactureError;

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
