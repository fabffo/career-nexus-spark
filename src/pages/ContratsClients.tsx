import { useState, useEffect } from 'react';
import { Contrat } from '@/types/contrat';
import { contratService } from '@/services/contratService';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ContratsClients() {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadContrats();
  }, []);

  const loadContrats = async () => {
    try {
      setLoading(true);
      const data = await contratService.getAll();
      // Filtrer uniquement les contrats clients
      const contratsClients = data.filter(c => c.type === 'CLIENT');
      setContrats(contratsClients);
    } catch (error: any) {
      console.error('Error loading contrats:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les contrats clients",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatutBadgeVariant = (statut: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'BROUILLON': 'outline',
      'ACTIF': 'default',
      'TERMINE': 'secondary',
      'ANNULE': 'destructive',
      'ARCHIVE': 'outline'
    };
    return variants[statut] || 'outline';
  };

  const columns: ColumnDef<Contrat>[] = [
    {
      accessorKey: 'numero_contrat',
      header: 'N° Contrat',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.numero_contrat}</div>
      )
    },
    {
      accessorKey: 'client',
      header: 'Client',
      cell: ({ row }) => (
        <div>{row.original.client?.raison_sociale || '-'}</div>
      )
    },
    {
      accessorKey: 'date_debut',
      header: 'Date début',
      cell: ({ row }) => format(new Date(row.original.date_debut), 'dd/MM/yyyy', { locale: fr })
    },
    {
      accessorKey: 'date_fin',
      header: 'Date fin',
      cell: ({ row }) => row.original.date_fin 
        ? format(new Date(row.original.date_fin), 'dd/MM/yyyy', { locale: fr })
        : '-'
    },
    {
      accessorKey: 'montant',
      header: 'Montant',
      cell: ({ row }) => row.original.montant 
        ? `${row.original.montant.toFixed(2)} €`
        : '-'
    },
    {
      accessorKey: 'statut',
      header: 'Statut',
      cell: ({ row }) => (
        <Badge variant={getStatutBadgeVariant(row.original.statut)}>
          {row.original.statut}
        </Badge>
      )
    },
    {
      accessorKey: 'version',
      header: 'Version',
      cell: ({ row }) => <Badge variant="outline">{row.original.version}</Badge>
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Contrats Clients</h1>
          <p className="text-muted-foreground">Gérez vos contrats avec les clients</p>
        </div>
        <Button onClick={() => window.location.href = '/contrats'}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau contrat
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={contrats}
        searchPlaceholder="Rechercher un contrat client..."
      />
    </div>
  );
}
