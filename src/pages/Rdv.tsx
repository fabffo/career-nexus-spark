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
          clients(raison_sociale),
          postes(titre),
          profiles:recruteur_id(nom, prenom),
          referents:referent_id(nom, prenom)
        `)
        .select(`
          *,
          candidats(nom, prenom, email),
          clients(raison_sociale),
          profiles:recruteur_id(nom, prenom),
          referents:referent_id(nom, prenom)
        `)
        .order('date', { ascending: false });

      if (error) throw error;
      setRdvs(data || []);
    } catch (error: any) {
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
      const newRdv = {
        date: rdv.date,
        type_rdv: rdv.type_rdv,
        rdv_type: rdv.rdv_type,
        statut: 'ENCOURS' as const,
        lieu: rdv.lieu,
        notes: rdv.notes,
        candidat_id: rdv.candidat_id,
        client_id: rdv.client_id,
        recruteur_id: rdv.recruteur_id,
        referent_id: rdv.referent_id,
      };

      const { error } = await supabase
        .from('rdvs')
        .insert(newRdv);

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
        if (row.rdv_type === 'CLIENT' && row.referents) {
          const ref = row.referents;
          return `${ref.prenom} ${ref.nom}`;
        }
        if (row.profiles) {
          const rec = row.profiles;
          return `${rec.prenom} ${rec.nom}`;
        }
        return '-';
      },
      cell: ({ row }) => {
        if (row.original.rdv_type === 'CLIENT' && row.original.referents) {
          const ref = row.original.referents;
          return (
            <div>
              <span className="text-xs text-muted-foreground">Référent:</span><br/>
              {ref.prenom} {ref.nom}
            </div>
          );
        }
        if (row.original.profiles) {
          const rec = row.original.profiles;
          return (
            <div>
              <span className="text-xs text-muted-foreground">Recruteur:</span><br/>
              {rec.prenom} {rec.nom}
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