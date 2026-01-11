import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building, Mail, Phone, Globe, MapPin } from 'lucide-react';
import { RapprochementSearchSection } from './RapprochementSearchSection';
import { MatchingHistorySection } from './MatchingHistorySection';

interface ViewFournisseurServicesDialogProps {
  fournisseur: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewFournisseurServicesDialog({ fournisseur, open, onOpenChange }: ViewFournisseurServicesDialogProps) {
  if (!fournisseur) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            {fournisseur.raison_sociale}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informations générales */}
          <div className="grid grid-cols-2 gap-4">
            {fournisseur.secteur_activite && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Secteur d'activité</h3>
                <p>{fournisseur.secteur_activite}</p>
              </div>
            )}
            {fournisseur.adresse && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Adresse</h3>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{fournisseur.adresse}</span>
                </div>
              </div>
            )}
            {fournisseur.email && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Email</h3>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{fournisseur.email}</span>
                </div>
              </div>
            )}
            {fournisseur.telephone && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Téléphone</h3>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{fournisseur.telephone}</span>
                </div>
              </div>
            )}
            {fournisseur.site_web && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Site Web</h3>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={fournisseur.site_web} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {fournisseur.site_web}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Recherche de rapprochement */}
          <RapprochementSearchSection
            entityType="fournisseur_services"
            entityId={fournisseur.id}
            entityName={fournisseur.raison_sociale}
          />

          {/* Historique des matchings */}
          <MatchingHistorySection
            entityType="fournisseur_services"
            entityId={fournisseur.id}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
