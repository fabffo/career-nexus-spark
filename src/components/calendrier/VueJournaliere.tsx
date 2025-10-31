import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RdvData } from './CalendrierRecrutement';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, MapPin, User, Briefcase, Edit, Eye } from 'lucide-react';

interface VueJournaliereProps {
  currentDate: Date;
  rdvs: RdvData[];
  onRdvClick: (rdv: RdvData) => void;
  onEditRdv: (rdv: RdvData) => void;
}

export default function VueJournaliere({ currentDate, rdvs, onRdvClick, onEditRdv }: VueJournaliereProps) {
  // Filtrer les RDVs du jour sélectionné
  const dayRdvs = rdvs.filter(rdv => {
    const rdvDate = new Date(rdv.date);
    return (
      rdvDate.getFullYear() === currentDate.getFullYear() &&
      rdvDate.getMonth() === currentDate.getMonth() &&
      rdvDate.getDate() === currentDate.getDate()
    );
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const getStatusBadge = (statut: string) => {
    const variants = {
      'ENCOURS': { label: 'Planifié', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      'REALISE': { label: 'Confirmé', className: 'bg-green-100 text-green-800 border-green-200' },
      'TERMINE': { label: 'Terminé', className: 'bg-gray-100 text-gray-800 border-gray-200' },
      'ANNULE': { label: 'Annulé', className: 'bg-red-100 text-red-800 border-red-200' },
    };
    const variant = variants[statut as keyof typeof variants] || variants.ENCOURS;
    return <Badge className={cn('border', variant.className)}>{variant.label}</Badge>;
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'TELEPHONE': '📞 Téléphonique',
      'TEAMS': '💻 Visio',
      'PRESENTIEL_CLIENT': '🏢 Présentiel',
    };
    return types[type] || type;
  };

  const getTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 18; hour++) {
      slots.push(hour);
    }
    return slots;
  };

  const getRdvForTimeSlot = (hour: number) => {
    return dayRdvs.filter(rdv => {
      const rdvHour = new Date(rdv.date).getHours();
      return rdvHour === hour;
    });
  };

  return (
    <div className="space-y-4">
      {/* En-tête du jour */}
      <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg">
        <div>
          <h2 className="text-2xl font-bold capitalize">
            {format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
          </h2>
          <p className="text-muted-foreground mt-1">
            {dayRdvs.length} rendez-vous prévu{dayRdvs.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {dayRdvs.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Aucun rendez-vous prévu pour cette journée</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Vue chronologique */}
          {getTimeSlots().map(hour => {
            const slotRdvs = getRdvForTimeSlot(hour);
            
            if (slotRdvs.length === 0) {
              return (
                <div key={hour} className="flex gap-4 items-start py-2 border-b border-dashed opacity-50">
                  <div className="w-20 text-sm text-muted-foreground font-medium">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  <div className="flex-1 text-sm text-muted-foreground italic">
                    Pas de rendez-vous
                  </div>
                </div>
              );
            }

            return (
              <div key={hour} className="flex gap-4 items-start py-2">
                <div className="w-20 text-sm text-muted-foreground font-medium">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                <div className="flex-1 space-y-2">
                  {slotRdvs.map(rdv => (
                    <Card key={rdv.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          {/* Heure et statut */}
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Clock className="h-4 w-4 text-primary" />
                              {format(new Date(rdv.date), 'HH:mm')}
                            </div>
                            {getStatusBadge(rdv.statut)}
                            <Badge variant="outline">{getTypeLabel(rdv.type_rdv)}</Badge>
                          </div>

                          {/* Candidat */}
                          {rdv.candidat && (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold">
                                {rdv.candidat.prenom} {rdv.candidat.nom}
                              </span>
                            </div>
                          )}

                          {/* Poste */}
                          {rdv.poste && (
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {rdv.poste.titre}
                              </span>
                            </div>
                          )}

                          {/* Lieu */}
                          {rdv.lieu && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{rdv.lieu}</span>
                            </div>
                          )}

                          {/* Notes */}
                          {rdv.notes && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {rdv.notes}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => onRdvClick(rdv)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => onEditRdv(rdv)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
