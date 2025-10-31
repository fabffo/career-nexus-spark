import { Badge } from '@/components/ui/badge';
import { RdvData } from './CalendrierRecrutement';
import { cn } from '@/lib/utils';

interface VueAnnuelleProps {
  currentDate: Date;
  rdvs: RdvData[];
  onMonthClick: (month: number) => void;
}

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function VueAnnuelle({ currentDate, rdvs, onMonthClick }: VueAnnuelleProps) {
  const year = currentDate.getFullYear();

  const getRdvsForMonth = (month: number) => {
    return rdvs.filter(rdv => {
      const rdvDate = new Date(rdv.date);
      return rdvDate.getFullYear() === year && rdvDate.getMonth() === month;
    });
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {MOIS.map((mois, index) => {
        const monthRdvs = getRdvsForMonth(index);
        const hasRdvs = monthRdvs.length > 0;
        const rdvsByStatut = monthRdvs.reduce((acc, rdv) => {
          acc[rdv.statut] = (acc[rdv.statut] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return (
          <div
            key={mois}
            onClick={() => onMonthClick(index)}
            className={cn(
              "p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md",
              hasRdvs ? "bg-primary/5 border-primary/20" : "bg-card"
            )}
          >
            <h3 className="font-semibold mb-3">{mois}</h3>
            
            {hasRdvs ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <Badge variant="secondary">{monthRdvs.length}</Badge>
                </div>
                
                <div className="space-y-1">
                  {Object.entries(rdvsByStatut).map(([statut, count]) => (
                    <div key={statut} className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", getStatusColor(statut))} />
                      <span className="text-xs text-muted-foreground flex-1">{statut}</span>
                      <span className="text-xs font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun rendez-vous</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
