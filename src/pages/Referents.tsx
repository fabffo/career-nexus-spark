import { useState, useEffect } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Pencil, Trash, Plus, Mail, Phone, User, Building, Eye, Copy, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
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
import { z } from 'zod';

// Schema de validation
const referentSchema = z.object({
  prenom: z.string().trim().min(1, "Le prénom est requis").max(100, "Le prénom doit contenir moins de 100 caractères"),
  nom: z.string().trim().min(1, "Le nom est requis").max(100, "Le nom doit contenir moins de 100 caractères"),
  email: z.string().trim().email("Email invalide").max(255, "L'email doit contenir moins de 255 caractères"),
  telephone: z.string().trim().max(20, "Le téléphone doit contenir moins de 20 caractères").optional().or(z.literal('')),
  fonction: z.string().trim().max(100, "La fonction doit contenir moins de 100 caractères").optional().or(z.literal('')),
  client_id: z.string().optional().or(z.literal(''))
});

export default function Referents() {
  const [referents, setReferents] = useState<Referent[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingReferent, setViewingReferent] = useState<Referent | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [referentToDelete, setReferentToDelete] = useState<string | null>(null);
  const [editingReferent, setEditingReferent] = useState<Referent | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
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

  const validateForm = () => {
    try {
      referentSchema.parse(formData);
      setFormErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as string] = err.message;
          }
        });
        setFormErrors(errors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "Erreur de validation",
        description: "Veuillez corriger les erreurs dans le formulaire",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      const dataToSubmit = {
        prenom: formData.prenom.trim(),
        nom: formData.nom.trim(),
        email: formData.email.trim(),
        telephone: formData.telephone.trim() || null,
        fonction: formData.fonction.trim() || null,
        client_id: formData.client_id || null
      };

      if (editingReferent) {
        const { error } = await supabase
          .from('referents')
          .update({
            ...dataToSubmit,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingReferent.id);

        if (error) throw error;
        toast({ title: "Référent modifié avec succès" });
      } else {
        const { error } = await supabase
          .from('referents')
          .insert([dataToSubmit]);

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

  const confirmDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!referentToDelete) return;

    try {
      const { error } = await supabase
        .from('referents')
        .delete()
        .eq('id', referentToDelete);

      if (error) throw error;
      toast({ title: "Référent supprimé avec succès" });
      loadData();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setReferentToDelete(null);
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
      toast({ title: "Copié dans le presse-papier" });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({ 
        title: "Erreur", 
        description: "Impossible de copier", 
        variant: "destructive" 
      });
    }
  };

  const copyAllInfo = async (referent: Referent) => {
    const info = `${referent.prenom} ${referent.nom}
Email: ${referent.email}
${referent.telephone ? `Téléphone: ${referent.telephone}` : ''}
${referent.fonction ? `Fonction: ${referent.fonction}` : ''}
${(referent as any).clients ? `Client: ${(referent as any).clients.raison_sociale}` : ''}`;
    
    try {
      await navigator.clipboard.writeText(info);
      setCopiedField('all');
      toast({ title: "Informations copiées dans le presse-papier" });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({ 
        title: "Erreur", 
        description: "Impossible de copier", 
        variant: "destructive" 
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
    setFormErrors({});
  };

  const columns: ColumnDef<Referent>[] = [
    {
      accessorKey: 'nom',
      header: 'Nom',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <span className="font-medium">{row.original.prenom} {row.original.nom}</span>
        </div>
      )
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <a href={`mailto:${row.original.email}`} className="text-primary hover:underline">
            {row.original.email}
          </a>
        </div>
      )
    },
    {
      accessorKey: 'telephone',
      header: 'Téléphone',
      cell: ({ row }) => row.original.telephone && (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <a href={`tel:${row.original.telephone}`} className="text-primary hover:underline">
            {row.original.telephone}
          </a>
        </div>
      )
    },
    {
      accessorKey: 'fonction',
      header: 'Fonction',
      cell: ({ row }) => row.original.fonction || '-'
    },
    {
      accessorKey: 'client',
      header: 'Client',
      cell: ({ row }) => {
        const client = (row.original as any).clients;
        return client ? (
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-muted-foreground" />
            <span>{client.raison_sociale}</span>
          </div>
        ) : '-';
      }
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-1">
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
            title="Copier les informations"
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
            onClick={() => handleEdit(row.original)}
            title="Modifier"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setReferentToDelete(row.original.id);
              confirmDelete();
            }}
            title="Supprimer"
          >
            <Trash className="h-4 w-4 text-destructive" />
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
                  <Label htmlFor="prenom">Prénom *</Label>
                  <Input
                    id="prenom"
                    value={formData.prenom}
                    onChange={(e) => {
                      setFormData({ ...formData, prenom: e.target.value });
                      setFormErrors({ ...formErrors, prenom: '' });
                    }}
                    className={formErrors.prenom ? "border-destructive" : ""}
                    required
                  />
                  {formErrors.prenom && (
                    <p className="text-sm text-destructive">{formErrors.prenom}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom *</Label>
                  <Input
                    id="nom"
                    value={formData.nom}
                    onChange={(e) => {
                      setFormData({ ...formData, nom: e.target.value });
                      setFormErrors({ ...formErrors, nom: '' });
                    }}
                    className={formErrors.nom ? "border-destructive" : ""}
                    required
                  />
                  {formErrors.nom && (
                    <p className="text-sm text-destructive">{formErrors.nom}</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    setFormErrors({ ...formErrors, email: '' });
                  }}
                  className={formErrors.email ? "border-destructive" : ""}
                  required
                />
                {formErrors.email && (
                  <p className="text-sm text-destructive">{formErrors.email}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="telephone">Téléphone</Label>
                <Input
                  id="telephone"
                  value={formData.telephone}
                  onChange={(e) => {
                    setFormData({ ...formData, telephone: e.target.value });
                    setFormErrors({ ...formErrors, telephone: '' });
                  }}
                  className={formErrors.telephone ? "border-destructive" : ""}
                  placeholder="+33 6 12 34 56 78"
                />
                {formErrors.telephone && (
                  <p className="text-sm text-destructive">{formErrors.telephone}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fonction">Fonction</Label>
                <Input
                  id="fonction"
                  value={formData.fonction}
                  onChange={(e) => {
                    setFormData({ ...formData, fonction: e.target.value });
                    setFormErrors({ ...formErrors, fonction: '' });
                  }}
                  className={formErrors.fonction ? "border-destructive" : ""}
                  placeholder="Directeur commercial, Responsable RH..."
                />
                {formErrors.fonction && (
                  <p className="text-sm text-destructive">{formErrors.fonction}</p>
                )}
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
      
      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le référent sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReferentToDelete(null)}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de visualisation */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
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

                {(viewingReferent as any).clients && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Client associé</p>
                        <p className="font-medium">{(viewingReferent as any).clients.raison_sociale}</p>
                      </div>
                    </div>
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
    </div>
  );
}