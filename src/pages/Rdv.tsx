import { useState, useEffect } from 'react';
import { rdvService } from '@/services';
import { Rdv } from '@/types/models';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function RendezVous() {
  const [rdvs, setRdvs] = useState<Rdv[]>([]);

  useEffect(() => {
    loadRdvs();
  }, []);

  const loadRdvs = async () => {
    const data = await rdvService.getAll();
    setRdvs(data);
  };

  const columns: ColumnDef<Rdv>[] = [
    {
      accessorKey: 'date',
      header: 'Date',
      cell: ({ row }) => format(new Date(row.original.date), 'dd/MM/yyyy HH:mm', { locale: fr }),
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
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Rendez-vous</h1>
        <Button className="bg-gradient-to-r from-primary to-primary-hover">
          <Plus className="mr-2 h-4 w-4" />
          Nouveau RDV
        </Button>
      </div>
      <DataTable columns={columns} data={rdvs} searchPlaceholder="Rechercher un rendez-vous..." />
    </div>
  );
}