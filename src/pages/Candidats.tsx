import { useState, useEffect } from 'react';
import { candidatService } from '@/services';
import { Candidat } from '@/types/models';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Eye, Mail, Phone, MapPin, FileText, Award, Paperclip, Copy } from 'lucide-react';
import { ViewCandidatDialog } from '@/components/ViewCandidatDialog';
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

export default function Candidats() {
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCandidat, setSelectedCandidat] = useState<Candidat | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    metier: '',
    mail: '',
    telephone: '',
    adresse: '',
    cvUrl: '',
    recommandationUrl: '',
  });

  useEffect(() => {
    loadCandidats();
  }, []);

  const loadCandidats = async () => {
    const data = await candidatService.getAll();
    setCandidats(data);
  };

  const handleOpenForm = (candidat?: Candidat) => {
    if (candidat) {
      setSelectedCandidat(candidat);
      setFormData({
        nom: candidat.nom,
        prenom: candidat.prenom,
        metier: candidat.metier,
        mail: candidat.mail,
        telephone: candidat.telephone,
        adresse: candidat.adresse,
        cvUrl: candidat.cvUrl || '',
        recommandationUrl: candidat.recommandationUrl || '',
      });
    } else {
      setSelectedCandidat(null);
      setFormData({
        nom: '',
        prenom: '',
        metier: '',
        mail: '',
        telephone: '',
        adresse: '',
        cvUrl: '',
        recommandationUrl: '',
      });
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (selectedCandidat) {
        await candidatService.update(selectedCandidat.id, formData);
        toast.success('Candidat modifié avec succès');
      } else {
        await candidatService.create(formData);
        toast.success('Candidat créé avec succès');
      }
      setIsFormOpen(false);
      loadCandidats();
    } catch (error) {
      toast.error('Une erreur est survenue');
    }
  };

  const handleDelete = async () => {
    if (selectedCandidat) {
      try {
        await candidatService.delete(selectedCandidat.id);
        toast.success('Candidat supprimé avec succès');
        setIsDeleteOpen(false);
        loadCandidats();
      } catch (error) {
        toast.error('Une erreur est survenue');
      }
    }
  };

  const handleCopy = async (candidat: Candidat) => {
    try {
      const newCandidat = {
        nom: candidat.nom,
        prenom: candidat.prenom + ' (Copie)',
        metier: candidat.metier,
        mail: candidat.mail,
        telephone: candidat.telephone,
        adresse: candidat.adresse,
        cvUrl: candidat.cvUrl || '',
        recommandationUrl: candidat.recommandationUrl || '',
      };
      await candidatService.create(newCandidat);
      toast.success('Candidat dupliqué avec succès');
      loadCandidats();
    } catch (error) {
      toast.error('Une erreur est survenue');
    }
  };

  const handleView = (candidat: Candidat) => {
    setSelectedCandidat(candidat);
    setViewDialogOpen(true);

  const columns: ColumnDef<Candidat>[] = [
    {
      accessorKey: 'nom',
      header: 'Nom',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.nom}</div>
      ),
    },
    {
      accessorKey: 'prenom',
      header: 'Prénom',
    },
    {
      accessorKey: 'metier',
      header: 'Métier',
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">{row.original.metier}</div>
      ),
    },
    {
      accessorKey: 'mail',
      header: 'Email',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{row.original.mail}</span>
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
      id: 'documents',
      header: 'Documents',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.cvUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(row.original.cvUrl, '_blank')}
              title="Voir CV"
            >
              <FileText className="h-4 w-4" />
            </Button>
          )}
          {row.original.recommandationUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(row.original.recommandationUrl, '_blank')}
              title="Voir recommandation"
            >
              <Award className="h-4 w-4" />
            </Button>
          )}
          {!row.original.cvUrl && !row.original.recommandationUrl && (
            <span className="text-sm text-muted-foreground">Aucun</span>
          )}
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
              setSelectedCandidat(row.original);
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
          <h1 className="text-3xl font-bold tracking-tight">Candidats</h1>
          <p className="text-muted-foreground mt-2">
            Gérez votre base de candidats
          </p>
        </div>
        <Button onClick={() => handleOpenForm()} className="bg-gradient-to-r from-primary to-primary-hover">
          <Plus className="mr-2 h-4 w-4" />
          Nouveau candidat
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={candidats}
        searchPlaceholder="Rechercher un candidat..."
      />

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedCandidat ? 'Modifier le candidat' : 'Nouveau candidat'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nom">Nom</Label>
                <Input
                  id="nom"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="prenom">Prénom</Label>
                <Input
                  id="prenom"
                  value={formData.prenom}
                  onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="metier">Métier</Label>
              <Input
                id="metier"
                value={formData.metier}
                onChange={(e) => setFormData({ ...formData, metier: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="mail">Email</Label>
              <Input
                id="mail"
                type="email"
                value={formData.mail}
                onChange={(e) => setFormData({ ...formData, mail: e.target.value })}
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
              <Label htmlFor="adresse">Adresse</Label>
              <Input
                id="adresse"
                value={formData.adresse}
                onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cvUrl">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  URL du CV
                </div>
              </Label>
              <Input
                id="cvUrl"
                type="url"
                placeholder="https://example.com/cv.pdf"
                value={formData.cvUrl}
                onChange={(e) => setFormData({ ...formData, cvUrl: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="recommandationUrl">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  URL de recommandation
                </div>
              </Label>
              <Input
                id="recommandationUrl"
                type="url"
                placeholder="https://example.com/recommandation.pdf"
                value={formData.recommandationUrl}
                onChange={(e) => setFormData({ ...formData, recommandationUrl: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit}>
              {selectedCandidat ? 'Modifier' : 'Créer'}
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
              Cette action est irréversible. Le candidat sera définitivement supprimé.
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
      <ViewCandidatDialog 
        candidat={selectedCandidat} 
        open={viewDialogOpen} 
        onOpenChange={setViewDialogOpen} 
      />
    </div>
  );
}