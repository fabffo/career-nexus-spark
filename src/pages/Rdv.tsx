import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Plus, Video, ExternalLink, Eye, Copy } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { AddRdvDialog } from '@/components/AddRdvDialog';
import { EditRdvDialog } from '@/components/EditRdvDialog';
import { ViewRdvDialog } from '@/components/ViewRdvDialog';
import { useAuth } from '@/contexts/AuthContext';

interface RdvWithRelations {
  id: string;
  date: string;
  type_rdv: string;
  rdv_type: 'RECRUTEUR' | 'CLIENT';
  statut: string;
  lieu?: string;
  notes?: string;
  candidat_id: string;
  client_id: string;
  poste_id?: string;
  recruteur_id?: string;
  referent_id?: string;
  teams_link?: string;
  teams_meeting_id?: string;
  candidats?: {
    nom: string;
    prenom: string;
    email?: string;
  };
  clients?: {
    raison_sociale: string;
  };
  postes?: {
    titre: string;
  };
  profiles?: {
    nom: string;
    prenom: string;
  };
  referents?: {
    nom: string;
    prenom: string;
  };
  rdv_referents?: {
    referent_id: string;
    referents: {
      nom: string;
      prenom: string;
      fonction?: string;
    };
  }[];
  created_at?: string;
  updated_at?: string;
}

