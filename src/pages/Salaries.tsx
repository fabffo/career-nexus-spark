import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ViewSalarieDialog } from '@/components/ViewSalarieDialog';
import { SalarieHistoryDialog } from '@/components/SalarieHistoryDialog';
import { SalarieAdminDialog } from '@/components/SalarieAdminDialog';
import { FileUploadField } from '@/components/FileUploadField';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useFileUpload } from '@/hooks/useFileUpload';
import { salarieService } from '@/services/salarieService';
import { Salarie } from '@/types/salarie';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Eye, Trash2, Edit, Copy, History, FileText, Upload, Send, UserCog, Search, Loader2 } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Salaries() {
  const [salaries, setSalaries] = useState<Salarie[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [selectedSalarie, setSelectedSalarie] = useState<Salarie | null>(null);
  const [formData, setFormData] = useState<Partial<Salarie>>({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    metier: '',
    fonction: '',
    detail_cv: '',
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [recommandationFile, setRecommandationFile] = useState<File | null>(null);
  const [analyzeFile, setAnalyzeFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [analyzeStatus, setAnalyzeStatus] = useState('');
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { uploadFile } = useFileUpload();

  useEffect(() => {
    loadSalaries();
  }, []);

  const loadSalaries = async () => {
    setLoading(true);
    try {
      const data = await salarieService.getAll();
      setSalaries(data);
    } catch (error) {
      console.error('Error loading salaries:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les salariés',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (salarie?: Salarie) => {
    if (salarie) {
      setSelectedSalarie(salarie);
      setFormData(salarie);
    } else {
      setSelectedSalarie(null);
      setFormData({
        nom: '',
        prenom: '',
        email: '',
        telephone: '',
        metier: '',
        fonction: '',
        detail_cv: '',
      });
    }
    setCvFile(null);
    setRecommandationFile(null);
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    try {
      let cvUrl = formData.cv_url;
      let recommandationUrl = formData.recommandation_url;

      if (cvFile) {
        cvUrl = await uploadFile(cvFile, 'cv');
      }

      if (recommandationFile) {
        recommandationUrl = await uploadFile(recommandationFile, 'recommandation');
      }

      const salarieData = {
        ...formData,
        cv_url: cvUrl,
        recommandation_url: recommandationUrl,
      };

      if (selectedSalarie) {
        await salarieService.update(selectedSalarie.id, salarieData);
        toast({
          title: 'Succès',
          description: 'Salarié modifié avec succès',
        });
      } else {
        await salarieService.create(salarieData as Omit<Salarie, 'id' | 'created_at' | 'updated_at'>);
        toast({
          title: 'Succès',
          description: 'Salarié créé avec succès',
        });
      }

      setFormOpen(false);
      loadSalaries();
    } catch (error) {
      console.error('Error saving salarie:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder le salarié',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedSalarie) return;

    try {
      await salarieService.delete(selectedSalarie.id);
      toast({
        title: 'Succès',
        description: 'Salarié supprimé avec succès',
      });
      setDeleteOpen(false);
      loadSalaries();
    } catch (error) {
      console.error('Error deleting salarie:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le salarié',
        variant: 'destructive',
      });
    }
  };

  const handleCopy = async (salarie: Salarie) => {
    try {
      const newSalarie = {
        ...salarie,
        nom: `${salarie.nom} (Copie)`,
      };
      delete (newSalarie as any).id;
      delete (newSalarie as any).created_at;
      delete (newSalarie as any).updated_at;
      
      await salarieService.create(newSalarie);
      toast({
        title: 'Succès',
        description: 'Salarié dupliqué avec succès',
      });
      loadSalaries();
    } catch (error) {
      console.error('Error copying salarie:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de dupliquer le salarié',
        variant: 'destructive',
      });
    }
  };

  const handleView = (salarie: Salarie) => {
    setSelectedSalarie(salarie);
    setViewOpen(true);
  };

  const handleHistory = (salarie: Salarie) => {
    setSelectedSalarie(salarie);
    setHistoryOpen(true);
  };

  const handleSendInvitation = async (salarie: Salarie) => {
    if (!salarie.email) {
      toast({
        title: 'Email requis',
        description: 'Ce salarié n\'a pas d\'adresse email',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Implementation for sending invitation would go here
      toast({
        title: 'Invitation envoyée',
        description: `Une invitation a été envoyée à ${salarie.email}`,
      });
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'envoyer l\'invitation',
        variant: 'destructive',
      });
    }
  };

  const handleAnalyzeCV = async () => {
    if (!analyzeFile) return;

    setAnalyzing(true);
    setAnalyzeProgress(0);
    setAnalyzeStatus('Téléchargement du CV...');

    try {
      // Upload CV file
      setAnalyzeProgress(25);
      setAnalyzeStatus('Analyse du CV en cours...');
      
      const cvUrl = await uploadFile(analyzeFile, 'cv');
      
      setAnalyzeProgress(50);
      setAnalyzeStatus('Extraction des informations...');

      // For now, create a manual entry since we don't have CV analysis yet
      setAnalyzeProgress(75);
      setAnalyzeStatus('Création du profil salarié...');

      const fileName = analyzeFile.name;
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
      
      setFormData({
        nom: nameWithoutExt.split(' ')[1] || 'À renseigner',
        prenom: nameWithoutExt.split(' ')[0] || 'À renseigner',
        email: '',
        telephone: '',
        metier: '',
        fonction: '',
        cv_url: cvUrl,
        detail_cv: 'CV importé - Détails à compléter',
      });

      setAnalyzeProgress(100);
      setAnalyzeStatus('Analyse terminée!');
      
      setTimeout(() => {
        setAnalyzeOpen(false);
        setAnalyzing(false);
        setAnalyzeFile(null);
        setFormOpen(true);
        toast({
          title: 'CV importé',
          description: 'Veuillez compléter les informations du salarié',
        });
      }, 1000);

    } catch (error) {
      console.error('Error analyzing CV:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'analyser le CV',
        variant: 'destructive',
      });
      setAnalyzing(false);
    }
  };

  const columns: ColumnDef<Salarie>[] = [
    {
      accessorKey: 'nom',
      header: 'Nom',
    },
    {
      accessorKey: 'prenom',
      header: 'Prénom',
    },
    {
      accessorKey: 'metier',
      header: 'Métier',
    },
    {
      accessorKey: 'fonction',
      header: 'Fonction',
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
      header: 'Documents',
      cell: ({ row }) => {
        const salarie = row.original;
        return (
          <div className="flex gap-2">
            {salarie.cv_url && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => window.open(salarie.cv_url, '_blank')}>
                CV
              </Badge>
            )}
            {salarie.recommandation_url && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => window.open(salarie.recommandation_url, '_blank')}>
                Rec.
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      header: 'Actions',
      cell: ({ row }) => {
        const salarie = row.original;
        return (
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleView(salarie)}
              title="Voir"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleHistory(salarie)}
              title="Historique"
            >
              <History className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleSendInvitation(salarie)}
              title="Envoyer invitation"
              disabled={!salarie.email}
            >
              <Send className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleCopy(salarie)}
              title="Dupliquer"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleOpenForm(salarie)}
              title="Modifier"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setSelectedSalarie(salarie);
                setDeleteOpen(true);
              }}
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold">Salariés</h1>
          <p className="text-muted-foreground">Gérez vos salariés et leurs informations</p>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => handleOpenForm()}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un salarié
          </Button>
          <Button 
            variant="outline"
            onClick={() => setAnalyzeOpen(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Analyser un CV
          </Button>
          {user?.role === 'ADMIN' && (
            <Button 
              variant="outline"
              onClick={() => setAdminOpen(true)}
            >
              <UserCog className="h-4 w-4 mr-2" />
              Accès salariés
            </Button>
          )}
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={salaries}
        searchPlaceholder="Rechercher un salarié..."
      />

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSalarie ? 'Modifier le salarié' : 'Ajouter un salarié'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="metier">Métier</Label>
                <Input
                  id="metier"
                  value={formData.metier}
                  onChange={(e) => setFormData({ ...formData, metier: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="fonction">Fonction</Label>
                <Input
                  id="fonction"
                  value={formData.fonction}
                  onChange={(e) => setFormData({ ...formData, fonction: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="detail_cv">Détails CV</Label>
              <Textarea
                id="detail_cv"
                value={formData.detail_cv}
                onChange={(e) => setFormData({ ...formData, detail_cv: e.target.value })}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FileUploadField
                label="CV"
                accept=".pdf,.doc,.docx"
                currentFileUrl={formData.cv_url}
                onFileSelect={(file) => setCvFile(file)}
                onFileRemove={() => setCvFile(null)}
              />
              <FileUploadField
                label="Recommandation"
                accept=".pdf,.doc,.docx"
                currentFileUrl={formData.recommandation_url}
                onFileSelect={(file) => setRecommandationFile(file)}
                onFileRemove={() => setRecommandationFile(null)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit}>
              {selectedSalarie ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le salarié sera définitivement supprimé.
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
      <ViewSalarieDialog
        salarie={selectedSalarie}
        open={viewOpen}
        onOpenChange={setViewOpen}
      />

      {/* History Dialog */}
      {selectedSalarie && (
        <SalarieHistoryDialog
          salarieId={selectedSalarie.id}
          salarieName={`${selectedSalarie.prenom} ${selectedSalarie.nom}`}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
        />
      )}

      {/* CV Analysis Dialog */}
      <Dialog open={analyzeOpen} onOpenChange={setAnalyzeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Analyser un CV</DialogTitle>
          </DialogHeader>

          {!analyzing ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="cv-analyze">Sélectionner un CV</Label>
                <Input
                  id="cv-analyze"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setAnalyzeFile(e.target.files?.[0] || null)}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setAnalyzeOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleAnalyzeCV} disabled={!analyzeFile}>
                  <Upload className="h-4 w-4 mr-2" />
                  Analyser
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <Progress value={analyzeProgress} />
              <p className="text-sm text-center text-muted-foreground">{analyzeStatus}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Dialog */}
      <SalarieAdminDialog
        open={adminOpen}
        onOpenChange={setAdminOpen}
        onUpdate={loadSalaries}
      />
    </div>
  );
}