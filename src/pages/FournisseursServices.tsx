import { useState, useEffect } from 'react';
import { fournisseurServicesService } from '@/services/contratService';
import { FournisseurServices } from '@/types/contrat';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Globe, Mail, Phone, Building, Eye, Copy } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { RapprochementSearchSection } from '@/components/RapprochementSearchSection';
import { MatchingHistorySection } from '@/components/MatchingHistorySection';
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
import { ViewFournisseurServicesDialog } from '@/components/ViewFournisseurServicesDialog';

export default function FournisseursServices() {
  const [fournisseurs, setFournisseurs] = useState<FournisseurServices[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedFournisseur, setSelectedFournisseur] = useState<FournisseurServices | null>(null);
  const [formData, setFormData] = useState({
    raison_sociale: '',
    secteur_activite: '',
    adresse: '',
    telephone: '',
    email: '',
    site_web: '',
    mots_cles_rapprochement: '',
    delai_paiement_jours: 30,
    ecart_paiement_jours: 5,
  });

  useEffect(() => {
    loadFournisseurs();
  }, []);

  const loadFournisseurs = async () => {
    const data = await fournisseurServicesService.getAll();
    setFournisseurs(data);
  };

  const handleOpenForm = (fournisseur?: FournisseurServices) => {
    if (fournisseur) {
      setSelectedFournisseur(fournisseur);
      const defaultKeywords = fournisseur.raison_sociale;
      setFormData({
        raison_sociale: fournisseur.raison_sociale,
        secteur_activite: fournisseur.secteur_activite || '',
        adresse: fournisseur.adresse || '',
        telephone: fournisseur.telephone || '',
        email: fournisseur.email || '',
        site_web: fournisseur.site_web || '',
        mots_cles_rapprochement: fournisseur.mots_cles_rapprochement || defaultKeywords,
        delai_paiement_jours: (fournisseur as any).delai_paiement_jours ?? 30,
        ecart_paiement_jours: (fournisseur as any).ecart_paiement_jours ?? 5,
      });
    } else {
      setSelectedFournisseur(null);
      setFormData({
        raison_sociale: '',
        secteur_activite: '',
        adresse: '',
        telephone: '',
        email: '',
        site_web: '',
        mots_cles_rapprochement: '',
        delai_paiement_jours: 30,
        ecart_paiement_jours: 5,
      });
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (selectedFournisseur) {
        await fournisseurServicesService.update(selectedFournisseur.id, formData);
        toast.success('Fournisseur de services modifié avec succès');
      } else {
        await fournisseurServicesService.create(formData);
        toast.success('Fournisseur de services créé avec succès');
      }
      setIsFormOpen(false);
      loadFournisseurs();
    } catch (error) {
      toast.error('Une erreur est survenue');
    }
  };

  const handleDelete = async () => {
    if (selectedFournisseur) {
      try {
        await fournisseurServicesService.delete(selectedFournisseur.id);
        toast.success('Fournisseur de services supprimé avec succès');
        setIsDeleteOpen(false);
        loadFournisseurs();
      } catch (error: any) {
        console.error('Erreur suppression fournisseur:', error);
        if (error?.message?.includes('violates foreign key constraint') || 
            error?.code === '23503') {
          toast.error('Impossible de supprimer ce fournisseur : il est lié à des contrats, prestataires ou factures. Supprimez d\'abord ces éléments liés.');
        } else {
          toast.error('Une erreur est survenue lors de la suppression');
        }
      }
    }
  };

  const handleCopy = async (fournisseur: FournisseurServices) => {
    try {
      const newFournisseur = {
        raison_sociale: fournisseur.raison_sociale + ' (Copie)',
        secteur_activite: fournisseur.secteur_activite,
        adresse: fournisseur.adresse,
        telephone: fournisseur.telephone,
        email: fournisseur.email,
        site_web: fournisseur.site_web,
      };
      await fournisseurServicesService.create(newFournisseur);
      toast.success('Fournisseur de services dupliqué avec succès');
      loadFournisseurs();
    } catch (error) {
      toast.error('Une erreur est survenue');
    }
  };

  const columns: ColumnDef<FournisseurServices>[] = [
    {
      accessorKey: 'raison_sociale',
      header: 'Raison Sociale',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 text-primary" />
          <span className="font-medium">{row.original.raison_sociale}</span>
        </div>
      ),
    },
    {
      accessorKey: 'secteur_activite',
      header: 'Secteur d\'activité',
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">{row.original.secteur_activite}</div>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => row.original.email && (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{row.original.email}</span>
        </div>
      ),
    },
    {
      accessorKey: 'telephone',
      header: 'Téléphone',
      cell: ({ row }) => row.original.telephone && (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{row.original.telephone}</span>
        </div>
      ),
    },
    {
      accessorKey: 'site_web',
      header: 'Site Web',
      cell: ({ row }) => row.original.site_web && (
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <a 
            href={row.original.site_web} 
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
            onClick={() => {
              setSelectedFournisseur(row.original);
              setIsViewOpen(true);
            }}
            title="Voir"
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
              setSelectedFournisseur(row.original);
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
          <h1 className="text-3xl font-bold tracking-tight">Fournisseurs de Services</h1>
          <p className="text-muted-foreground mt-2">
            Gérez vos fournisseurs de services
          </p>
        </div>
        <Button onClick={() => handleOpenForm()} className="bg-gradient-to-r from-primary to-primary-hover">
          <Plus className="mr-2 h-4 w-4" />
          Nouveau fournisseur
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={fournisseurs}
        searchPlaceholder="Rechercher un fournisseur..."
      />

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedFournisseur ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="raison_sociale">Raison Sociale</Label>
              <Input
                id="raison_sociale"
                value={formData.raison_sociale}
                onChange={(e) => setFormData({ ...formData, raison_sociale: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="secteur_activite">Secteur d'activité</Label>
              <Input
                id="secteur_activite"
                value={formData.secteur_activite}
                onChange={(e) => setFormData({ ...formData, secteur_activite: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="adresse">Adresse</Label>
              <Input
                id="adresse"
                value={formData.adresse}
                onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
              />
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
              <Label htmlFor="site_web">Site Web</Label>
              <Input
                id="site_web"
                type="url"
                value={formData.site_web}
                onChange={(e) => setFormData({ ...formData, site_web: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="delai_paiement_jours">Délai de paiement (jours)</Label>
                <Input
                  id="delai_paiement_jours"
                  type="number"
                  min="0"
                  value={formData.delai_paiement_jours}
                  onChange={(e) => setFormData({ ...formData, delai_paiement_jours: parseInt(e.target.value) || 0 })}
                  placeholder="30"
                />
              </div>
              <div>
                <Label htmlFor="ecart_paiement_jours">Écart toléré (± jours)</Label>
                <Input
                  id="ecart_paiement_jours"
                  type="number"
                  min="0"
                  value={formData.ecart_paiement_jours}
                  onChange={(e) => setFormData({ ...formData, ecart_paiement_jours: parseInt(e.target.value) || 0 })}
                  placeholder="5"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="mots_cles_rapprochement">Mots-clés de rapprochement bancaire</Label>
              <Input
                id="mots_cles_rapprochement"
                value={formData.mots_cles_rapprochement}
                onChange={(e) => setFormData({ ...formData, mots_cles_rapprochement: e.target.value })}
                placeholder="Ex: FOURNISSEUR ABC ou ABC, XYZ"
              />
              <p className="text-xs text-muted-foreground mt-1">
                <strong>Syntaxe :</strong> Espace = ET (tous les mots), Virgule = OU (l'un ou l'autre)
              </p>
            </div>

            {/* Rapprochement sections - only shown when editing */}
            {selectedFournisseur && (
              <>
                <RapprochementSearchSection 
                  entityType="fournisseur_services"
                  entityId={selectedFournisseur.id}
                  entityName={selectedFournisseur.raison_sociale}
                  savedKeywords={formData.mots_cles_rapprochement}
                />
                <MatchingHistorySection 
                  entityType="fournisseur_services"
                  entityId={selectedFournisseur.id}
                  entityName={selectedFournisseur.raison_sociale}
                />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit}>
              {selectedFournisseur ? 'Modifier' : 'Créer'}
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
              Cette action est irréversible. Le fournisseur sera définitivement supprimé.
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
      <ViewFournisseurServicesDialog
        fournisseur={selectedFournisseur}
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
      />
    </div>
  );
}