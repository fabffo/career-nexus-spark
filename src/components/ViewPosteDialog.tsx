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
            <h3 className="text-lg font-semibold">{poste.titre}</h3>
            {getStatusBadge(poste.statut)}
          </div>

          {/* Client */}
          {(poste.clients || client) && (
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Building2 className="h-4 w-4" />
                <span>Client</span>
              </div>
              <p className="ml-6 font-medium">
                {poste.clients?.raison_sociale || client?.raison_sociale || client?.raisonSociale}
              </p>
            </div>
          )}

          {/* Localisation */}
          {poste.localisation && (
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Briefcase className="h-4 w-4" />
                <span>Localisation</span>
              </div>
              <p className="ml-6 font-medium">{poste.localisation}</p>
            </div>
          )}

          {/* Type de contrat */}
          {poste.type_contrat && (
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <FileText className="h-4 w-4" />
                <span>Type de contrat</span>
              </div>
              <p className="ml-6 font-medium">{poste.type_contrat}</p>
            </div>
          )}

          {/* Salaire */}
          {(poste.salaire_min || poste.salaire_max) && (
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <span>Salaire</span>
              </div>
              <p className="ml-6 font-medium">
                {poste.salaire_min && poste.salaire_max 
                  ? `${poste.salaire_min}€ - ${poste.salaire_max}€`
                  : poste.salaire_min 
                  ? `À partir de ${poste.salaire_min}€`
                  : `Jusqu'à ${poste.salaire_max}€`
                }
              </p>
            </div>
          )}

          {/* Pourvu par */}
          {poste.pourvu_par && (
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Briefcase className="h-4 w-4" />
                <span>Pourvu par</span>
              </div>
              <p className="ml-6 font-medium">{poste.pourvu_par}</p>
            </div>
          )}

          {/* Description */}
          {poste.description && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>Description</span>
              </div>
              <div className="ml-6 bg-muted/50 rounded-lg p-3">
                <p className="text-sm whitespace-pre-wrap">{poste.description}</p>
              </div>
            </div>
          )}

          {/* Compétences */}
          {poste.competences && poste.competences.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Compétences requises</span>
              </div>
              <div className="ml-6 flex flex-wrap gap-2">
                {poste.competences.map((comp: string, idx: number) => (
                  <Badge key={idx} variant="secondary">{comp}</Badge>
                ))}
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