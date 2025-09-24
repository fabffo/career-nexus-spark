import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { User, Mail, Phone, MapPin, Briefcase, FileText, Award } from 'lucide-react';

interface ViewCandidatDialogProps {
  candidat: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewCandidatDialog({ candidat, open, onOpenChange }: ViewCandidatDialogProps) {
  if (!candidat) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Détails du candidat
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-1">
            {/* Nom et prénom */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                {candidat.prenom} {candidat.nom}
              </h3>
            </div>

            {/* Métier */}
            {candidat.metier && (
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Briefcase className="h-4 w-4" />
                  <span>Métier</span>
                </div>
                <p className="ml-6 font-medium">{candidat.metier}</p>
              </div>
            )}

            {/* Coordonnées */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Coordonnées</h4>
              
              {(candidat.email || candidat.mail) && (
                <div className="flex items-center gap-2 ml-2">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <a href={`mailto:${candidat.email || candidat.mail}`} className="text-primary hover:underline break-all">
                    {candidat.email || candidat.mail}
                  </a>
                </div>
              )}

              {candidat.telephone && (
                <div className="flex items-center gap-2 ml-2">
                  <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <a href={`tel:${candidat.telephone}`} className="text-primary hover:underline">
                    {candidat.telephone}
                  </a>
                </div>
              )}

              {candidat.adresse && (
                <div className="flex items-start gap-2 ml-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-sm break-words">{candidat.adresse}</p>
                </div>
              )}
            </div>

            {/* Détail CV */}
            {candidat.detail_cv && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Détail CV</h4>
                <div className="ml-2 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap break-words">{candidat.detail_cv}</p>
                </div>
              </div>
            )}

            {/* Documents */}
            {(candidat.cvUrl || candidat.recommandationUrl) && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Documents</h4>
                <div className="flex flex-wrap gap-2 ml-2">
                  {candidat.cvUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(candidat.cvUrl, '_blank')}
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Voir CV
                    </Button>
                  )}
                  {candidat.recommandationUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(candidat.recommandationUrl, '_blank')}
                      className="gap-2"
                    >
                      <Award className="h-4 w-4" />
                      Voir recommandation
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Métadonnées */}
            {(candidat.created_at || candidat.createdAt) && (
              <div className="border-t pt-4 text-xs text-muted-foreground space-y-1">
                <p>Créé le {new Date(candidat.created_at || candidat.createdAt).toLocaleDateString('fr-FR')}</p>
                {(candidat.updated_at || candidat.updatedAt) && (
                  <p>Modifié le {new Date(candidat.updated_at || candidat.updatedAt).toLocaleDateString('fr-FR')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}