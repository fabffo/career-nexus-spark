import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Devis, DevisLigne } from "@/types/devis";

interface ViewDevisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  devis: Devis | null;
}

const statutColors: Record<string, string> = {
  ENCOURS: "bg-yellow-100 text-yellow-800",
  REALISE: "bg-green-100 text-green-800",
  ANNULE: "bg-red-100 text-red-800",
};

export default function ViewDevisDialog({ open, onOpenChange, devis }: ViewDevisDialogProps) {
  const [lignes, setLignes] = useState<DevisLigne[]>([]);

  useEffect(() => {
    if (open && devis) {
      supabase.from('devis_lignes').select('*').eq('devis_id', devis.id).order('ordre')
        .then(({ data }) => {
          if (data) setLignes(data.map((l: any) => ({
            ...l, quantite: Number(l.quantite), prix_unitaire_ht: Number(l.prix_unitaire_ht),
            prix_ht: Number(l.prix_ht), taux_tva: Number(l.taux_tva),
            montant_tva: Number(l.montant_tva || 0), prix_ttc: Number(l.prix_ttc || 0),
          })));
        });
    }
  }, [open, devis]);

  if (!devis) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Devis {devis.numero_devis}
            <Badge className={statutColors[devis.statut] || ""}>{devis.statut}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Date émission</p>
              <p className="font-medium">{devis.date_emission}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Date échéance</p>
              <p className="font-medium">{devis.date_echeance}</p>
            </div>
            {devis.date_validite && (
              <div>
                <p className="text-muted-foreground">Date validité</p>
                <p className="font-medium">{devis.date_validite}</p>
              </div>
            )}
            {devis.activite && (
              <div>
                <p className="text-muted-foreground">Activité</p>
                <p className="font-medium">{devis.activite}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded p-3">
              <p className="text-xs text-muted-foreground mb-1">Émetteur</p>
              <p className="font-medium text-sm">{devis.emetteur_nom}</p>
              {devis.emetteur_email && <p className="text-xs text-muted-foreground">{devis.emetteur_email}</p>}
            </div>
            <div className="border rounded p-3">
              <p className="text-xs text-muted-foreground mb-1">Client</p>
              <p className="font-medium text-sm">{devis.destinataire_nom}</p>
              {devis.destinataire_email && <p className="text-xs text-muted-foreground">{devis.destinataire_email}</p>}
            </div>
          </div>

          {lignes.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead className="text-right">PU HT</TableHead>
                  <TableHead className="text-right">TVA %</TableHead>
                  <TableHead className="text-right">Total HT</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>{l.description}</TableCell>
                    <TableCell className="text-right">{l.quantite}</TableCell>
                    <TableCell className="text-right">{l.prix_unitaire_ht.toFixed(2)} €</TableCell>
                    <TableCell className="text-right">{l.taux_tva}%</TableCell>
                    <TableCell className="text-right">{l.prix_ht.toFixed(2)} €</TableCell>
                    <TableCell className="text-right">{(l.prix_ttc || 0).toFixed(2)} €</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex justify-end">
            <div className="space-y-1 text-right text-sm border rounded p-3">
              <p>Total HT: <span className="font-bold">{Number(devis.total_ht).toFixed(2)} €</span></p>
              <p>Total TVA: <span className="font-bold">{Number(devis.total_tva).toFixed(2)} €</span></p>
              <p className="text-base border-t pt-1">Total TTC: <span className="font-bold">{Number(devis.total_ttc).toFixed(2)} €</span></p>
            </div>
          </div>

          {devis.facture_id && (
            <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
              <p className="font-medium text-green-800">Ce devis a été transformé en facture</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
