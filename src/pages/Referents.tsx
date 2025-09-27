import { useState, useEffect } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Pencil, Trash, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Referent } from '@/types/database';

export default function Referents() {
  const [referents, setReferents] = useState<Referent[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReferent, setEditingReferent] = useState<Referent | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
    fonction: '',
    client_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load referents with client info
      const { data: referentsData, error: referentsError } = await supabase
        .from('referents')
        .select('*, clients(id, raison_sociale)')
        .order('created_at', { ascending: false });

      if (referentsError) throw referentsError;
      setReferents(referentsData || []);

      // Load clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, raison_sociale')
        .order('raison_sociale');

      if (clientsError) throw clientsError;
      setClients(clientsData || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingReferent) {
        const { error } = await supabase
          .from('referents')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingReferent.id);

        if (error) throw error;
        toast({ title: "Référent modifié avec succès" });
      } else {
        const { error } = await supabase
          .from('referents')
          .insert([formData]);

        if (error) throw error;
        toast({ title: "Référent ajouté avec succès" });
      }

      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (referent: Referent) => {
    setEditingReferent(referent);
    setFormData({
      prenom: referent.prenom,
      nom: referent.nom,
      email: referent.email,
      telephone: referent.telephone || '',
      fonction: referent.fonction || '',
      client_id: referent.client_id || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce référent ?')) return;

    try {
      const { error } = await supabase
        .from('referents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Référent supprimé avec succès" });
      loadData();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      prenom: '',
      nom: '',
      email: '',
      telephone: '',
      fonction: '',
      client_id: ''
    });
    setEditingReferent(null);
  };

  const columns: ColumnDef<Referent>[] = [
    {
      accessorKey: 'nom',
      header: 'Nom',
      cell: ({ row }) => `${row.original.prenom} ${row.original.nom}`
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
      accessorKey: 'fonction',
      header: 'Fonction',
    },
    {
      accessorKey: 'client',
      header: 'Client',
      cell: ({ row }) => (row.original as any).clients?.raison_sociale || '-'
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleEdit(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleDelete(row.original.id)}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Référents</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un référent
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingReferent ? 'Modifier le référent' : 'Ajouter un référent'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prenom">Prénom</Label>
                  <Input
                    id="prenom"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom</Label>
                  <Input
                    id="nom"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
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
              
              <div className="space-y-2">
                <Label htmlFor="fonction">Fonction</Label>
                <Input
                  id="fonction"
                  value={formData.fonction}
                  onChange={(e) => setFormData({ ...formData, fonction: e.target.value })}
                  placeholder="Directeur commercial, Responsable RH..."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                >
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucun client</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.raison_sociale}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Enregistrement...' : (editingReferent ? 'Modifier' : 'Ajouter')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="bg-card rounded-lg shadow-sm border">
        <DataTable
          columns={columns}
          data={referents}
          searchPlaceholder="Rechercher un référent..."
        />
      </div>
    </div>
  );
}