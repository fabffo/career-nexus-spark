import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RapprochementDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  numeroLigne: string;
}

interface RapprochementDetail {
  rapprochement: {
    id: string;
    numero_ligne: string;
    transaction_date: string;
    transaction_libelle: string;
    transaction_debit: number;
    transaction_credit: number;
    transaction_montant: number;
    notes?: string;
  };
  factures: Array<{
    id: string;
    numero_facture: string;
    type_facture: 'VENTES' | 'ACHATS';
    date_emission: string;
    emetteur_nom: string;
    destinataire_nom: string;
    total_ttc: number;
  }>;
  abonnement?: {
    id: string;
    nom: string;
    montant_mensuel: number;
  };
  declaration?: {
    id: string;
    nom: string;
    organisme: string;
  };
}

export default function RapprochementDetailDialog({
  open,
  onOpenChange,
  numeroLigne,
}: RapprochementDetailDialogProps) {
  const [details, setDetails] = useState<RapprochementDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && numeroLigne) {
      loadRapprochementDetails();
    }
  }, [open, numeroLigne]);

  const loadRapprochementDetails = async () => {
    setLoading(true);
    try {
      // 1. Chercher le rapprochement bancaire
      const { data: rapprochement, error: rapprochementError } = await supabase
        .from('rapprochements_bancaires')
        .select('*')
        .eq('numero_ligne', numeroLigne)
        .single();

      if (rapprochementError) throw rapprochementError;

      // 2. Chercher toutes les factures liées via rapprochements_factures
      const { data: liaisonsFactures, error: liaisonsError } = await supabase
        .from('rapprochements_factures')
        .select('facture_id')
        .eq('rapprochement_id', rapprochement.id);

      if (liaisonsError) throw liaisonsError;

      const factureIds = liaisonsFactures?.map(l => l.facture_id) || [];
      
      let factures: any[] = [];
      if (factureIds.length > 0) {
        const { data: facturesData, error: facturesError } = await supabase
          .from('factures')
          .select('*')
          .in('id', factureIds);

        if (facturesError) throw facturesError;
        factures = facturesData || [];
      }

      // 3. Chercher l'abonnement associé si présent
      let abonnement = undefined;
      if (rapprochement.abonnement_id) {
        const { data: abonnementData } = await supabase
          .from('abonnements_partenaires')
          .select('id, nom, montant_mensuel')
          .eq('id', rapprochement.abonnement_id)
          .single();
        
        abonnement = abonnementData || undefined;
      }

      // 4. Chercher la déclaration de charge associée si présente
      let declaration = undefined;
      if (rapprochement.declaration_charge_id) {
        const { data: declarationData } = await supabase
          .from('declarations_charges_sociales')
          .select('id, nom, organisme')
          .eq('id', rapprochement.declaration_charge_id)
          .single();
        
        declaration = declarationData || undefined;
      }

      setDetails({
        rapprochement,
        factures,
        abonnement,
        declaration,
      });
    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error);
      setDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const navigateToRapprochement = () => {
    // TODO: Implémenter la navigation vers l'historique de rapprochement
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Détails du rapprochement 
            <Badge variant="outline" className="font-mono">
              {numeroLigne}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : details ? (
          <div className="space-y-6">
            {/* Transaction bancaire */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Transaction bancaire</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Date</dt>
                    <dd className="mt-1">
                      {format(new Date(details.rapprochement.transaction_date), 'dd/MM/yyyy', { locale: fr })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Montant</dt>
                    <dd className="mt-1 font-semibold">
                      {formatCurrency(details.rapprochement.transaction_montant)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-sm font-medium text-muted-foreground">Libellé</dt>
                    <dd className="mt-1">{details.rapprochement.transaction_libelle}</dd>
                  </div>
                  {details.rapprochement.notes && (
                    <div className="col-span-2">
                      <dt className="text-sm font-medium text-muted-foreground">Notes</dt>
                      <dd className="mt-1 text-sm">{details.rapprochement.notes}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Factures associées */}
            {details.factures.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Factures associées ({details.factures.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° Facture</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Partenaire</TableHead>
                        <TableHead className="text-right">Montant TTC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {details.factures.map((facture) => (
                        <TableRow key={facture.id}>
                          <TableCell className="font-medium">{facture.numero_facture}</TableCell>
                          <TableCell>
                            <Badge variant={facture.type_facture === 'VENTES' ? 'default' : 'secondary'}>
                              {facture.type_facture}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(facture.date_emission), 'dd/MM/yyyy', { locale: fr })}
                          </TableCell>
                          <TableCell>
                            {facture.type_facture === 'VENTES'
                              ? facture.destinataire_nom
                              : facture.emetteur_nom}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(facture.total_ttc)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Abonnement associé */}
            {details.abonnement && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Abonnement associé</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{details.abonnement.nom}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(details.abonnement.montant_mensuel)} / mois
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Déclaration de charge associée */}
            {details.declaration && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Déclaration de charge associée</CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <p className="font-medium">{details.declaration.nom}</p>
                    <p className="text-sm text-muted-foreground">
                      Organisme: {details.declaration.organisme}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fermer
              </Button>
              <Button onClick={navigateToRapprochement}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Voir dans l'historique
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            Aucun détail trouvé pour ce rapprochement
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
