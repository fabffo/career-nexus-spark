import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mission } from '@/types/mission';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Calendar, 
  Euro, 
  User, 
  FileText, 
  MapPin, 
  Briefcase,
  Hash,
  Clock
} from 'lucide-react';

interface ViewMissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mission: Mission;
}

export function ViewMissionDialog({ open, onOpenChange, mission }: ViewMissionDialogProps) {
  const getTypeMissionLabel = (type: string) => {
    const labels: Record<string, string> = {
      'FORFAIT': 'Forfait',
      'TJM': 'Taux journalier (TJM)',
      'RECRUTEMENT': 'Recrutement'
    };
    return labels[type] || type;
  };

  const getTypeIntervenantLabel = (type: string) => {
    const labels: Record<string, string> = {
      'PRESTATAIRE': 'Prestataire',
      'SALARIE': 'Salarié'
    };
    return labels[type] || type;
  };

  const getStatutVariant = (statut?: string): "default" | "secondary" | "destructive" => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      'EN_COURS': 'default',
      'TERMINE': 'secondary',
      'ANNULE': 'destructive'
    };
    return variants[statut || ''] || 'default';
  };

  const calculateTotal = () => {
    if (mission.type_mission === 'TJM' && mission.tjm && mission.nombre_jours) {
      const ht = mission.tjm * mission.nombre_jours;
      const ttc = ht * (1 + (mission.taux_tva || 20) / 100);
      return { ht, ttc };
    }
    return { 
      ht: mission.prix_ht || 0, 
      ttc: mission.prix_ttc || 0 
    };
  };

  const totals = calculateTotal();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Détails de la mission</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Titre et statut */}
          <div>
            <h3 className="text-xl font-semibold">{mission.titre}</h3>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={getStatutVariant(mission.statut)}>
                {mission.statut || 'EN_COURS'}
              </Badge>
              <Badge variant="outline">
                {getTypeMissionLabel(mission.type_mission)}
              </Badge>
              <Badge variant="outline">
                {getTypeIntervenantLabel(mission.type_intervenant)}
              </Badge>
            </div>
          </div>

          {/* Description */}
          {mission.description && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" />
                Description
              </div>
              <p className="text-sm whitespace-pre-wrap">{mission.description}</p>
            </div>
          )}

          {/* Localisation */}
          {mission.localisation && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Localisation
              </div>
              <p className="text-sm">{mission.localisation}</p>
            </div>
          )}

          {/* Compétences */}
          {mission.competences && mission.competences.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                Compétences requises
              </div>
              <div className="flex flex-wrap gap-2">
                {mission.competences.map((comp, index) => (
                  <Badge key={index} variant="secondary">
                    {comp}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Intervenant */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="h-4 w-4" />
              Intervenant
            </div>
            <div className="text-sm">
              {mission.type_intervenant === 'PRESTATAIRE' && mission.prestataire ? (
                <div>
                  {mission.prestataire.prenom} {mission.prestataire.nom}
                  {mission.prestataire.email && (
                    <span className="text-muted-foreground"> ({mission.prestataire.email})</span>
                  )}
                </div>
              ) : mission.type_intervenant === 'SALARIE' && mission.salarie ? (
                <div>
                  {mission.salarie.prenom} {mission.salarie.nom}
                  {mission.salarie.fonction && (
                    <span className="text-muted-foreground"> - {mission.salarie.fonction}</span>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">Non assigné</span>
              )}
            </div>
          </div>

          {/* Contrat associé */}
          {mission.contrat && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" />
                Contrat associé
              </div>
              <div className="text-sm">
                {mission.contrat.numero_contrat} - {mission.contrat.type}
                {mission.contrat.statut && (
                  <Badge variant="outline" className="ml-2">
                    {mission.contrat.statut}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Poste associé */}
          {mission.poste && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                Poste associé
              </div>
              <div className="text-sm">
                {mission.poste.titre}
                {mission.poste.client && (
                  <span className="text-muted-foreground"> - {mission.poste.client.raison_sociale}</span>
                )}
              </div>
            </div>
          )}

          {/* Informations financières */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Euro className="h-4 w-4" />
              Informations financières
            </div>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              {mission.type_mission === 'TJM' ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span>TJM</span>
                    <span className="font-medium">{mission.tjm?.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Nombre de jours</span>
                    <span className="font-medium">{mission.nombre_jours}</span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between text-sm">
                      <span>Total HT</span>
                      <span className="font-medium">{totals.ht.toFixed(2)} €</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-sm">
                  <span>Prix HT</span>
                  <span className="font-medium">{totals.ht.toFixed(2)} €</span>
                </div>
              )}
              
              <div className="flex justify-between text-sm">
                <span>TVA ({mission.taux_tva || 20}%)</span>
                <span className="font-medium">
                  {((totals.ttc - totals.ht)).toFixed(2)} €
                </span>
              </div>
              
              <div className="border-t pt-2">
                <div className="flex justify-between">
                  <span className="font-medium">Total TTC</span>
                  <span className="font-bold text-lg">{totals.ttc.toFixed(2)} €</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Dates
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Date de début: </span>
                {mission.date_debut ? (
                  <span className="font-medium">
                    {format(new Date(mission.date_debut), 'dd MMMM yyyy', { locale: fr })}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Non définie</span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Date de fin: </span>
                {mission.date_fin ? (
                  <span className="font-medium">
                    {format(new Date(mission.date_fin), 'dd MMMM yyyy', { locale: fr })}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Non définie</span>
                )}
              </div>
            </div>
          </div>

          {/* Informations d'audit */}
          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="h-4 w-4" />
              Informations système
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
              {mission.created_at && (
                <div>
                  Créé le {format(new Date(mission.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                </div>
              )}
              {mission.updated_at && (
                <div>
                  Modifié le {format(new Date(mission.updated_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}