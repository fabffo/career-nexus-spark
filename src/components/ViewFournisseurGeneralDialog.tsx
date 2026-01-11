import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Mail, Phone, Globe, MapPin, Briefcase, Info } from "lucide-react";
import { MatchingHistorySection } from "./MatchingHistorySection";

interface FournisseurGeneral {
  id: string;
  raison_sociale: string;
  secteur_activite?: string | null;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
  site_web?: string | null;
}

interface ViewFournisseurGeneralDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fournisseur: FournisseurGeneral | null;
}

export function ViewFournisseurGeneralDialog({ open, onOpenChange, fournisseur }: ViewFournisseurGeneralDialogProps) {
  if (!fournisseur) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Détails du fournisseur
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informations principales */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                {fournisseur.raison_sociale}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {fournisseur.secteur_activite && (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{fournisseur.secteur_activite}</span>
                </div>
              )}
              {fournisseur.adresse && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{fournisseur.adresse}</span>
                </div>
              )}
              {fournisseur.telephone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${fournisseur.telephone}`} className="text-sm text-primary hover:underline">
                    {fournisseur.telephone}
                  </a>
                </div>
              )}
              {fournisseur.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${fournisseur.email}`} className="text-sm text-primary hover:underline">
                    {fournisseur.email}
                  </a>
                </div>
              )}
              {fournisseur.site_web && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={fournisseur.site_web} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {fournisseur.site_web}
                  </a>
                </div>
              )}
              {!fournisseur.secteur_activite && !fournisseur.adresse && !fournisseur.telephone && !fournisseur.email && !fournisseur.site_web && (
                <p className="text-sm text-muted-foreground">
                  Aucune information complémentaire disponible
                </p>
              )}
            </CardContent>
          </Card>

          {/* Section Matching */}
          <MatchingHistorySection
            entityType="fournisseur"
            entityId={fournisseur.id}
            entityName={fournisseur.raison_sociale}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
