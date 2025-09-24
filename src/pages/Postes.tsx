import { useState, useEffect } from 'react';
import { posteService, clientService } from '@/services';
import { PosteClient, Client } from '@/types/models';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Calendar, Building2, FileText, Eye, Copy, History } from 'lucide-react';
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
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function Postes() {
  const [postes, setPostes] = useState<PosteClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
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
    detail: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [postesData, clientsData] = await Promise.all([
      posteService.getAll(),
      clientService.getAll(),
    ]);
    setPostes(postesData);
    setClients(clientsData);
  };

  const handleOpenForm = (poste?: PosteClient) => {
    if (poste) {
      setSelectedPoste(poste);
      setFormData({
        clientId: poste.clientId,
        nomPoste: poste.nomPoste,
        dateEcheance: poste.dateEcheance ? format(new Date(poste.dateEcheance), 'yyyy-MM-dd') : '',
        statut: poste.statut,
        detail: poste.detail,
      });
    } else {
      setSelectedPoste(null);
      setFormData({
        clientId: '',
        nomPoste: '',
        dateEcheance: '',
        statut: 'ENCOURS',
        detail: '',
      });
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const data = {
        ...formData,
        dateCreation: selectedPoste?.dateCreation || new Date(),
        dateEcheance: formData.dateEcheance ? new Date(formData.dateEcheance) : undefined,
      };

      if (selectedPoste) {
        await posteService.update(selectedPoste.id, data);
        toast.success('Poste modifié avec succès');
      } else {
        await posteService.create(data);
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {postes.map((poste) => {
          const client = getClient(poste.clientId);
          return (
            <Card key={poste.id} className="hover:shadow-lg transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{poste.nomPoste}</CardTitle>
                  {getStatusBadge(poste.statut)}
                </div>
                {client && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                    <Building2 className="h-4 w-4" />
                    <span>{client.raisonSociale}</span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Créé le {format(new Date(poste.dateCreation), 'dd/MM/yyyy')}</span>
                  </div>
                  {poste.dateEcheance && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-warning" />
                      <span>Échéance: {format(new Date(poste.dateEcheance), 'dd/MM/yyyy')}</span>
                    </div>
                  )}
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {poste.detail.replace(/[*_]/g, '')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleView(poste)}
                    title="Visualiser"
                  >
                    <Eye className="mr-2 h-3 w-3" />
                    Voir
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(poste)}
                    title="Copier"
                  >
                    <Copy className="mr-2 h-3 w-3" />
                    Copier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenForm(poste)}
                    title="Modifier"
                  >
                    <Edit className="mr-2 h-3 w-3" />
                    Modifier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(poste.id)}
                    title="Supprimer"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
    </div>
  );
}