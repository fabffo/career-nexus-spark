import { useState, useEffect } from 'react';
import { Mission } from '@/types/mission';
import { missionService } from '@/services/missionService';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function MissionsClients() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadMissions();
  }, []);

  const loadMissions = async () => {
    try {
      setLoading(true);
      const data = await missionService.getAll();
      // Filtrer les missions liées à des contrats clients
      const missionsClients = data.filter(m => m.contrat?.type === 'CLIENT');
      setMissions(missionsClients);
    } catch (error: any) {
      console.error('Error loading missions:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les missions clients",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatutBadge = (statut?: string) => {
    if (!statut) return null;
    
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      'EN_COURS': 'default',
      'TERMINE': 'secondary',
      'ANNULE': 'destructive'
    };
    
    return <Badge variant={variants[statut] || 'outline'}>{statut}</Badge>;
  };

  const columns: ColumnDef<Mission>[] = [
    {
      accessorKey: 'titre',
      header: 'Titre',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.titre}</div>
      )
    },
    {
      accessorFn: (row) => row.contrat?.client?.raison_sociale || '',
      id: 'client',
      header: 'Client',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.contrat?.client?.raison_sociale || '-'}
        </div>
      )
    },
    {
      accessorKey: 'type_mission',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.type_mission}</Badge>
      )
    },
    {
      accessorKey: 'type_intervenant',
      header: 'Intervenant',
      cell: ({ row }) => (
        <div className="space-y-1">
          <Badge variant={row.original.type_intervenant === 'PRESTATAIRE' ? 'default' : 'secondary'}>
            {row.original.type_intervenant}
          </Badge>
          <div className="text-sm text-muted-foreground">
            {row.original.type_intervenant === 'PRESTATAIRE' 
              ? row.original.prestataire && `${row.original.prestataire.prenom} ${row.original.prestataire.nom}`
              : row.original.salarie && `${row.original.salarie.prenom} ${row.original.salarie.nom}`
            }
          </div>
        </div>
      )
    },
    {
      accessorKey: 'prix_ttc',
      header: 'Prix TTC',
      cell: ({ row }) => {
        const mission = row.original;
        if (mission.type_mission === 'TJM' && mission.tjm && mission.nombre_jours) {
          const total = mission.tjm * mission.nombre_jours * (1 + (mission.taux_tva || 20) / 100);
          return (
            <div className="text-right">
              <div className="font-medium">{total.toFixed(2)} €</div>
              <div className="text-xs text-muted-foreground">
                {mission.tjm}€/j × {mission.nombre_jours}j
              </div>
            </div>
          );
        }
        return (
          <div className="text-right font-medium">
            {mission.prix_ttc ? `${mission.prix_ttc.toFixed(2)} €` : '-'}
          </div>
        );
      }
    },
    {
      accessorKey: 'date_debut',
      header: 'Dates',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.date_debut && (
            <div>{format(new Date(row.original.date_debut), 'dd/MM/yyyy', { locale: fr })}</div>
          )}
          {row.original.date_fin && (
            <div className="text-muted-foreground">
              → {format(new Date(row.original.date_fin), 'dd/MM/yyyy', { locale: fr })}
            </div>
          )}
        </div>
      )
    },
    {
      accessorKey: 'statut',
      header: 'Statut',
      cell: ({ row }) => getStatutBadge(row.original.statut)
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Missions Clients</h1>
          <p className="text-muted-foreground">Missions liées aux contrats clients</p>
        </div>
        <Button onClick={() => window.location.href = '/missions'}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle mission
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={missions}
        searchPlaceholder="Rechercher une mission client..."
      />
    </div>
  );
}
