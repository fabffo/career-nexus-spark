import { useState, useEffect } from 'react';
import { posteService, clientService, candidatService } from '@/services';
import { PosteClient, Client, Candidat } from '@/types/models';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Calendar, Building2, Eye, Copy, History, MoreHorizontal } from 'lucide-react';
import { ViewPosteDialog } from '@/components/ViewPosteDialog';
import { PosteHistoryDialog } from '@/components/PosteHistoryDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import '@/styles/table-responsive.css';

export default function Postes() {
  const [postes, setPostes] = useState<PosteClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPoste, setSelectedPoste] = useState<PosteClient | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyPosteId, setHistoryPosteId] = useState<string>('');
  const [formData, setFormData] = useState({
    clientId: '',
    nomPoste: '',
    dateEcheance: '',
    statut: 'ENCOURS' as PosteClient['statut'],
    typePrestation: 'RECRUTEMENT' as PosteClient['typePrestation'],
    detail: '',
    pourvuPar: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [postesData, clientsData, candidatsData] = await Promise.all([
      posteService.getAll(),
      clientService.getAll(),
      candidatService.getAll(),
    ]);
    setPostes(postesData);
    setClients(clientsData);
    setCandidats(candidatsData);
  };

  const handleOpenForm = (poste?: PosteClient) => {
    if (poste) {
      setSelectedPoste(poste);
      setFormData({
        clientId: poste.clientId,
        nomPoste: poste.nomPoste,
        dateEcheance: poste.dateEcheance ? format(new Date(poste.dateEcheance), 'yyyy-MM-dd') : '',
        statut: poste.statut,
        typePrestation: poste.typePrestation || 'RECRUTEMENT',
        detail: poste.detail,
        pourvuPar: (poste as any).pourvuPar || '',
      });
    } else {
      setSelectedPoste(null);
      setFormData({
        clientId: '',
        nomPoste: '',
        dateEcheance: '',
        statut: 'ENCOURS',
        typePrestation: 'RECRUTEMENT',
        detail: '',
        pourvuPar: '',
      });
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    try {
      // Validate that pourvuPar is filled when status is REALISE
      if (formData.statut === 'REALISE' && !formData.pourvuPar) {
        toast.error('Le champ "Pourvu par" est obligatoire quand le statut est "Réalisé"');
        return;
      }

      const data = {
        ...formData,
        dateCreation: selectedPoste?.dateCreation || new Date(),
        dateEcheance: formData.dateEcheance ? new Date(formData.dateEcheance) : undefined,
      };

      if (selectedPoste) {
        await posteService.update(selectedPoste.id, data);
        toast.success('Poste modifié avec succès');
      } else {
        await posteService.create({
          ...data,
          typePrestation: formData.typePrestation || 'RECRUTEMENT'
        });
        toast.success('Poste créé avec succès');
      }
      setIsFormOpen(false);
      loadData();
    } catch (error) {
      toast.error('Une erreur est survenue');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await posteService.delete(id);
      toast.success('Poste supprimé avec succès');
      loadData();
    } catch (error) {
      toast.error('Une erreur est survenue');
    }
  };

  const handleCopy = async (poste: PosteClient) => {
    try {
      const client = getClient(poste.clientId);
      const newPoste = {
        clientId: poste.clientId,
        nomPoste: poste.nomPoste + ' (Copie)',
        dateCreation: new Date(),
        dateEcheance: poste.dateEcheance,
        statut: 'ENCOURS' as PosteClient['statut'],
        typePrestation: poste.typePrestation || 'RECRUTEMENT',
        detail: poste.detail,
      };
      await posteService.create(newPoste);
      toast.success('Poste dupliqué avec succès');
      loadData();
    } catch (error) {
      toast.error('Une erreur est survenue');
    }
  };

  const handleView = (poste: PosteClient) => {
    setSelectedPoste(poste);
    setViewDialogOpen(true);
  };

  const getStatusBadge = (statut: PosteClient['statut']) => {
    const variants = {
      'ENCOURS': 'bg-blue-100 text-blue-800 border-blue-200',
      'REALISE': 'bg-green-100 text-green-800 border-green-200',
      'ANNULE': 'bg-red-100 text-red-800 border-red-200',
    };

    return (
      <Badge className={cn('font-medium border', variants[statut])}>
        {statut}
      </Badge>
    );
  };

  const getClient = (clientId: string) => {
    return clients.find(c => c.id === clientId);
  };

  const columns: ColumnDef<PosteClient>[] = [
    {
      accessorKey: 'nomPoste',
      header: 'Nom du poste',
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue('nomPoste')}</div>
      ),
    },
    {
      accessorKey: 'clientId',
      header: 'Client',
      cell: ({ row }) => {
        const client = getClient(row.getValue('clientId'));
        return (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>{client?.raisonSociale || '-'}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'typePrestation',
      header: 'Type',
      cell: ({ row }) => {
        const type = row.getValue('typePrestation') as PosteClient['typePrestation'];
        return (
          <Badge variant="outline">
            {type === 'RECRUTEMENT' ? 'Recrutement' : 'Formation'}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'statut',
      header: 'Statut',
      cell: ({ row }) => getStatusBadge(row.getValue('statut')),
    },
    {
      accessorKey: 'dateCreation',
      header: 'Date création',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{format(new Date(row.getValue('dateCreation')), 'dd/MM/yyyy')}</span>
        </div>
      ),
    },
    {
      accessorKey: 'dateEcheance',
      header: 'Échéance',
      cell: ({ row }) => {
        const date = row.getValue('dateEcheance');
        if (!date) return '-';
        return (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-warning" />
            <span>{format(new Date(date as string), 'dd/MM/yyyy')}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'detail',
      header: 'Détails',
      cell: ({ row }) => {
        const detail = row.getValue('detail') as string;
        return (
          <div className="max-w-[300px]">
            <p className="text-sm text-muted-foreground truncate">
              {detail.replace(/[*_]/g, '')}
            </p>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const poste = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleView(poste)}>
                <Eye className="mr-2 h-4 w-4" />
                Voir les détails
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenForm(poste)}>
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCopy(poste)}>
                <Copy className="mr-2 h-4 w-4" />
                Dupliquer
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setHistoryPosteId(poste.id);
                  setHistoryDialogOpen(true);
                }}
              >
                <History className="mr-2 h-4 w-4" />
                Historique
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDelete(poste.id)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Postes</h1>
          <p className="text-muted-foreground mt-2">
            Gérez les postes ouverts et leur suivi
          </p>
        </div>
        <Button onClick={() => handleOpenForm()} className="bg-gradient-to-r from-primary to-primary-hover">
          <Plus className="mr-2 h-4 w-4" />
          Nouveau poste
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={postes}
        searchPlaceholder="Rechercher un poste..."
      />

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {selectedPoste ? 'Modifier le poste' : 'Nouveau poste'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="clientId">Client</Label>
              <Select
                value={formData.clientId}
                onValueChange={(value) => setFormData({ ...formData, clientId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.raisonSociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="nomPoste">Nom du poste</Label>
              <Input
                id="nomPoste"
                value={formData.nomPoste}
                onChange={(e) => setFormData({ ...formData, nomPoste: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dateEcheance">Date d'échéance</Label>
                <Input
                  id="dateEcheance"
                  type="date"
                  value={formData.dateEcheance}
                  onChange={(e) => setFormData({ ...formData, dateEcheance: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="statut">Statut</Label>
                <Select
                  value={formData.statut}
                  onValueChange={(value) => setFormData({ ...formData, statut: value as PosteClient['statut'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENCOURS">En cours</SelectItem>
                    <SelectItem value="REALISE">Réalisé</SelectItem>
                    <SelectItem value="ANNULE">Annulé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="typePrestation">Type de prestation</Label>
              <Select
                value={formData.typePrestation}
                onValueChange={(value) => setFormData({ ...formData, typePrestation: value as PosteClient['typePrestation'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECRUTEMENT">Recrutement</SelectItem>
                  <SelectItem value="FORMATION">Formation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pourvuPar">
                Pourvu par {formData.statut === 'REALISE' && <span className="text-destructive">*</span>}
              </Label>
              <Select
                value={formData.pourvuPar}
                onValueChange={(value) => setFormData({ ...formData, pourvuPar: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un candidat ou candidat externe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Candidat externe">Candidat externe</SelectItem>
                  {candidats.map((candidat) => (
                    <SelectItem key={candidat.id} value={`${candidat.nom} ${candidat.prenom}`}>
                      {candidat.nom} {candidat.prenom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.statut === 'REALISE' && !formData.pourvuPar && (
                <p className="text-sm text-destructive mt-1">
                  Ce champ est obligatoire quand le statut est "Réalisé"
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="detail">Détails du poste</Label>
              <Textarea
                id="detail"
                value={formData.detail}
                onChange={(e) => setFormData({ ...formData, detail: e.target.value })}
                rows={6}
                placeholder="Description détaillée du poste..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit}>
              {selectedPoste ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <ViewPosteDialog 
        poste={selectedPoste} 
        client={selectedPoste ? getClient(selectedPoste.clientId) : undefined}
        open={viewDialogOpen} 
        onOpenChange={setViewDialogOpen} 
      />

      {/* History Dialog */}
      <PosteHistoryDialog
        isOpen={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        posteId={historyPosteId}
      />
    </div>
  );
}