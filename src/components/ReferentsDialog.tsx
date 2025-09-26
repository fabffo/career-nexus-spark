import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Mail, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ColumnDef } from '@tanstack/react-table';
import { Referent } from '@/types/database';
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

interface ReferentsDialogProps {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReferentsDialog({ clientId, clientName, open, onOpenChange }: ReferentsDialogProps) {
  const [referents, setReferents] = useState<Referent[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedReferent, setSelectedReferent] = useState<Referent | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
  });

  useEffect(() => {
    if (open && clientId) {
      loadReferents();
    }
  }, [open, clientId]);

  const loadReferents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('referents')
        .select('*')
        .eq('client_id', clientId)
        .order('nom', { ascending: true });

      if (error) throw error;
      setReferents(data || []);
    } catch (error) {
      console.error('Error loading referents:', error);
      toast.error('Erreur lors du chargement des référents');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (referent?: Referent) => {
    if (referent) {
      setSelectedReferent(referent);
      setFormData({
        prenom: referent.prenom,
        nom: referent.nom,
        email: referent.email,
        telephone: referent.telephone || '',
      });
    } else {
      setSelectedReferent(null);
      setFormData({
        prenom: '',
        nom: '',
        email: '',
        telephone: '',
      });
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (selectedReferent) {
        const { error } = await supabase
          .from('referents')
          .update(formData)
          .eq('id', selectedReferent.id);

        if (error) throw error;
        toast.success('Référent modifié avec succès');
      } else {
        const { error } = await supabase
          .from('referents')
          .insert({
            ...formData,
            client_id: clientId,
          });

        if (error) throw error;
        toast.success('Référent créé avec succès');
      }
      setIsFormOpen(false);
      loadReferents();
    } catch (error) {
      console.error('Error saving referent:', error);
      toast.error('Une erreur est survenue');
    }
  };

  const handleDelete = async () => {
    if (selectedReferent) {
      try {
        const { error } = await supabase
          .from('referents')
          .delete()
          .eq('id', selectedReferent.id);

        if (error) throw error;
        toast.success('Référent supprimé avec succès');
        setIsDeleteOpen(false);
        loadReferents();
      } catch (error) {
        console.error('Error deleting referent:', error);
        toast.error('Une erreur est survenue');
      }
    }
  };

  const columns: ColumnDef<Referent>[] = [
    {
      accessorKey: 'fullName',
      header: 'Nom complet',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <span className="font-medium">{row.original.prenom} {row.original.nom}</span>
        </div>
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
      cell: ({ row }) => row.original.telephone && (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{row.original.telephone}</span>
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
            onClick={() => handleOpenForm(row.original)}
            title="Modifier"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedReferent(row.original);
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>
              Référents de {clientName}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => handleOpenForm()} size="sm" className="bg-gradient-to-r from-primary to-primary-hover">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau référent
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Chargement...
              </div>
            ) : referents.length > 0 ? (
              <DataTable
                columns={columns}
                data={referents}
                searchPlaceholder="Rechercher un référent..."
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Aucun référent pour ce client
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>
              {selectedReferent ? 'Modifier le référent' : 'Nouveau référent'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="prenom">Prénom</Label>
                <Input
                  id="prenom"
                  value={formData.prenom}
                  onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="nom">Nom</Label>
                <Input
                  id="nom"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="telephone">Téléphone</Label>
              <Input
                id="telephone"
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.prenom || !formData.nom || !formData.email}
            >
              {selectedReferent ? 'Modifier' : 'Créer'}
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
              Cette action est irréversible. Le référent sera définitivement supprimé.
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
    </>
  );
}