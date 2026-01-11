import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Euro, Building, Info, CheckCircle, XCircle } from "lucide-react";
import { MatchingHistorySection } from "./MatchingHistorySection";

const PERIODICITE_LABELS: Record<string, string> = {
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  ANNUEL: "Annuel",
};

const TYPE_CHARGE_LABELS: Record<string, string> = {
  SALAIRE: "Salaire",
  CHARGES_SOCIALES: "Charges sociales",
  RETRAITE: "Retraite",
  MUTUELLE: "Mutuelle",
};

interface Declaration {
  id: string;
  nom: string;
  organisme: string;
  type_charge: string;
  periodicite: string;
  montant_estime: number;
  jour_echeance: number;
  actif: boolean;
  notes?: string;
}

interface ViewDeclarationChargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  declaration: Declaration | null;
}

export function ViewDeclarationChargeDialog({ open, onOpenChange, declaration }: ViewDeclarationChargeDialogProps) {
  if (!declaration) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Détails de la déclaration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informations principales */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-primary" />
                  {declaration.nom}
                </span>
                {declaration.actif ? (
                  <Badge className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Actif
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <XCircle className="h-3 w-3 mr-1" />
                    Inactif
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Organisme</p>
                <p className="font-medium">{declaration.organisme}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type de charge</p>
                <Badge variant="outline">
                  {TYPE_CHARGE_LABELS[declaration.type_charge] || declaration.type_charge}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Périodicité</p>
                <Badge variant="secondary">
                  {PERIODICITE_LABELS[declaration.periodicite] || declaration.periodicite}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Montant estimé</p>
                <div className="flex items-center gap-1 font-medium">
                  <Euro className="h-4 w-4" />
                  {declaration.montant_estime
                    ? `${Number(declaration.montant_estime).toFixed(2)} €`
                    : "-"}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Jour d'échéance</p>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {declaration.jour_echeance
                    ? `Le ${declaration.jour_echeance} de chaque période`
                    : "-"}
                </div>
              </div>
              {declaration.notes && (
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{declaration.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section Matching */}
          <MatchingHistorySection
            entityType="declaration"
            entityId={declaration.id}
            entityName={declaration.nom}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
