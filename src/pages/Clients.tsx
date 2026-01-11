import { useState, useEffect } from 'react';
import { clientService } from '@/services';
import { Client } from '@/types/models';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Globe, Mail, Phone, Building, Eye, Copy, Users } from 'lucide-react';
import { ViewClientDialog } from '@/components/ViewClientDialog';
import { ReferentsDialog } from '@/components/ReferentsDialog';
import { RapprochementSearchSection } from '@/components/RapprochementSearchSection';
import { MatchingHistorySection } from '@/components/MatchingHistorySection';
import { ColumnDef } from '@tanstack/react-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [referentsDialogOpen, setReferentsDialogOpen] = useState(false);
  const [referentsClient, setReferentsClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    raisonSociale: '',
    secteurActivite: '',
    adresse_ligne1: '',
    code_postal: '',
    ville: '',
    pays: 'France',
    telephone: '',
    email: '',
    siteWeb: '',
    delaiPaiementJours: 30,
    mots_cles_rapprochement: '',
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    const data = await clientService.getAll();
    setClients(data);
  };

  const handleOpenForm = (client?: Client) => {
    if (client) {
      setSelectedClient(client);
      const defaultKeywords = client.raisonSociale;
      setFormData({
        raisonSociale: client.raisonSociale,
        secteurActivite: client.secteurActivite,
        adresse_ligne1: client.adresse_ligne1 || '',
        code_postal: client.code_postal || '',
        ville: client.ville,
        pays: client.pays,
        telephone: client.telephone,
        email: client.email,
        siteWeb: client.siteWeb || '',
        delaiPaiementJours: (client as any).delai_paiement_jours || 30,
        mots_cles_rapprochement: (client as any).mots_cles_rapprochement || defaultKeywords,
      });
    } else {
      setSelectedClient(null);
      setFormData({
        raisonSociale: '',
        secteurActivite: '',
        adresse_ligne1: '',
        code_postal: '',
        ville: '',
        pays: 'France',
        telephone: '',
        email: '',
        siteWeb: '',
        delaiPaiementJours: 30,
        mots_cles_rapprochement: '',
      });
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (selectedClient) {
        await clientService.update(selectedClient.id, formData);
        toast.success('Client modifié avec succès');
      } else {
        await clientService.create(formData);
        toast.success('Client créé avec succès');
      }
      setIsFormOpen(false);
      loadClients();
    } catch (error) {
      toast.error('Une erreur est survenue');
    }
  };

  const handleDelete = async () => {
    if (selectedClient) {
      try {
        await clientService.delete(selectedClient.id);
        toast.success('Client supprimé avec succès');
        setIsDeleteOpen(false);
        loadClients();
      } catch (error) {
        toast.error('Une erreur est survenue');
      }
    }
  };

  const handleCopy = async (client: Client) => {
    try {
      const newClient = {
        raisonSociale: client.raisonSociale + ' (Copie)',
        secteurActivite: client.secteurActivite,
        adresse_ligne1: client.adresse_ligne1 || '',
        code_postal: client.code_postal || '',
        ville: client.ville,
        pays: client.pays,
        telephone: client.telephone,
        email: client.email,
        siteWeb: client.siteWeb || '',
        delai_paiement_jours: (client as any).delai_paiement_jours || 30,
      };
      await clientService.create(newClient);
      toast.success('Client dupliqué avec succès');
      loadClients();
    } catch (error) {
      toast.error('Une erreur est survenue');
    }
  };

  const handleView = (client: Client) => {
    setSelectedClient(client);
    setViewDialogOpen(true);
  };

  const handleViewReferents = (client: Client) => {
    setReferentsClient(client);
    setReferentsDialogOpen(true);
  };

  const columns: ColumnDef<Client>[] = [
    {
      accessorKey: 'raisonSociale',
      header: 'Raison Sociale',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 text-primary" />
          <span className="font-medium">{row.original.raisonSociale}</span>
        </div>
      ),
    },
    {
      accessorKey: 'secteurActivite',
      header: 'Secteur d\'activité',
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">{row.original.secteurActivite}</div>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{row.original.email}</span>
        </div>
      ),
    },
    {
      accessorKey: 'telephone',
      header: 'Téléphone',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{row.original.telephone}</span>
        </div>
      ),
    },
    {
      accessorKey: 'siteWeb',
      header: 'Site Web',
      cell: ({ row }) => row.original.siteWeb && (
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <a 
            href={row.original.siteWeb} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Visiter
          </a>
        </div>
      ),
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
            onClick={() => handleViewReferents(row.original)}
            title="Gérer les référents"
          >
            <Users className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCopy(row.original)}
            title="Copier"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleOpenForm(row.original)}
            title="Modifier"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedClient(row.original);
              setIsDeleteOpen(true);
            }}
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-2">
            Gérez votre portefeuille clients
          </p>
        </div>
        <Button onClick={() => handleOpenForm()} className="bg-gradient-to-r from-primary to-primary-hover">
          <Plus className="mr-2 h-4 w-4" />
          Nouveau client
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={clients}
        searchPlaceholder="Rechercher un client..."
      />

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedClient ? 'Modifier le client' : 'Nouveau client'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="raisonSociale">Raison Sociale</Label>
              <Input
                id="raisonSociale"
                value={formData.raisonSociale}
                onChange={(e) => setFormData({ ...formData, raisonSociale: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="secteurActivite">Secteur d'activité</Label>
              <Input
                id="secteurActivite"
                value={formData.secteurActivite}
                onChange={(e) => setFormData({ ...formData, secteurActivite: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="adresse_ligne1">Adresse</Label>
              <Input
                id="adresse_ligne1"
                value={formData.adresse_ligne1}
                onChange={(e) => setFormData({ ...formData, adresse_ligne1: e.target.value })}
                placeholder="Numéro et rue"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="code_postal">Code postal</Label>
                <Input
                  id="code_postal"
                  value={formData.code_postal}
                  onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
                  placeholder="75001"
                />
              </div>
              <div>
                <Label htmlFor="ville">Ville</Label>
                <Input
                  id="ville"
                  value={formData.ville}
                  onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                  placeholder="Paris"
                  required
                />
              </div>
              <div>
                <Label htmlFor="pays">Pays</Label>
                <Input
                  id="pays"
                  value={formData.pays}
                  onChange={(e) => setFormData({ ...formData, pays: e.target.value })}
                  placeholder="France"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="telephone">Téléphone</Label>
                <Input
                  id="telephone"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="siteWeb">Site Web</Label>
              <Input
                id="siteWeb"
                type="url"
                value={formData.siteWeb}
                onChange={(e) => setFormData({ ...formData, siteWeb: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label htmlFor="delaiPaiementJours">Délai de paiement (jours)</Label>
              <Input
                id="delaiPaiementJours"
                type="number"
                min="0"
                value={formData.delaiPaiementJours}
                onChange={(e) => setFormData({ ...formData, delaiPaiementJours: parseInt(e.target.value) || 0 })}
                placeholder="30"
              />
            </div>
            <div>
              <Label htmlFor="mots_cles_rapprochement">Mots-clés de rapprochement bancaire</Label>
              <Input
                id="mots_cles_rapprochement"
                value={formData.mots_cles_rapprochement}
                onChange={(e) => setFormData({ ...formData, mots_cles_rapprochement: e.target.value })}
                placeholder="Ex: ORANGE ABONNEMENT ou ORANGE, SFR"
              />
              <p className="text-xs text-muted-foreground mt-1">
                <strong>Syntaxe :</strong> Espace = ET (tous les mots), Virgule = OU (l'un ou l'autre)
              </p>
            </div>

            {/* Rapprochement sections - only shown when editing */}
            {selectedClient && (
              <>
                <RapprochementSearchSection 
                  entityType="client"
                  entityId={selectedClient.id}
                  entityName={selectedClient.raisonSociale}
                  savedKeywords={formData.mots_cles_rapprochement}
                />
                <MatchingHistorySection 
                  entityType="client"
                  entityId={selectedClient.id}
                  entityName={selectedClient.raisonSociale}
                />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit}>
              {selectedClient ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le client sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Dialog */}
      <ViewClientDialog 
        client={selectedClient} 
        open={viewDialogOpen} 
        onOpenChange={setViewDialogOpen} 
      />

      {/* Referents Dialog */}
      {referentsClient && (
        <ReferentsDialog
          clientId={referentsClient.id}
          clientName={referentsClient.raisonSociale}
          open={referentsDialogOpen}
          onOpenChange={setReferentsDialogOpen}
        />
      )}
    </div>
  );
}