import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Eye, Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/ui/data-table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ViewBanqueDialog from '@/components/ViewBanqueDialog';
import { RapprochementSearchSection } from '@/components/RapprochementSearchSection';
import { MatchingHistorySection } from '@/components/MatchingHistorySection';

interface Banque {
  id: string;
  raison_sociale: string;
  secteur_activite: string | null;
  adresse: string | null;
  email: string | null;
  telephone: string | null;
  site_web: string | null;
  mots_cles_rapprochement: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const emptyFormData = {
  raison_sociale: '',
  secteur_activite: 'Banque',
  adresse: '',
  email: '',
  telephone: '',
  site_web: '',
  mots_cles_rapprochement: '',
};

export default function Banques() {
  const [banques, setBanques] = useState<Banque[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedBanque, setSelectedBanque] = useState<Banque | null>(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadBanques();
  }, []);

  const loadBanques = async () => {
    try {
      const { data, error } = await supabase
        .from('banques')
        .select('*')
        .order('raison_sociale');

      if (error) throw error;
      setBanques(data || []);
    } catch (error) {
      console.error('Error loading banques:', error);
      toast.error('Erreur lors du chargement des banques');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenForm = (banque?: Banque) => {
    if (banque) {
      const defaultKeywords = banque.raison_sociale;
      setFormData({
        raison_sociale: banque.raison_sociale,
        secteur_activite: banque.secteur_activite || 'Banque',
        adresse: banque.adresse || '',
        email: banque.email || '',
        telephone: banque.telephone || '',
        site_web: banque.site_web || '',
        mots_cles_rapprochement: banque.mots_cles_rapprochement || defaultKeywords,
      });
      setSelectedBanque(banque);
      setIsEditing(true);
    } else {
      setFormData(emptyFormData);
      setSelectedBanque(null);
      setIsEditing(false);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && selectedBanque) {
        const { error } = await supabase
          .from('banques')
          .update(formData)
          .eq('id', selectedBanque.id);

        if (error) throw error;
        toast.success('Banque mise à jour avec succès');
      } else {
        const { error } = await supabase
          .from('banques')
          .insert([formData]);

        if (error) throw error;
        toast.success('Banque créée avec succès');
      }
      setIsDialogOpen(false);
      loadBanques();
    } catch (error) {
      console.error('Error saving banque:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async () => {
    if (!selectedBanque) return;
    try {
      const { error } = await supabase
        .from('banques')
        .delete()
        .eq('id', selectedBanque.id);

      if (error) throw error;
      toast.success('Banque supprimée avec succès');
      setIsDeleteDialogOpen(false);
      loadBanques();
    } catch (error) {
      console.error('Error deleting banque:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleCopy = async (banque: Banque) => {
    try {
      const { id, created_at, updated_at, ...banqueData } = banque;
      const { error } = await supabase
        .from('banques')
        .insert([{ ...banqueData, raison_sociale: `${banque.raison_sociale} (copie)` }]);

      if (error) throw error;
      toast.success('Banque dupliquée avec succès');
      loadBanques();
    } catch (error) {
      console.error('Error copying banque:', error);
      toast.error('Erreur lors de la duplication');
    }
  };

  const columns = [
    {
      accessorKey: 'raison_sociale',
      header: 'Raison Sociale',
    },
    {
      accessorKey: 'secteur_activite',
      header: 'Secteur d\'activité',
    },
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'telephone',
      header: 'Téléphone',
    },
    {
      accessorKey: 'site_web',
      header: 'Site Web',
      cell: ({ row }: any) => {
        const siteWeb = row.getValue('site_web');
        return siteWeb ? (
          <a href={siteWeb} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {siteWeb}
          </a>
        ) : null;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => {
        const banque = row.original as Banque;
        return (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedBanque(banque);
                setIsViewDialogOpen(true);
              }}
              title="Voir"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleCopy(banque)}
              title="Dupliquer"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenForm(banque)}
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedBanque(banque);
                setIsDeleteDialogOpen(true);
              }}
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Banques</h1>
          <p className="text-muted-foreground">Gérez vos partenaires bancaires</p>
        </div>
        <Button onClick={() => handleOpenForm()}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une banque
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={banques}
        searchPlaceholder="Rechercher une banque..."
      />

      {/* Dialog formulaire */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Modifier la banque' : 'Ajouter une banque'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="raison_sociale">Raison Sociale *</Label>
                <Input
                  id="raison_sociale"
                  value={formData.raison_sociale}
                  onChange={(e) => setFormData({ ...formData, raison_sociale: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secteur_activite">Secteur d'activité</Label>
                <Input
                  id="secteur_activite"
                  value={formData.secteur_activite}
                  onChange={(e) => setFormData({ ...formData, secteur_activite: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adresse">Adresse</Label>
              <Input
                id="adresse"
                value={formData.adresse}
                onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telephone">Téléphone</Label>
                <Input
                  id="telephone"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="site_web">Site Web</Label>
              <Input
                id="site_web"
                value={formData.site_web}
                onChange={(e) => setFormData({ ...formData, site_web: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mots_cles_rapprochement">Mots-clés de rapprochement bancaire</Label>
              <Input
                id="mots_cles_rapprochement"
                value={formData.mots_cles_rapprochement}
                onChange={(e) => setFormData({ ...formData, mots_cles_rapprochement: e.target.value })}
                placeholder="Ex: BNP PARIBAS ou BNP, BNPP"
              />
              <p className="text-xs text-muted-foreground">
                <strong>Syntaxe :</strong> Espace = ET (tous les mots), Virgule = OU (l'un ou l'autre)
              </p>
            </div>

            {/* Rapprochement sections - only shown when editing */}
            {isEditing && selectedBanque && (
              <>
                <RapprochementSearchSection 
                  entityType="banque"
                  entityId={selectedBanque.id}
                  entityName={selectedBanque.raison_sociale}
                  savedKeywords={formData.mots_cles_rapprochement}
                />
                <MatchingHistorySection 
                  entityType="banque"
                  entityId={selectedBanque.id}
                  entityName={selectedBanque.raison_sociale}
                />
              </>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                {isEditing ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la banque "{selectedBanque?.raison_sociale}" ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de vue détaillée */}
      <ViewBanqueDialog
        banque={selectedBanque}
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
      />
    </div>
  );
}