export default function RendezVous() {
  const [rdvs, setRdvs] = useState<RdvWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRdv, setSelectedRdv] = useState<RdvWithRelations | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rdvs')
        .select(`
          *,
          candidats(nom, prenom, email),
          clients(raison_sociale)
        `)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error loading RDVs:', error);
        throw error;
      }
      
      console.log('RDVs loaded:', data);
      setRdvs(data || []);
    } catch (error: any) {
      console.error('Error in loadData:', error);
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce rendez-vous ?')) return;

    try {
      const { error } = await supabase
        .from('rdvs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Rendez-vous supprimé avec succès" });
      loadData();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCopy = async (rdv: RdvWithRelations) => {
    try {
      const rdvCopy = {
        date: rdv.date,
        type_rdv: rdv.type_rdv,
        rdv_type: rdv.rdv_type,
        statut: 'ENCOURS' as const,
        lieu: rdv.lieu,
        notes: rdv.notes,
        candidat_id: rdv.candidat_id,
        client_id: rdv.client_id,
        recruteur_id: rdv.recruteur_id,
      };

      const { data: copiedRdv, error } = await supabase
        .from('rdvs')
        .insert(rdvCopy)
        .select()
        .single();

      if (error) throw error;

      // Copier les référents si c'est un RDV client
      if (rdv.rdv_type === 'CLIENT' && rdv.rdv_referents && rdv.rdv_referents.length > 0) {
        const referentLinks = rdv.rdv_referents.map(r => ({
          rdv_id: copiedRdv.id,
          referent_id: r.referent_id
        }));

        await supabase
          .from('rdv_referents')
          .insert(referentLinks);
      }

      if (error) throw error;
      toast({ title: "Rendez-vous dupliqué avec succès" });
      loadData();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleView = (rdv: RdvWithRelations) => {
    setSelectedRdv(rdv);
    setViewDialogOpen(true);
  };

  const columns: ColumnDef<RdvWithRelations>[] = [
    {
      accessorKey: 'date',
      header: 'Date & Heure',
      cell: ({ row }) => format(new Date(row.original.date), 'dd/MM/yyyy HH:mm', { locale: fr }),
    },
    {
      accessorKey: 'poste',
      header: 'Poste',
      accessorFn: (row) => row.postes?.titre || '-',
      cell: ({ row }) => {
        const poste = row.original.postes;
        return poste ? (
          <span className="font-medium text-primary">{poste.titre}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: 'candidat',
      header: 'Candidat',
      accessorFn: (row) => {
        const candidat = row.candidats;
        return candidat ? `${candidat.prenom} ${candidat.nom}` : '-';
      },
      cell: ({ row }) => {
        const candidat = row.original.candidats;
        return candidat ? `${candidat.prenom} ${candidat.nom}` : '-';
      },
    },
    {
      accessorKey: 'client',
      header: 'Client',
      accessorFn: (row) => row.clients?.raison_sociale || '-',
      cell: ({ row }) => row.original.clients?.raison_sociale || '-',
    },
    {
      accessorKey: 'rdv_type',
      header: 'Type RDV',
      cell: ({ row }) => {
        const type = row.original.rdv_type;
        return (
          <Badge variant={type === 'CLIENT' ? 'default' : 'secondary'}>
            {type}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'contact',
      header: 'Contact',
      accessorFn: (row) => {
        // Pour les RDV client, afficher les référents multiples
        if (row.rdv_type === 'CLIENT' && row.rdv_referents && row.rdv_referents.length > 0) {
          return row.rdv_referents
            .map(r => `${r.referents.prenom} ${r.referents.nom}`)
            .join(', ');
        }
        // Pour compatibilité avec l'ancienne structure
        if (row.rdv_type === 'CLIENT' && row.referents) {
          const ref = row.referents;
          return `${ref.prenom} ${ref.nom}`;
        }
        // Pour les RDV recruteur, on ne peut pas afficher le nom pour l'instant
        // car il faudrait faire une jointure avec profiles
        return '-';
      },
      cell: ({ row }) => {
        // Pour les RDV client, afficher les référents multiples
        if (row.original.rdv_type === 'CLIENT' && row.original.rdv_referents && row.original.rdv_referents.length > 0) {
          return (
            <div>
              <span className="text-xs text-muted-foreground">Référents:</span><br/>
              <div className="space-y-1">
                {row.original.rdv_referents.map((r, index) => (
                  <div key={index} className="text-sm">
                    {r.referents.prenom} {r.referents.nom}
                    {r.referents.fonction && ` (${r.referents.fonction})`}
                  </div>
                ))}
              </div>
            </div>
          );
        }
        // Pour compatibilité avec l'ancienne structure
        if (row.original.rdv_type === 'CLIENT' && row.original.referents) {
          const ref = row.original.referents;
          return (
            <div>
              <span className="text-xs text-muted-foreground">Référent:</span><br/>
              {ref.prenom} {ref.nom}
            </div>
          );
        }
        // Pour les RDV recruteur, afficher juste "Recruteur" car on ne peut pas accéder aux détails
        if (row.original.recruteur_id) {
          return (
            <div>
              <span className="text-xs text-muted-foreground">Recruteur</span>
            </div>
          );
        }
        return '-';
      },
    },
    {
      accessorKey: 'type_rdv',
      header: 'Modalité',
      cell: ({ row }) => {
        const typeLabels: Record<string, string> = {
          'TEAMS': 'Teams',
          'PRESENTIEL_CLIENT': 'Présentiel',
          'TELEPHONE': 'Téléphone'
        };
        return <Badge variant="outline">{typeLabels[row.original.type_rdv || ''] || row.original.type_rdv}</Badge>;
      },
    },
    {
      accessorKey: 'statut',
      header: 'Statut',
      cell: ({ row }) => {
        const statut = row.original.statut;
        const variants: Record<string, any> = {
          'ENCOURS': 'default',
          'REALISE': 'secondary',
          'TERMINE': 'outline',
          'ANNULE': 'destructive',
        };
        return <Badge variant={variants[statut] || 'outline'}>{statut}</Badge>;
      },
    },
    {
      id: 'teams',
      header: 'Teams',
      cell: ({ row }) => {
        if (row.original.type_rdv === 'TEAMS' && row.original.teams_link) {
          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(row.original.teams_link, '_blank')}
              className="gap-2"
            >
              <Video className="h-4 w-4" />
              <ExternalLink className="h-3 w-3" />
            </Button>
          );
        }
        return null;
      },
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
            title="Visualiser"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCopy(row.original)}
            title="Copier"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <EditRdvDialog rdv={row.original} onSuccess={loadData} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(row.original.id)}
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Rendez-vous</h1>
        <AddRdvDialog onSuccess={loadData} currentUserId={profile?.id} />
      </div>
      <DataTable 
        columns={columns} 
        data={rdvs} 
        searchPlaceholder="Rechercher un rendez-vous..." 
      />
      <ViewRdvDialog 
        rdv={selectedRdv} 
        open={viewDialogOpen} 
        onOpenChange={setViewDialogOpen} 
      />
    </div>
  );
}