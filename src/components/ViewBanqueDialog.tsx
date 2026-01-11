import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Building2, Mail, Phone, Globe, MapPin } from 'lucide-react';
import { RapprochementSearchSection } from './RapprochementSearchSection';
import { MatchingHistorySection } from './MatchingHistorySection';

interface Banque {
  id: string;
  raison_sociale: string;
  secteur_activite: string | null;
  adresse: string | null;
  email: string | null;
  telephone: string | null;
  site_web: string | null;
}

interface ViewBanqueDialogProps {
  banque: Banque | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ViewBanqueDialog({ banque, open, onOpenChange }: ViewBanqueDialogProps) {
  if (!banque) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {banque.raison_sociale}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informations générales */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informations générales</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Secteur d'activité</p>
                <p className="font-medium">{banque.secteur_activite || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Adresse
                </p>
                <p className="font-medium">{banque.adresse || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email
                </p>
                <p className="font-medium">{banque.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Téléphone
                </p>
                <p className="font-medium">{banque.telephone || '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Site Web
                </p>
                {banque.site_web ? (
                  <a href={banque.site_web} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                    {banque.site_web}
                  </a>
                ) : (
                  <p className="font-medium">-</p>
                )}
              </div>
            </div>
          </div>

          {/* Section recherche rapprochement */}
          <RapprochementSearchSection 
            entityId={banque.id}
            entityName={banque.raison_sociale}
            entityType="banque"
          />

          {/* Historique des rapprochements */}
          <MatchingHistorySection 
            entityId={banque.id}
            entityName={banque.raison_sociale}
            entityType="banque"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
