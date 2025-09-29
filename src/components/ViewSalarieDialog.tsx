import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Salarie } from '@/types/salarie';
import { User, Mail, Phone, FileText, Calendar, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ViewSalarieDialogProps {
  salarie: Salarie | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewSalarieDialog({ salarie, open, onOpenChange }: ViewSalarieDialogProps) {
  if (!salarie) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Détails du salarié</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informations personnelles */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Informations personnelles</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Nom complet</p>
                  <p className="font-medium">{salarie.prenom} {salarie.nom}</p>
                </div>
              </div>

              {salarie.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{salarie.email}</p>
                  </div>
                </div>
              )}

              {salarie.telephone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Téléphone</p>
                    <p className="font-medium">{salarie.telephone}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Détails CV */}
          {salarie.detail_cv && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg border-b pb-2">Détails du CV</h3>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{salarie.detail_cv}</p>
              </div>
            </div>
          )}

          {/* Documents */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg border-b pb-2">Documents</h3>
            <div className="flex flex-wrap gap-3">
              {salarie.cv_url ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(salarie.cv_url, '_blank')}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Voir CV
                  <ExternalLink className="h-3 w-3" />
                </Button>
              ) : (
                <Badge variant="secondary">Pas de CV</Badge>
              )}

              {salarie.recommandation_url ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(salarie.recommandation_url, '_blank')}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Voir Recommandation
                  <ExternalLink className="h-3 w-3" />
                </Button>
              ) : (
                <Badge variant="secondary">Pas de recommandation</Badge>
              )}
            </div>
          </div>

          {/* Métadonnées */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg border-b pb-2">Informations système</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {salarie.created_at && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Créé le</p>
                    <p className="font-medium">
                      {format(new Date(salarie.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>
                </div>
              )}

              {salarie.updated_at && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Modifié le</p>
                    <p className="font-medium">
                      {format(new Date(salarie.updated_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}