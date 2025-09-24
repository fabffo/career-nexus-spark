import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, MapPin, Calendar, User, Building, FileText, Video } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ViewRdvDialogProps {
  rdv: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewRdvDialog({ rdv, open, onOpenChange }: ViewRdvDialogProps) {
  if (!rdv) return null;

  const typeLabels: Record<string, string> = {
    'TEAMS': 'Teams',
    'PRESENTIEL_CLIENT': 'Présentiel',
    'TELEPHONE': 'Téléphone'
  };

  const statutColors: Record<string, any> = {
    'ENCOURS': 'default',
    'REALISE': 'secondary',
    'TERMINE': 'outline',
    'ANNULE': 'destructive',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Détails du rendez-vous
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Date et statut */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {format(new Date(rdv.date), 'EEEE dd MMMM yyyy à HH:mm', { locale: fr })}
              </span>
            </div>
            <Badge variant={statutColors[rdv.statut]}>{rdv.statut}</Badge>
          </div>

          {/* Type de RDV */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Type de rendez-vous</span>
              <div className="mt-1">
                <Badge variant={rdv.rdv_type === 'CLIENT' ? 'default' : 'secondary'}>
                  {rdv.rdv_type}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Modalité</span>
              <div className="mt-1">
                <Badge variant="outline">{typeLabels[rdv.type_rdv] || rdv.type_rdv}</Badge>
              </div>
            </div>
          </div>

          {/* Candidat */}
          {rdv.candidats && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Candidat</span>
              </div>
              <div className="ml-6 space-y-1">
                <p className="font-medium">{rdv.candidats.prenom} {rdv.candidats.nom}</p>
                {rdv.candidats.email && (
                  <p className="text-sm text-muted-foreground">{rdv.candidats.email}</p>
                )}
              </div>
            </div>
          )}

          {/* Client */}
          {rdv.clients && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Client</span>
              </div>
              <div className="ml-6">
                <p className="font-medium">{rdv.clients.raison_sociale}</p>
              </div>
            </div>
          )}

          {/* Contact (Recruteur ou Référent) */}
          {(rdv.profiles || rdv.referents) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {rdv.rdv_type === 'CLIENT' ? 'Référent' : 'Recruteur'}
                </span>
              </div>
              <div className="ml-6">
                {rdv.rdv_type === 'CLIENT' && rdv.referents ? (
                  <p className="font-medium">{rdv.referents.prenom} {rdv.referents.nom}</p>
                ) : rdv.profiles ? (
                  <p className="font-medium">{rdv.profiles.prenom} {rdv.profiles.nom}</p>
                ) : null}
              </div>
            </div>
          )}

          {/* Lieu */}
          {rdv.lieu && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Lieu</span>
              </div>
              <div className="ml-6">
                <p className="text-sm">{rdv.lieu}</p>
              </div>
            </div>
          )}

          {/* Lien Teams */}
          {rdv.type_rdv === 'TEAMS' && rdv.teams_link && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Lien Teams</span>
              </div>
              <div className="ml-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(rdv.teams_link, '_blank')}
                  className="gap-2"
                >
                  <Video className="h-4 w-4" />
                  Rejoindre la réunion
                </Button>
              </div>
            </div>
          )}

          {/* Notes */}
          {rdv.notes && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Notes</span>
              </div>
              <div className="ml-6 bg-muted/50 rounded-lg p-3">
                <p className="text-sm whitespace-pre-wrap">{rdv.notes}</p>
              </div>
            </div>
          )}

          {/* Métadonnées */}
          <div className="border-t pt-4 text-xs text-muted-foreground space-y-1">
            {rdv.created_at && (
              <p>Créé le {format(new Date(rdv.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}</p>
            )}
            {rdv.updated_at && (
              <p>Modifié le {format(new Date(rdv.updated_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}