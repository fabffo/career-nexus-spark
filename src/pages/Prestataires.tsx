import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, FileText, Mail, Phone, Edit, Trash2, Eye, Copy, Download, Upload, Send } from 'lucide-react';
import { prestataireService } from '@/services/contratService';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFileUpload } from '@/hooks/useFileUpload';
import { supabase } from '@/integrations/supabase/client';
import { FileUploadField } from '@/components/FileUploadField';

export default function Prestataires() {
  const [prestataires, setPrestataires] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPrestataire, setSelectedPrestataire] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [recommandationFile, setRecommandationFile] = useState<File | null>(null);
  const { uploadFile, deleteFile, isUploading } = useFileUpload();

  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    detail_cv: '',
    cv_url: '',
    recommandation_url: ''
  });

  useEffect(() => {
    loadPrestataires();
  }, []);

  const loadPrestataires = async () => {
    setLoading(true);
    try {
      const data = await prestataireService.getAll();
      setPrestataires(data);
    } catch (error) {
      console.error('Erreur lors du chargement des prestataires:', error);
      toast.error('Impossible de charger les prestataires');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      let cvUrl = formData.cv_url;
      let recommandationUrl = formData.recommandation_url;

      // Upload des fichiers si nécessaire
      if (cvFile) {
        cvUrl = await uploadFile(cvFile, 'prestataires/cv');
      }
      if (recommandationFile) {
        recommandationUrl = await uploadFile(recommandationFile, 'prestataires/recommandations');
      }

      const dataToSubmit = {
        ...formData,
        cv_url: cvUrl,
        recommandation_url: recommandationUrl
      };

      if (isEditMode && selectedPrestataire) {
        // Supprimer les anciens fichiers si de nouveaux sont uploadés
        if (cvFile && selectedPrestataire.cv_url) {
          await deleteFile(selectedPrestataire.cv_url);
        }
        if (recommandationFile && selectedPrestataire.recommandation_url) {
          await deleteFile(selectedPrestataire.recommandation_url);
        }

        await prestataireService.update(selectedPrestataire.id, dataToSubmit);
        toast.success('Prestataire modifié avec succès');
      } else {
        await prestataireService.create(dataToSubmit);
        toast.success('Prestataire créé avec succès');
      }

      setIsDialogOpen(false);
      resetForm();
      loadPrestataires();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce prestataire ?')) {
      try {
        await prestataireService.delete(id);
        toast.success('Prestataire supprimé avec succès');
        loadPrestataires();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        toast.error('Erreur lors de la suppression');
      }
    }
  };

  const handleDuplicate = async (prestataire: any) => {
    const { id, created_at, updated_at, ...dataToClone } = prestataire;
    try {
      await prestataireService.create({
        ...dataToClone,
        nom: `${dataToClone.nom} (copie)`,
      });
      toast.success('Prestataire dupliqué avec succès');
      loadPrestataires();
    } catch (error) {
      console.error('Erreur lors de la duplication:', error);
      toast.error('Erreur lors de la duplication');
    }
  };

  const handleSendInvitation = async (prestataire: any) => {
    try {
      const baseUrl = window.location.origin;
      
      const { data: { data: inviteData }, error } = await supabase.functions.invoke(
        'send-prestataire-invitation',
        {
          body: {
            prestataireId: prestataire.id,
            email: prestataire.email,
            nom: prestataire.nom,
            prenom: prestataire.prenom,
            baseUrl: baseUrl
          }
        }
      );

      if (error) throw error;

      toast.success('Invitation envoyée avec succès');
      // Recharger immédiatement les données pour voir le changement
      await loadPrestataires();
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'invitation:', error);
      toast.error('Erreur lors de l\'envoi de l\'invitation');
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      prenom: '',
      email: '',
      telephone: '',
      detail_cv: '',
      cv_url: '',
      recommandation_url: ''
    });
    setCvFile(null);
    setRecommandationFile(null);
    setSelectedPrestataire(null);
    setIsEditMode(false);
  };

  const openEditDialog = (prestataire: any) => {
    setSelectedPrestataire(prestataire);
    setFormData({
      nom: prestataire.nom,
      prenom: prestataire.prenom,
      email: prestataire.email || '',
      telephone: prestataire.telephone || '',
      detail_cv: prestataire.detail_cv || '',
      cv_url: prestataire.cv_url || '',
      recommandation_url: prestataire.recommandation_url || ''
    });
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const openViewDialog = (prestataire: any) => {
    setSelectedPrestataire(prestataire);
    setIsViewDialogOpen(true);
  };

  const filteredPrestataires = prestataires.filter(prestataire =>
    `${prestataire.nom} ${prestataire.prenom} ${prestataire.email || ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Prestataires</h1>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Prestataire
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Rechercher un prestataire..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Prénom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>CV</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : filteredPrestataires.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      Aucun prestataire trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPrestataires.map((prestataire) => (
                    <TableRow key={prestataire.id}>
                      <TableCell className="font-medium">{prestataire.nom}</TableCell>
                      <TableCell>{prestataire.prenom}</TableCell>
                      <TableCell>{prestataire.email || '-'}</TableCell>
                      <TableCell>{prestataire.telephone || '-'}</TableCell>
                      <TableCell>
                        {prestataire.cv_url && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(prestataire.cv_url, '_blank')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        {prestataire.user_id ? (
                          <Badge variant="default">Actif</Badge>
                        ) : prestataire.invitation_sent_at ? (
                          <Badge variant="secondary">Invité</Badge>
                        ) : (
                          <Badge variant="outline">En attente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openViewDialog(prestataire)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(prestataire)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDuplicate(prestataire)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {!prestataire.user_id && prestataire.email && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSendInvitation(prestataire)}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(prestataire.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de création/modification */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? 'Modifier le prestataire' : 'Nouveau prestataire'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nom">Nom *</Label>
                <Input
                  id="nom"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="prenom">Prénom *</Label>
                <Input
                  id="prenom"
                  value={formData.prenom}
                  onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
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

            <div>
              <Label htmlFor="detail_cv">Détail CV</Label>
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
                onFileSelect={setCvFile}
                onFileRemove={() => {
                  setCvFile(null);
                  setFormData({ ...formData, cv_url: '' });
                }}
                disabled={isUploading}
              />

              <FileUploadField
                label="Recommandation"
                accept=".pdf,.doc,.docx"
                currentFileUrl={formData.recommandation_url}
                onFileSelect={setRecommandationFile}
                onFileRemove={() => {
                  setRecommandationFile(null);
                  setFormData({ ...formData, recommandation_url: '' });
                }}
                disabled={isUploading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || isUploading || !formData.nom || !formData.prenom}
            >
              {isEditMode ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de visualisation */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails du prestataire</DialogTitle>
          </DialogHeader>

          {selectedPrestataire && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Nom</Label>
                  <p className="font-medium">{selectedPrestataire.nom}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Prénom</Label>
                  <p className="font-medium">{selectedPrestataire.prenom}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{selectedPrestataire.email || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Téléphone</Label>
                  <p className="font-medium">{selectedPrestataire.telephone || '-'}</p>
                </div>
              </div>

              {selectedPrestataire.detail_cv && (
                <div>
                  <Label className="text-muted-foreground">Détail CV</Label>
                  <p className="whitespace-pre-wrap">{selectedPrestataire.detail_cv}</p>
                </div>
              )}

              <div className="flex gap-4">
                {selectedPrestataire.cv_url && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(selectedPrestataire.cv_url, '_blank')}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Voir CV
                  </Button>
                )}
                {selectedPrestataire.recommandation_url && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(selectedPrestataire.recommandation_url, '_blank')}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Voir Recommandation
                  </Button>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}