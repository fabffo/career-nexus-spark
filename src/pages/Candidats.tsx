import { useState, useEffect, useRef } from 'react';
import { candidatService } from '@/services';
import { Candidat } from '@/types/models';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Eye, Mail, Phone, MapPin, FileText, Award, Paperclip, Copy, History, Upload, X, Sparkles, Send, Shield, UserPlus, FileUp } from 'lucide-react';
import { ViewCandidatDialog } from '@/components/ViewCandidatDialog';
import { CandidatHistoryDialog } from '@/components/CandidatHistoryDialog';
import { CandidatAdminDialog } from '@/components/CandidatAdminDialog';
import { ImportCsvDialog } from '@/components/ImportCsvDialog';
import { useAuth } from '@/contexts/AuthContext';
import { ColumnDef } from '@tanstack/react-table';
import { useFileUpload } from '@/hooks/useFileUpload';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function Candidats() {
  const { toast } = useToast();
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isAnalyzeOpen, setIsAnalyzeOpen] = useState(false);
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  const [isImportCsvOpen, setIsImportCsvOpen] = useState(false);
  const [selectedCandidat, setSelectedCandidat] = useState<Candidat | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [manualEntry, setManualEntry] = useState(false);
  const [analyzeCvFile, setAnalyzeCvFile] = useState<File | null>(null);
  const [manualData, setManualData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: ''
  });
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    metier: '',
    mail: '',
    telephone: '',
    adresse: '',
    cvUrl: '',
    recommandationUrl: '',
    detail_cv: '',
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [recommandationFile, setRecommandationFile] = useState<File | null>(null);
  const { uploadFile, deleteFile, isUploading } = useFileUpload();
  const { profile } = useAuth();
  const cvInputRef = useRef<HTMLInputElement>(null);
  const recommandationInputRef = useRef<HTMLInputElement>(null);
  const analyzeCvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCandidats();
  }, []);

  const loadCandidats = async () => {
    try {
      const data = await candidatService.getAll();
      console.log('Candidats loaded:', data);
      setCandidats(data);
    } catch (error) {
      console.error('Error loading candidats:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les candidats. Vérifiez votre connexion.",
        variant: "destructive"
      });
    }
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
        detail_cv: candidat.detail_cv || '',
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
        detail_cv: '',
      });
      setCvFile(null);
      setRecommandationFile(null);
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    try {
      let cvUrl = formData.cvUrl;
      let recommandationUrl = formData.recommandationUrl;

      // Upload CV if file selected
      if (cvFile) {
        // Delete old CV if exists and updating
        if (selectedCandidat?.cvUrl) {
          await deleteFile(selectedCandidat.cvUrl);
        }
        cvUrl = await uploadFile(cvFile);
      }

      // Upload recommendation if file selected
      if (recommandationFile) {
        // Delete old recommendation if exists and updating
        if (selectedCandidat?.recommandationUrl) {
          await deleteFile(selectedCandidat.recommandationUrl);
        }
        recommandationUrl = await uploadFile(recommandationFile);
      }

      const updatedFormData = {
        ...formData,
        cvUrl,
        recommandationUrl,
      };

      if (selectedCandidat) {
        await candidatService.update(selectedCandidat.id, updatedFormData);
        toast({
          title: "Succès",
          description: "Candidat modifié avec succès"
        });
      } else {
        await candidatService.create(updatedFormData);
        toast({
          title: "Succès",
          description: "Candidat créé avec succès"
        });
      }
      setIsFormOpen(false);
      setCvFile(null);
      setRecommandationFile(null);
      loadCandidats();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    if (selectedCandidat) {
      try {
        await candidatService.delete(selectedCandidat.id);
        toast({
          title: "Succès", 
          description: "Candidat supprimé avec succès"
        });
        setIsDeleteOpen(false);
        loadCandidats();
      } catch (error) {
        toast({
          title: "Erreur",
          description: "Une erreur est survenue",
          variant: "destructive"
        });
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
        detail_cv: candidat.detail_cv || '',
      };
      await candidatService.create(newCandidat);
      toast({
        title: "Succès",
        description: "Candidat dupliqué avec succès"
      });
      loadCandidats();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue",
        variant: "destructive"
      });
    }
  };

  const handleView = (candidat: Candidat) => {
    setSelectedCandidat(candidat);
    setViewDialogOpen(true);
  };

  const handleHistory = (candidat: Candidat) => {
    setSelectedCandidat(candidat);
    setHistoryDialogOpen(true);
  };

  const handleSendInvitation = async (candidat: Candidat) => {
    try {
      const baseUrl = window.location.origin;
      
      const { error } = await supabase.functions.invoke('send-candidat-invitation', {
        body: { candidatId: candidat.id, baseUrl }
      });

      if (error) throw error;

      toast({
        title: "Succès",
        description: `Invitation envoyée à ${candidat.mail}`
      });
      loadCandidats();
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer l'invitation",
        variant: "destructive"
      });
    }
  };

  const handleCreatePrestataire = async (candidat: Candidat) => {
    try {
      // Créer le prestataire à partir des données du candidat
      const { error } = await supabase
        .from('prestataires')
        .insert({
          nom: candidat.nom,
          prenom: candidat.prenom,
          email: candidat.mail,
          telephone: candidat.telephone,
          cv_url: candidat.cvUrl,
          recommandation_url: candidat.recommandationUrl,
          detail_cv: candidat.detail_cv,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Succès",
        description: `Prestataire créé à partir de ${candidat.prenom} ${candidat.nom}`
      });
    } catch (error: any) {
      console.error('Error creating prestataire:', error);
      // Si l'erreur est due à un doublon d'email, afficher un message plus clair
      if (error.code === '23505') {
        toast({
          title: "Erreur",
          description: "Un prestataire avec cet email existe déjà",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erreur",
          description: error.message || "Impossible de créer le prestataire",
          variant: "destructive"
        });
      }
    }
  };

  const handleAnalyzeCV = async (file: File) => {
    setIsAnalyzing(true);
    setAnalyzeProgress(10);
    
    try {
      // If manual data is provided, skip AI analysis and create candidate directly
      if (manualEntry && manualData.nom && manualData.prenom) {
        setAnalyzeProgress(30);
        
        // Upload CV file directly
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `cv/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('candidats-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('candidats-files')
          .getPublicUrl(filePath);

        setAnalyzeProgress(60);

        // Create the candidate in the database with manual data
        const candidateData = {
          nom: manualData.nom,
          prenom: manualData.prenom,
          email: manualData.email || '',
          telephone: manualData.telephone || '',
          cv_url: publicUrl,
        };

        const { error: insertError } = await supabase
          .from('candidats')
          .insert(candidateData)
          .select()
          .single();

        if (insertError) throw insertError;

        setAnalyzeProgress(100);
        toast({
          title: "Succès",
          description: "Candidat créé avec succès !"
        });
        await loadCandidats();
        
        setTimeout(() => {
          setIsAnalyzeOpen(false);
          setIsAnalyzing(false);
          setAnalyzeProgress(0);
          setManualEntry(false);
          setAnalyzeCvFile(null);
          setManualData({ nom: '', prenom: '', email: '', telephone: '' });
        }, 1000);
        return;
      }

      // Original AI analysis (if not manual entry)
      const reader = new FileReader();
      const fileContent = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });

      setAnalyzeProgress(30);
      
      // Call edge function to analyze CV
      const response = await supabase.functions.invoke('analyze-cv', {
        body: {
          fileContent,
          fileName: file.name,
          fileType: file.type
        }
      });

      const { data, error } = response;

      setAnalyzeProgress(80);

      if (error) throw error;

      if (data?.success && data?.candidat) {
        toast({
          title: "Succès",
          description: "CV analysé et candidat créé avec succès !"
        });
        setAnalyzeProgress(100);
        await loadCandidats();
        setTimeout(() => {
          setIsAnalyzeOpen(false);
          setIsAnalyzing(false);
          setAnalyzeProgress(0);
        }, 1000);
      } else {
        throw new Error(data?.error || 'Erreur lors de l\'analyse du CV');
      }
    } catch (error: any) {
      console.error('Error analyzing CV:', error);
      const errorMessage = error?.message || 'Erreur lors de l\'analyse du CV';
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive"
      });
      setIsAnalyzing(false);
      setAnalyzeProgress(0);
    }
  };

  const columns: ColumnDef<Candidat>[] = [
    {
      accessorKey: 'nom',
      header: 'Nom',
      cell: ({ row }) => (
        <div className="font-medium truncate max-w-[150px]" title={row.original.nom}>
          {row.original.nom}
        </div>
      ),
    },
    {
      accessorKey: 'prenom',
      header: 'Prénom',
      cell: ({ row }) => (
        <div className="truncate max-w-[150px]" title={row.original.prenom}>
          {row.original.prenom}
        </div>
      ),
    },
    {
      accessorKey: 'metier',
      header: 'Métier',
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground truncate max-w-[150px]" title={row.original.metier}>
          {row.original.metier}
        </div>
      ),
    },
    {
      accessorKey: 'mail',
      header: 'Email',
      cell: ({ row }) => (
        <div className="flex items-center gap-2 max-w-[200px]">
          <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm truncate" title={row.original.mail}>
            {row.original.mail}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'telephone',
      header: 'Téléphone',
      cell: ({ row }) => (
        <div className="flex items-center gap-2 max-w-[150px]">
          <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm truncate" title={row.original.telephone}>
            {row.original.telephone}
          </span>
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
      size: 280,
      enableHiding: false,
      meta: {
        className: 'sticky right-0 bg-background shadow-[-2px_0_4px_rgba(0,0,0,0.1)]',
      },
      cell: ({ row }) => (
        <div className="flex items-center gap-1 bg-background">
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
            onClick={() => handleHistory(row.original)}
            title="Historique des RDV"
            className="text-primary"
          >
            <History className="h-4 w-4" />
          </Button>
          {!(row.original as any).user_id && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSendInvitation(row.original)}
              title="Envoyer invitation"
              className="text-primary"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCreatePrestataire(row.original)}
            title="Créer un prestataire"
            className="text-green-600 hover:text-green-700"
          >
            <UserPlus className="h-4 w-4" />
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
        <div className="flex gap-2">
          {profile?.role === 'ADMIN' && (
            <Button 
              onClick={() => setIsAdminDialogOpen(true)} 
              variant="outline"
            >
              <Shield className="mr-2 h-4 w-4" />
              Gestion des accès
            </Button>
          )}
          <Button 
            onClick={() => setIsImportCsvOpen(true)} 
            variant="outline"
          >
            <FileUp className="mr-2 h-4 w-4" />
            Importer CSV
          </Button>
          <Button 
            onClick={() => setIsAnalyzeOpen(true)} 
            className="bg-gradient-to-r from-primary to-primary-hover"
            disabled
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Analyser un CV
          </Button>
          <Button onClick={() => handleOpenForm()} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau candidat
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={candidats}
        searchPlaceholder="Rechercher un candidat..."
      />

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedCandidat ? 'Modifier le candidat' : 'Nouveau candidat'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
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
              
              <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="adresse">Adresse</Label>
                <Input
                  id="adresse"
                  value={formData.adresse}
                  onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="detail_cv">Détail CV</Label>
                <textarea
                  id="detail_cv"
                  value={formData.detail_cv}
                  onChange={(e) => setFormData({ ...formData, detail_cv: e.target.value })}
                  className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                  placeholder="Ajoutez des détails sur le CV du candidat..."
                />
              </div>
              
              {/* CV Upload */}
              <div className="space-y-2">
                <Label>CV</Label>
                <input
                  ref={cvInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setCvFile(file);
                  }}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  {formData.cvUrl || cvFile ? (
                    <>
                      <div className="flex-1 flex items-center gap-2 p-2 rounded-md border border-border bg-muted/50 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-muted-foreground truncate">
                          {cvFile ? cvFile.name : 'CV existant'}
                        </span>
                      </div>
                      {formData.cvUrl && !cvFile && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => window.open(formData.cvUrl, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setCvFile(null);
                          setFormData({ ...formData, cvUrl: '' });
                          if (cvInputRef.current) cvInputRef.current.value = '';
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => cvInputRef.current?.click()}
                      className="w-full"
                      disabled={isUploading}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Télécharger CV
                    </Button>
                  )}
                </div>
              </div>

              {/* Recommendation Upload */}
              <div className="space-y-2">
                <Label>Lettre de recommandation</Label>
                <input
                  ref={recommandationInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setRecommandationFile(file);
                  }}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  {formData.recommandationUrl || recommandationFile ? (
                    <>
                      <div className="flex-1 flex items-center gap-2 p-2 rounded-md border border-border bg-muted/50 min-w-0">
                        <Award className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-muted-foreground truncate">
                          {recommandationFile ? recommandationFile.name : 'Recommandation existante'}
                        </span>
                      </div>
                      {formData.recommandationUrl && !recommandationFile && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => window.open(formData.recommandationUrl, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setRecommandationFile(null);
                          setFormData({ ...formData, recommandationUrl: '' });
                          if (recommandationInputRef.current) recommandationInputRef.current.value = '';
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => recommandationInputRef.current?.click()}
                      className="w-full"
                      disabled={isUploading}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Télécharger recommandation
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isUploading}>
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

      {/* History Dialog */}
      <CandidatHistoryDialog
        candidat={selectedCandidat}
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
      />

      {/* Analyze CV Dialog */}
      <Dialog open={isAnalyzeOpen} onOpenChange={setIsAnalyzeOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Analyser un CV avec l'IA</DialogTitle>
            <DialogDescription>
              Uploadez un CV pour extraire automatiquement les informations du candidat
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!isAnalyzing ? (
              <>
                <input
                  ref={analyzeCvInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleAnalyzeCV(file);
                    }
                  }}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">Télécharger un CV</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Formats acceptés : PDF, DOC, DOCX, TXT
                  </p>
                  <Button
                    onClick={() => analyzeCvInputRef.current?.click()}
                    variant="outline"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Sélectionner un fichier
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <Sparkles className="h-12 w-12 text-primary animate-pulse" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-medium mb-2">Analyse en cours...</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    L'IA extrait les informations du CV
                  </p>
                </div>
                <Progress value={analyzeProgress} className="w-full" />
              </div>
            )}
          </div>
          {!isAnalyzing && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAnalyzeOpen(false)}>
                Annuler
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Dialog */}
      <CandidatAdminDialog
        open={isAdminDialogOpen}
        onOpenChange={setIsAdminDialogOpen}
        onUpdate={loadCandidats}
      />

      {/* Import CSV Dialog */}
      <ImportCsvDialog
        open={isImportCsvOpen}
        onOpenChange={setIsImportCsvOpen}
        onImportComplete={loadCandidats}
      />
    </div>
  );
}