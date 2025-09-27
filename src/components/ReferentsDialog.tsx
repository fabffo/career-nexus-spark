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
import { Plus, Edit, Trash2, Mail, Phone, User, Eye, Copy, Check } from 'lucide-react';
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
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingReferent, setViewingReferent] = useState<Referent | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
    fonction: '',
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
        fonction: referent.fonction || '',
      });
    } else {
      setSelectedReferent(null);
      setFormData({
        prenom: '',
        nom: '',
        email: '',
        telephone: '',
        fonction: '',
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

  const handleView = (referent: Referent) => {
    setViewingReferent(referent);
    setViewDialogOpen(true);
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success('Copié dans le presse-papier');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const copyAllInfo = async (referent: Referent) => {
    const info = `${referent.prenom} ${referent.nom}
Email: ${referent.email}
${referent.telephone ? `Téléphone: ${referent.telephone}` : ''}
${referent.fonction ? `Fonction: ${referent.fonction}` : ''}`;
    
    try {
      await navigator.clipboard.writeText(info);
      setCopiedField('all');
      toast.success('Informations copiées');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Impossible de copier');
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
      accessorKey: 'fonction',
      header: 'Fonction',
      cell: ({ row }) => row.original.fonction || '-',
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
            onClick={() => copyAllInfo(row.original)}
            title="Copier"
          >
            {copiedField === 'all' ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
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
        <DialogContent className="max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              Référents de {clientName}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-grow overflow-auto space-y-4">
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
              <div className="min-h-0">
                <DataTable
                  columns={columns}
                  data={referents}
                  searchPlaceholder="Rechercher un référent..."
                />
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Aucun référent pour ce client
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[550px]">
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
            <div>
              <Label htmlFor="fonction">Fonction</Label>
              <Input
                id="fonction"
                value={formData.fonction}
                onChange={(e) => setFormData({ ...formData, fonction: e.target.value })}
                placeholder="Directeur commercial, Responsable RH..."
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

      {/* Dialog de visualisation */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détails du référent</DialogTitle>
          </DialogHeader>
          {viewingReferent && (
            <div className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Nom complet</p>
                      <p className="font-medium">{viewingReferent.prenom} {viewingReferent.nom}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(`${viewingReferent.prenom} ${viewingReferent.nom}`, 'name')}
                  >
                    {copiedField === 'name' ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <a href={`mailto:${viewingReferent.email}`} className="text-primary hover:underline">
                        {viewingReferent.email}
                      </a>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(viewingReferent.email, 'email')}
                  >
                    {copiedField === 'email' ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {viewingReferent.telephone && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Téléphone</p>
                        <a href={`tel:${viewingReferent.telephone}`} className="text-primary hover:underline">
                          {viewingReferent.telephone}
                        </a>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(viewingReferent.telephone!, 'phone')}
                    >
                      {copiedField === 'phone' ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}

                {viewingReferent.fonction && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Fonction</p>
                        <p className="font-medium">{viewingReferent.fonction}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(viewingReferent.fonction!, 'fonction')}
                    >
                      {copiedField === 'fonction' ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => copyAllInfo(viewingReferent)}
                  className="flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copier tout
                </Button>
                <Button onClick={() => setViewDialogOpen(false)}>
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}