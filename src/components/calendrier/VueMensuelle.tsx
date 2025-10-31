import { Badge } from '@/components/ui/badge';
import { RdvData } from './CalendrierRecrutement';
import { cn } from '@/lib/utils';
import { startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface VueMensuelleProps {
  currentDate: Date;
  rdvs: RdvData[];
  onDayClick: (date: Date) => void;
  onRdvClick: (rdv: RdvData) => void;
}

const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export default function VueMensuelle({ currentDate, rdvs, onDayClick, onRdvClick }: VueMensuelleProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getRdvsForDay = (date: Date) => {
    return rdvs.filter(rdv => isSameDay(new Date(rdv.date), date));
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'ENCOURS': return 'bg-blue-500';
      case 'REALISE': return 'bg-green-500';
      case 'TERMINE': return 'bg-gray-500';
      case 'ANNULE': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'TELEPHONE': return '📞';
      case 'TEAMS': return '💻';
      case 'PRESENTIEL_CLIENT': return '🏢';
      default: return '📅';
    }
  };

  return (
    <div className="space-y-2">
      {/* En-têtes des jours */}
      <div className="grid grid-cols-7 gap-2">
        {JOURS_SEMAINE.map(jour => (
          <div key={jour} className="text-center text-sm font-semibold text-muted-foreground p-2">
            {jour}
          </div>
        ))}
      </div>

      {/* Grille du calendrier */}
      <div className="grid grid-cols-7 gap-2">
        {days.map(day => {
          const dayRdvs = getRdvsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());
          const hasRdvs = dayRdvs.length > 0;

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                "min-h-[100px] p-2 border rounded-lg cursor-pointer transition-all hover:shadow-md",
                !isCurrentMonth && "bg-muted/50 text-muted-foreground",
                isToday && "border-primary border-2",
                hasRdvs && isCurrentMonth && "bg-primary/5"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  "text-sm font-medium",
                  isToday && "text-primary"
                )}>
                  {format(day, 'd')}
                </span>
                {hasRdvs && (
                  <Badge variant="secondary" className="text-xs px-1 py-0">
                    {dayRdvs.length}
                  </Badge>
                )}
              </div>

              <div className="space-y-1">
                {dayRdvs.slice(0, 3).map(rdv => (
                  <div
                    key={rdv.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRdvClick(rdv);
                    }}
                    className={cn(
                      "text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 transition-opacity",
                      "border-l-2",
                      rdv.statut === 'ENCOURS' && "bg-blue-50 border-blue-500",
                      rdv.statut === 'REALISE' && "bg-green-50 border-green-500",
                      rdv.statut === 'TERMINE' && "bg-gray-50 border-gray-500",
                      rdv.statut === 'ANNULE' && "bg-red-50 border-red-500"
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <span>{getTypeIcon(rdv.type_rdv)}</span>
                      <span className="truncate">
                        {format(new Date(rdv.date), 'HH:mm')}
                      </span>
                    </div>
                    {rdv.candidat && (
                      <div className="truncate font-medium">
                        {rdv.candidat.prenom} {rdv.candidat.nom}
                      </div>
                    )}
                  </div>
                ))}
                {dayRdvs.length > 3 && (
                  <div className="text-xs text-muted-foreground text-center">
                    +{dayRdvs.length - 3} autres
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
