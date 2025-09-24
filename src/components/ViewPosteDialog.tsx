import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Building2, Calendar, FileText, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ViewPosteDialogProps {
  poste: any;
  client?: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewPosteDialog({ poste, client, open, onOpenChange }: ViewPosteDialogProps) {
  if (!poste) return null;

  const getStatusBadge = (statut: string) => {
    const variants: Record<string, string> = {
      'ENCOURS': 'bg-blue-100 text-blue-800 border-blue-200',
      'REALISE': 'bg-green-100 text-green-800 border-green-200',
      'ANNULE': 'bg-red-100 text-red-800 border-red-200',
    };

    return (
      <Badge className={cn('font-medium border', variants[statut] || 'bg-gray-100')}>
        {statut}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Détails du poste
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 overflow-y-auto max-h-[calc(90vh-120px)] pr-2">
          {/* En-tête avec nom et statut */}
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold">{poste.nomPoste || poste.nom_poste}</h3>
            {getStatusBadge(poste.statut)}
          </div>

          {/* Pourvu par */}
          {(poste.pourvuPar || poste.pourvu_par) && (
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Briefcase className="h-4 w-4" />
                <span>Pourvu par</span>
              </div>
              <p className="ml-6 font-medium">{poste.pourvuPar || poste.pourvu_par}</p>
            </div>
          )}

          {/* Client */}
          {client && (
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Building2 className="h-4 w-4" />
                <span>Client</span>
              </div>
              <p className="ml-6 font-medium">{client.raisonSociale || client.raison_sociale}</p>
            </div>
          )}

          {/* Dates */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Dates</h4>
            
            {(poste.dateCreation || poste.date_creation) && (
              <div className="flex items-center gap-2 ml-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Créé le {format(new Date(poste.dateCreation || poste.date_creation), 'dd MMMM yyyy', { locale: fr })}
                </span>
              </div>
            )}

            {(poste.dateEcheance || poste.date_echeance) && (
              <div className="flex items-center gap-2 ml-2">
                <Calendar className="h-4 w-4 text-warning" />
                <span className="text-sm">
                  Échéance : {format(new Date(poste.dateEcheance || poste.date_echeance), 'dd MMMM yyyy', { locale: fr })}
                </span>
              </div>
            )}
          </div>

          {/* Détails */}
          {poste.detail && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>Description détaillée</span>
              </div>
              <div className="ml-6 bg-muted/50 rounded-lg p-3">
                <p className="text-sm whitespace-pre-wrap">{poste.detail}</p>
              </div>
            </div>
          )}

          {/* Métadonnées */}
          {(poste.created_at || poste.createdAt) && (
            <div className="border-t pt-4 text-xs text-muted-foreground space-y-1">
              <p>Créé le {new Date(poste.created_at || poste.createdAt).toLocaleDateString('fr-FR')}</p>
              {(poste.updated_at || poste.updatedAt) && (
                <p>Modifié le {new Date(poste.updated_at || poste.updatedAt).toLocaleDateString('fr-FR')}</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}