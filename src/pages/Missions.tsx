import { useState, useEffect } from 'react';
import { Mission, TypeMission, TypeIntervenant } from '@/types/mission';
import { missionService } from '@/services/missionService';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Eye, Euro, Calendar, User, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AddMissionDialog } from '@/components/AddMissionDialog';
import { EditMissionDialog } from '@/components/EditMissionDialog';
import { ViewMissionDialog } from '@/components/ViewMissionDialog';

export function Missions() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadMissions();
  }, []);

  const loadMissions = async () => {
    try {
      setLoading(true);
      const data = await missionService.getAll();
      setMissions(data);
    } catch (error: any) {
      console.error('Error loading missions:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les missions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette mission ?')) {
      return;
    }

    try {
      await missionService.delete(id);
      toast({
        title: "Succès",
        description: "Mission supprimée avec succès"
      });
      loadMissions();
    } catch (error: any) {
      console.error('Error deleting mission:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la mission",
        variant: "destructive"
      });
    }
  };

  const handleView = (mission: Mission) => {
    setSelectedMission(mission);
    setShowViewDialog(true);
  };

  const handleEdit = (mission: Mission) => {
    setSelectedMission(mission);
    setShowEditDialog(true);
  };

  const getTypeMissionBadge = (type: TypeMission) => {
    const variants: Record<TypeMission, "default" | "secondary" | "outline"> = {
      'FORFAIT': 'default',
      'TJM': 'secondary',
      'RECRUTEMENT': 'outline'
    };
    return <Badge variant={variants[type]}>{type}</Badge>;
  };

  const getTypeIntervenantBadge = (type: TypeIntervenant) => {
    const variants: Record<TypeIntervenant, "default" | "secondary"> = {
      'PRESTATAIRE': 'default',
      'SALARIE': 'secondary'
    };
    return <Badge variant={variants[type]}>{type}</Badge>;
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
      accessorKey: 'numero_mission',
      header: 'N° Mission',
      cell: ({ row }) => (
        <div className="font-mono text-sm">{row.original.numero_mission || '-'}</div>
      )
    },
    {
      accessorKey: 'titre',
      header: 'Titre',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.titre}</div>
      )
    },
    {
      accessorKey: 'type_mission',
      header: 'Type',
      cell: ({ row }) => getTypeMissionBadge(row.original.type_mission)
    },
    {
      accessorKey: 'type_intervenant',
      header: 'Intervenant',
      cell: ({ row }) => (
        <div className="space-y-1">
          {getTypeIntervenantBadge(row.original.type_intervenant)}
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
      accessorKey: 'contrat',
      header: 'Contrat',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.contrat?.numero_contrat || '-'}
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
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleView(row.original)}
            title="Voir la mission"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(row.original)}
            title="Modifier la mission"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(row.original.id)}
            title="Supprimer la mission"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Missions</h1>
          <p className="text-muted-foreground">Gérez vos missions et affectations</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle mission
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={missions}
        searchPlaceholder="Rechercher une mission..."
      />

      {showAddDialog && (
        <AddMissionDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onSuccess={loadMissions}
        />
      )}

      {showEditDialog && selectedMission && (
        <EditMissionDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          mission={selectedMission}
          onSuccess={loadMissions}
        />
      )}

      {showViewDialog && selectedMission && (
        <ViewMissionDialog
          open={showViewDialog}
          onOpenChange={setShowViewDialog}
          mission={selectedMission}
        />
      )}
    </div>
  );
}