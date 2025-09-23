import { useState, useEffect } from 'react';
import { rdvService, candidatService, clientService } from '@/services';
import { Rdv, Candidat, Client } from '@/types/models';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2 } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import TeamsIntegration from '@/components/TeamsIntegration';
import AddRdvDialog from '@/components/AddRdvDialog';

export default function RendezVous() {
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [rdvData, candidatData, clientData] = await Promise.all([
      rdvService.getAll(),
      candidatService.getAll(),
      clientService.getAll()
    ]);
    setRdvs(rdvData);
    setCandidats(candidatData);
    setClients(clientData);
  };

  const getCandidat = (id: string) => candidats.find(c => c.id === id);
  const getClient = (id: string) => clients.find(c => c.id === id);

  const columns: ColumnDef<Rdv>[] = [
    {
      accessorKey: 'date',
      header: 'Date',
      cell: ({ row }) => format(new Date(row.original.date), 'dd/MM/yyyy HH:mm', { locale: fr }),
    },
    {
      id: 'candidat',
      header: 'Candidat',
      cell: ({ row }) => {
        const candidat = getCandidat(row.original.candidatId);
        return candidat ? `${candidat.prenom} ${candidat.nom}` : '-';
      },
    },
    {
      id: 'client',
      header: 'Client',
      cell: ({ row }) => {
        const client = getClient(row.original.clientId);
        return client ? client.raisonSociale : '-';
      },
    },
    {
      accessorKey: 'typeRdv',
      header: 'Type',
      cell: ({ row }) => <Badge variant="outline">{row.original.typeRdv}</Badge>,
    },
    {
      accessorKey: 'statut',
      header: 'Statut',
      cell: ({ row }) => {
        const statut = row.original.statut;
        const colors = {
          'ENCOURS': 'bg-blue-100 text-blue-800',
          'REALISE': 'bg-green-100 text-green-800',
          'TERMINE': 'bg-gray-100 text-gray-800',
          'ANNULE': 'bg-red-100 text-red-800',
        };
        return <Badge className={colors[statut] || ''}>{statut}</Badge>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.typeRdv === 'TEAMS' && (
            <TeamsIntegration rdv={row.original} />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              // TODO: Implémenter l'édition
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              // TODO: Implémenter la suppression
            }}
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
        <AddRdvDialog 
          candidats={candidats} 
          clients={clients} 
          onSuccess={loadData}
        />
      </div>
      <DataTable columns={columns} data={rdvs} searchPlaceholder="Rechercher un rendez-vous..." />
    </div>
  );
}