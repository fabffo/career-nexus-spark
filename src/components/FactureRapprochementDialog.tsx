import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface RapprochementInfo {
  id: string;
  date: string;
  libelle: string;
  montant: number;
  debit: number;
  credit: number;
  fichierNumero: string;
  notes?: string;
  facturesAssociees?: Array<{
    numero_facture: string;
    total_ttc: number;
    total_tva: number;
    type_facture: string;
  }>;
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
    if (!factureId) return;
    
    setLoading(true);
    try {
      // Récupérer le numero_ligne_rapprochement de la facture
      const { data: factureData, error: factureError } = await supabase
        .from("factures")
        .select("numero_rapprochement, numero_ligne_rapprochement")
        .eq("id", factureId)
        .single();

      if (factureError) throw factureError;
      
      if (!factureData?.numero_ligne_rapprochement) {
        console.log("Pas de numero_ligne_rapprochement pour cette facture");
        setRapprochements([]);
        return;
      }

      console.log("📄 Numero ligne rapprochement:", factureData.numero_ligne_rapprochement);

      // Charger le fichier de rapprochement
      const { data: fichierData, error: fichierError } = await supabase
        .from("fichiers_rapprochement")
        .select("fichier_data, numero_rapprochement")
        .eq("numero_rapprochement", factureData.numero_rapprochement)
        .single();

      if (fichierError) throw fichierError;
      
      if (!fichierData?.fichier_data) {
        console.log("Pas de fichier_data");
        setRapprochements([]);
        return;
      }

      console.log("📦 Fichier data:", fichierData.fichier_data);

      // Extraire les rapprochements du JSON avec un cast approprié
      const fichierDataTyped = fichierData.fichier_data as any;
      const allRapprochements = [
        ...(fichierDataTyped?.rapprochements || []),
        ...(fichierDataTyped?.rapprochementsManuels || [])
      ];

      console.log("📊 Total rapprochements dans le fichier:", allRapprochements.length);

      // Trouver le rapprochement spécifique par numero_ligne
      const rapprochementLigne = allRapprochements.find((item: any) => 
        item.numero_ligne === factureData.numero_ligne_rapprochement
      );

      if (!rapprochementLigne) {
        console.log("❌ Aucun rapprochement trouvé avec ce numero_ligne");
        setRapprochements([]);
        return;
      }

      console.log("✅ Rapprochement trouvé:", rapprochementLigne);

      // Récupérer toutes les factures associées à cette ligne
      const { data: facturesAssociees, error: facturesError } = await supabase
        .from("factures")
        .select("numero_facture, total_ttc, total_tva, type_facture")
        .eq("numero_ligne_rapprochement", factureData.numero_ligne_rapprochement);

      if (facturesError) throw facturesError;

      console.log("📋 Factures associées à cette ligne:", facturesAssociees?.length);

      // Transformer en format d'affichage
      const rapprochementInfo: RapprochementInfo = {
        id: factureData.numero_ligne_rapprochement,
        date: rapprochementLigne.transaction.date,
        libelle: rapprochementLigne.transaction.libelle,
        montant: rapprochementLigne.transaction.montant,
        debit: rapprochementLigne.transaction.debit || 0,
        credit: rapprochementLigne.transaction.credit || 0,
        fichierNumero: fichierData.numero_rapprochement,
        notes: rapprochementLigne.notes,
        facturesAssociees: facturesAssociees || []
      };

      setRapprochements([rapprochementInfo]);
    } catch (error) {
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

  const handleUnlink = async (numeroLigne: string) => {
    if (!confirm("Êtes-vous sûr de vouloir annuler ce rapprochement ? Toutes les factures associées à cette ligne seront dé-rapprochées.")) {
      return;
    }

    setUnlinking(true);
    try {
      // Récupérer toutes les factures associées à ce numero_ligne
      const { data: facturesAssociees, error: facturesError } = await supabase
        .from("factures")
        .select("id, numero_rapprochement")
        .eq("numero_ligne_rapprochement", numeroLigne);

      if (facturesError) throw facturesError;

      if (!facturesAssociees || facturesAssociees.length === 0) {
        throw new Error("Aucune facture trouvée pour ce numero_ligne");
      }

      const numeroRapprochement = facturesAssociees[0].numero_rapprochement;

      // Charger le fichier de rapprochement
      const { data: fichierData, error: fichierError } = await supabase
        .from("fichiers_rapprochement")
        .select("id, fichier_data")
        .eq("numero_rapprochement", numeroRapprochement)
        .single();

      if (fichierError) throw fichierError;
      if (!fichierData?.fichier_data) {
        throw new Error("Pas de fichier_data trouvé");
      }

      // Modifier le JSON pour mettre cette ligne en "partial" avec cast approprié
      const fichierDataTyped = fichierData.fichier_data as any;
      const updatedRapprochements = fichierDataTyped?.rapprochements?.map((item: any) => {
        if (item.numero_ligne === numeroLigne) {
          return {
            ...item,
            facture: undefined,
            factureIds: undefined,
            factures: undefined,
            status: "partial"
          };
        }
        return item;
      }) || [];

      const updatedManuels = fichierDataTyped?.rapprochementsManuels?.map((item: any) => {
        if (item.numero_ligne === numeroLigne) {
          return {
            ...item,
            facture: undefined,
            factureIds: undefined,
            factures: undefined,
            status: "partial"
          };
        }
        return item;
      }) || [];

      // Mettre à jour le fichier
      const { error: updateFichierError } = await supabase
        .from("fichiers_rapprochement")
        .update({
          fichier_data: {
            ...fichierDataTyped,
            rapprochements: updatedRapprochements,
            rapprochementsManuels: updatedManuels
          } as any
        })
        .eq("id", fichierData.id);

      if (updateFichierError) throw updateFichierError;

      // Mettre à jour toutes les factures associées
      const { error: updateFacturesError } = await supabase
        .from("factures")
        .update({
          statut: "VALIDEE",
          numero_rapprochement: null,
          numero_ligne_rapprochement: null,
          date_rapprochement: null
        })
        .eq("numero_ligne_rapprochement", numeroLigne);

      if (updateFacturesError) throw updateFacturesError;

      toast({
        title: "Succès",
        description: `Le rapprochement a été annulé pour ${facturesAssociees.length} facture(s)`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Erreur:", error);
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
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Détail du rapprochement - Facture {factureNumero}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rapprochements.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Aucun rapprochement trouvé pour cette facture</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rapprochements.map((rappr) => (
              <Card key={rappr.id}>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium">
                      {format(new Date(rappr.date), "dd/MM/yyyy", { locale: fr })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Libellé:</span>
                    <span className="font-medium text-right max-w-[200px] truncate">
                      {rappr.libelle}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Montant:</span>
                    <span className="font-medium">
                      {new Intl.NumberFormat("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                      }).format(rappr.montant)}
                    </span>
                  </div>
                  {rappr.debit > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Débit:</span>
                      <span className="font-medium text-destructive">
                        {new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        }).format(rappr.debit)}
                      </span>
                    </div>
                  )}
                  {rappr.credit > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Crédit:</span>
                      <span className="font-medium text-green-600">
                        {new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        }).format(rappr.credit)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Fichier:</span>
                    <span className="font-medium">{rappr.fichierNumero}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">N° Ligne:</span>
                    <span className="font-mono text-xs font-medium">{rappr.id}</span>
                  </div>
                  {rappr.facturesAssociees && rappr.facturesAssociees.length > 1 && (
                    <div className="space-y-2 mt-4">
                      <span className="text-sm font-medium">Factures associées ({rappr.facturesAssociees.length}):</span>
                      <div className="space-y-1 max-h-[150px] overflow-y-auto">
                        {rappr.facturesAssociees.map((facture, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs bg-muted p-2 rounded">
                            <span className="font-medium">{facture.numero_facture}</span>
                            <div className="flex gap-2">
                              <span>{new Intl.NumberFormat("fr-FR", {
                                style: "currency",
                                currency: "EUR",
                              }).format(facture.total_ttc)}</span>
                              <Badge variant={facture.type_facture === "VENTES" ? "default" : "secondary"} className="text-xs">
                                {facture.type_facture === "VENTES" ? "Vente" : "Achat"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-sm font-medium bg-primary/10 p-2 rounded">
                        <span>TVA totale:</span>
                        <span>
                          {new Intl.NumberFormat("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                          }).format(rappr.facturesAssociees.reduce((sum, f) => sum + (f.total_tva || 0), 0))}
                        </span>
                      </div>
                    </div>
                  )}
                  {rappr.notes && (
                    <div className="space-y-1">
                      <span className="text-sm text-muted-foreground">Notes:</span>
                      <p className="text-sm font-medium">{rappr.notes}</p>
                    </div>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleUnlink(rappr.id)}
                    disabled={unlinking}
                    className="w-full mt-4"
                  >
                    {unlinking ? "Annulation..." : "Annuler ce rapprochement"}
                  </Button>
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
