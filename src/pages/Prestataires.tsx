import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, Send, Eye, Edit, Copy, Trash2, Plus, Search, FileText } from 'lucide-react';
import { prestataireService } from '@/services/contratService';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useFileUpload } from '@/hooks/useFileUpload';
import { supabase } from '@/integrations/supabase/client';
import { FileUploadField } from '@/components/FileUploadField';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';

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
  const [fournisseursServices, setFournisseursServices] = useState<any[]>([]);
  const { uploadFile, deleteFile, isUploading } = useFileUpload();

  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    detail_cv: '',
    cv_url: '',
    recommandation_url: '',
    type_prestataire: 'INDEPENDANT' as 'INDEPENDANT' | 'SOCIETE',
    fournisseur_services_id: ''
  });

  useEffect(() => {
    loadPrestataires();
    loadFournisseursServices();
  }, []);

  const loadPrestataires = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('prestataires')
        .select(`
          *,
          fournisseur_services:fournisseurs_services(*)
        `)
        .order('nom');
      
      if (error) throw error;
      setPrestataires(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des prestataires:', error);
      toast.error('Impossible de charger les prestataires');
    } finally {
      setLoading(false);
    }
  };

  const loadFournisseursServices = async () => {
    try {
      const { data, error } = await supabase
        .from('fournisseurs_services')
        .select('*')
        .order('raison_sociale');
      
      if (error) throw error;
      setFournisseursServices(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des fournisseurs:', error);
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
        email: formData.email || null, // Permettre null pour éviter la contrainte unique sur les emails vides
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
      recommandation_url: '',
      type_prestataire: 'INDEPENDANT',
      fournisseur_services_id: ''
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
      recommandation_url: prestataire.recommandation_url || '',
      type_prestataire: prestataire.type_prestataire || 'INDEPENDANT',
      fournisseur_services_id: prestataire.fournisseur_services_id || ''
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

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "nom",
      header: "Nom",
      cell: ({ row }) => <span className="font-medium">{row.original.nom}</span>,
    },
    {
      accessorKey: "prenom",
      header: "Prénom",
    },
    {
      accessorKey: "type_prestataire",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant={row.original.type_prestataire === 'SOCIETE' ? 'default' : 'secondary'}>
          {row.original.type_prestataire === 'SOCIETE' ? 'Société' : 'Indépendant'}
        </Badge>
      ),
    },
    {
      id: "societe",
      header: "Société",
      cell: ({ row }) =>
        row.original.type_prestataire === 'SOCIETE' && row.original.fournisseur_services
          ? row.original.fournisseur_services.raison_sociale
          : '-',
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => row.original.email || '-',
    },
    {
      accessorKey: "telephone",
      header: "Téléphone",
      cell: ({ row }) => row.original.telephone || '-',
    },
    {
      id: "cv",
      header: "CV",
      cell: ({ row }) =>
        row.original.cv_url ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.open(row.original.cv_url, '_blank')}
          >
            <Download className="h-4 w-4" />
          </Button>
        ) : null,
    },
    {
      id: "statut",
      header: "Statut",
      cell: ({ row }) => {
        if (row.original.user_id) {
          return <Badge variant="default">Actif</Badge>;
        } else if (row.original.invitation_sent_at) {
          return <Badge variant="secondary">Invité</Badge>;
        } else {
          return <Badge variant="outline">En attente</Badge>;
        }
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => openViewDialog(row.original)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openEditDialog(row.original)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleDuplicate(row.original)}>
            <Copy className="h-4 w-4" />
          </Button>
          {!row.original.user_id && row.original.email && (
            <Button size="sm" variant="ghost" onClick={() => handleSendInvitation(row.original)}>
              <Send className="h-4 w-4" />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => handleDelete(row.original.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      meta: { className: "text-right" },
    },
  ];

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

      <DataTable
        columns={columns}
        data={filteredPrestataires}
        searchPlaceholder="Rechercher un prestataire..."
      />

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
                <Label htmlFor="type_prestataire">Type de prestataire *</Label>
                <Select
                  value={formData.type_prestataire}
                  onValueChange={(value: 'INDEPENDANT' | 'SOCIETE') => 
                    setFormData({ ...formData, type_prestataire: value, fournisseur_services_id: '' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDEPENDANT">Indépendant</SelectItem>
                    <SelectItem value="SOCIETE">Société</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.type_prestataire === 'SOCIETE' && (
                <div>
                  <Label htmlFor="fournisseur_services">Fournisseur de services</Label>
                  <Select
                    value={formData.fournisseur_services_id}
                    onValueChange={(value) => setFormData({ ...formData, fournisseur_services_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un fournisseur" />
                    </SelectTrigger>
                    <SelectContent>
                      {fournisseursServices.map((fournisseur) => (
                        <SelectItem key={fournisseur.id} value={fournisseur.id}>
                          {fournisseur.raison_sociale}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
                  <Label className="text-muted-foreground">Type</Label>
                  <Badge variant={selectedPrestataire.type_prestataire === 'SOCIETE' ? 'default' : 'secondary'}>
                    {selectedPrestataire.type_prestataire === 'SOCIETE' ? 'Société' : 'Indépendant'}
                  </Badge>
                </div>
                {selectedPrestataire.type_prestataire === 'SOCIETE' && selectedPrestataire.fournisseur_services && (
                  <div>
                    <Label className="text-muted-foreground">Fournisseur de services</Label>
                    <p className="font-medium">{selectedPrestataire.fournisseur_services.raison_sociale}</p>
                  </div>
                )}
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