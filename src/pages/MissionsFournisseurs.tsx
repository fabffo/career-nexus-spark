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
import { EditMissionDialog } from '@/components/EditMissionDialog';
import { ViewMissionDialog } from '@/components/ViewMissionDialog';

export default function MissionsFournisseurs() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
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
      // Filtrer les missions liées à des contrats fournisseurs
      const missionsFournisseurs = data.filter(m => 
        m.contrat?.type === 'PRESTATAIRE' || 
        m.contrat?.type === 'FOURNISSEUR_SERVICES' || 
        m.contrat?.type === 'FOURNISSEUR_GENERAL'
      );
      setMissions(missionsFournisseurs);
    } catch (error: any) {
      console.error('Error loading missions:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les missions fournisseurs",
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

  const getStatutBadge = (statut?: string) => {
    if (!statut) return null;
    
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      'EN_COURS': 'default',
      'TERMINE': 'secondary',
      'ANNULE': 'destructive'
    };
    
    return <Badge variant={variants[statut] || 'outline'}>{statut}</Badge>;
  };

  const getFournisseurNom = (mission: Mission) => {
    if (!mission.contrat) return '-';
    
    const contrat = mission.contrat;
    if (contrat.type === 'PRESTATAIRE' && contrat.prestataire) {
      return `${contrat.prestataire.prenom} ${contrat.prestataire.nom}`;
    }
    if (contrat.type === 'FOURNISSEUR_SERVICES' && contrat.fournisseur_services) {
      return contrat.fournisseur_services.raison_sociale;
    }
    if (contrat.type === 'FOURNISSEUR_GENERAL' && contrat.fournisseur_general) {
      return contrat.fournisseur_general.raison_sociale;
    }
    return '-';
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
      id: 'fournisseur',
      header: 'Fournisseur',
      cell: ({ row }) => (
        <div className="text-sm">
          {getFournisseurNom(row.original)}
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
          <h1 className="text-3xl font-bold">Missions Fournisseurs</h1>
          <p className="text-muted-foreground">Missions liées aux contrats fournisseurs</p>
        </div>
        <Button onClick={() => window.location.href = '/missions'}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle mission
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={missions}
        searchPlaceholder="Rechercher une mission fournisseur..."
      />

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
