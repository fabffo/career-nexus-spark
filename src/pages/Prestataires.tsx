import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { ViewPrestataireDialog } from '@/components/ViewPrestataireDialog';

export default function Prestataires() {
  const [prestataires, setPrestataires] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'tous' | 'actif' | 'inactif'>('tous');
  const [loading, setLoading] = useState(false);
  const [selectedPrestataire, setSelectedPrestataire] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [recommandationFile, setRecommandationFile] = useState<File | null>(null);
  const [fournisseursServices, setFournisseursServices] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [typesPrestataire, setTypesPrestataire] = useState<{id: string, code: string, libelle: string}[]>([]);
  const { uploadFile, deleteFile, isUploading } = useFileUpload();

  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    detail_cv: '',
    cv_url: '',
    recommandation_url: '',
    type_prestataire: 'INDEPENDANT',
    fournisseur_services_id: '',
    salarie_id: '',
    mots_cles_rapprochement: '',
    delai_paiement_jours: 30,
    ecart_paiement_jours: 5
  });

  useEffect(() => {
    loadPrestataires();
    loadFournisseursServices();
    loadSalaries();
    loadTypesPrestataire();
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

  const loadSalaries = async () => {
    try {
      const { data, error } = await supabase
        .from('salaries')
        .select('*')
        .order('nom', { ascending: true });
      
      if (error) throw error;
      setSalaries(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des salariés:', error);
    }
  };

  const loadTypesPrestataire = async () => {
    try {
      const { data, error } = await supabase
        .from('param_type_prestataire' as any)
        .select('id, code, libelle')
        .eq('is_active', true)
        .order('ordre', { ascending: true });
      
      if (error) throw error;
      setTypesPrestataire((data as any) || []);
    } catch (error) {
      console.error('Erreur lors du chargement des types de prestataire:', error);
      // Fallback avec valeurs par défaut
      setTypesPrestataire([
        { id: '1', code: 'INDEPENDANT', libelle: 'Indépendant' },
        { id: '2', code: 'SALARIE', libelle: 'Salarié' },
        { id: '3', code: 'SOCIETE', libelle: 'Société' },
        { id: '4', code: 'APPORTEUR_AFFAIRES', libelle: 'Apporteur d\'affaires' }
      ]);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      let cvUrl = formData.cv_url;
      let recommandationUrl = formData.recommandation_url;

      // Upload des fichiers si nécessaire
      if (cvFile) {
        cvUrl = await uploadFile(cvFile, 'prestataires-files');
      }
      if (recommandationFile) {
        recommandationUrl = await uploadFile(recommandationFile, 'prestataires-files');
      }

      const dataToSubmit = {
        ...formData,
        email: formData.email || null,
        telephone: formData.telephone || null,
        detail_cv: formData.detail_cv || null,
        cv_url: cvUrl || null,
        recommandation_url: recommandationUrl || null,
        // Convertir les chaînes vides en null pour les UUID
        fournisseur_services_id: formData.fournisseur_services_id || null,
        salarie_id: formData.salarie_id || null
      };

      if (isEditMode && selectedPrestataire) {
        // Supprimer les anciens fichiers si de nouveaux sont uploadés
        if (cvFile && selectedPrestataire.cv_url) {
          await deleteFile(selectedPrestataire.cv_url, 'prestataires-files');
        }
        if (recommandationFile && selectedPrestataire.recommandation_url) {
          await deleteFile(selectedPrestataire.recommandation_url, 'prestataires-files');
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

  const handleToggleActif = async (id: string, currentActif: boolean) => {
    try {
      await prestataireService.update(id, { actif: !currentActif });
      toast.success(`Prestataire ${!currentActif ? 'activé' : 'désactivé'} avec succès`);
      loadPrestataires();
    } catch (error) {
      console.error('Erreur lors de la modification du statut:', error);
      toast.error('Erreur lors de la modification du statut');
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
      fournisseur_services_id: '',
      salarie_id: '',
      mots_cles_rapprochement: '',
      delai_paiement_jours: 30,
      ecart_paiement_jours: 5
    });
    setCvFile(null);
    setRecommandationFile(null);
    setSelectedPrestataire(null);
    setIsEditMode(false);
  };

  const handleSalarieChange = async (salarieId: string) => {
    const salarie = salaries.find(s => s.id === salarieId);
    if (salarie) {
      setFormData({
        ...formData,
        salarie_id: salarieId,
        nom: salarie.nom,
        prenom: salarie.prenom,
        email: salarie.email || '',
        telephone: salarie.telephone || '',
        detail_cv: salarie.detail_cv || '',
        cv_url: salarie.cv_url || '',
        recommandation_url: salarie.recommandation_url || ''
      });
    }
  };

  const openEditDialog = (prestataire: any) => {
    setSelectedPrestataire(prestataire);
    const defaultKeywords = `${prestataire.prenom} ${prestataire.nom}`.trim();
    setFormData({
      nom: prestataire.nom,
      prenom: prestataire.prenom,
      email: prestataire.email || '',
      telephone: prestataire.telephone || '',
      detail_cv: prestataire.detail_cv || '',
      cv_url: prestataire.cv_url || '',
      recommandation_url: prestataire.recommandation_url || '',
      type_prestataire: prestataire.type_prestataire || 'INDEPENDANT',
      fournisseur_services_id: prestataire.fournisseur_services_id || '',
      salarie_id: prestataire.salarie_id || '',
      mots_cles_rapprochement: prestataire.mots_cles_rapprochement || defaultKeywords,
      delai_paiement_jours: prestataire.delai_paiement_jours ?? 30,
      ecart_paiement_jours: prestataire.ecart_paiement_jours ?? 5
    });
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const openViewDialog = (prestataire: any) => {
    setSelectedPrestataire(prestataire);
    setIsViewDialogOpen(true);
  };

  const filteredPrestataires = prestataires.filter(prestataire => {
    const matchesSearch = `${prestataire.nom} ${prestataire.prenom} ${prestataire.email || ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'tous' ? true :
      statusFilter === 'actif' ? prestataire.actif !== false :
      prestataire.actif === false;
    
    return matchesSearch && matchesStatus;
  });

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
      cell: ({ row }) => {
        const type = row.original.type_prestataire;
        const typeInfo = typesPrestataire.find(t => t.code === type);
        const libelle = typeInfo?.libelle || type || 'Non défini';
        return (
          <Badge variant={type === 'SOCIETE' ? 'default' : type === 'SALARIE' ? 'outline' : 'secondary'}>
            {libelle}
          </Badge>
        );
      },
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
      id: "actif",
      header: "Actif",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.original.actif !== false}
            onCheckedChange={() => handleToggleActif(row.original.id, row.original.actif !== false)}
          />
          <span className="text-sm text-muted-foreground">
            {row.original.actif !== false ? 'Actif' : 'Inactif'}
          </span>
        </div>
      ),
    },
    {
      id: "statut",
      header: "Statut invitation",
      cell: ({ row }) => {
        if (row.original.user_id) {
          return <Badge variant="default">Compte créé</Badge>;
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

      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <Input
            placeholder="Rechercher un prestataire..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value: 'tous' | 'actif' | 'inactif') => setStatusFilter(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous</SelectItem>
            <SelectItem value="actif">Actifs</SelectItem>
            <SelectItem value="inactif">Inactifs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filteredPrestataires}
      />

      {/* Dialog de création/modification */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  onValueChange={(value: string) => 
                    setFormData({ ...formData, type_prestataire: value, fournisseur_services_id: '', salarie_id: '' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typesPrestataire.map((type) => (
                      <SelectItem key={type.id} value={type.code}>
                        {type.libelle}
                      </SelectItem>
                    ))}
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
              {formData.type_prestataire === 'SALARIE' && (
                <div>
                  <Label htmlFor="salarie">Salarié *</Label>
                  <Select
                    value={formData.salarie_id}
                    onValueChange={handleSalarieChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un salarié" />
                    </SelectTrigger>
                    <SelectContent>
                      {salaries.map((salarie) => (
                        <SelectItem key={salarie.id} value={salarie.id}>
                          {salarie.prenom} {salarie.nom}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="delai_paiement_jours">Délai de paiement (jours)</Label>
                <Input
                  id="delai_paiement_jours"
                  type="number"
                  min="0"
                  value={formData.delai_paiement_jours}
                  onChange={(e) => setFormData({ ...formData, delai_paiement_jours: parseInt(e.target.value) || 0 })}
                  placeholder="30"
                />
              </div>
              <div>
                <Label htmlFor="ecart_paiement_jours">Écart toléré (± jours)</Label>
                <Input
                  id="ecart_paiement_jours"
                  type="number"
                  min="0"
                  value={formData.ecart_paiement_jours}
                  onChange={(e) => setFormData({ ...formData, ecart_paiement_jours: parseInt(e.target.value) || 0 })}
                  placeholder="5"
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

            <div>
              <Label htmlFor="mots_cles_rapprochement">Mots-clés de rapprochement bancaire</Label>
              <Input
                id="mots_cles_rapprochement"
                value={formData.mots_cles_rapprochement}
                onChange={(e) => setFormData({ ...formData, mots_cles_rapprochement: e.target.value })}
                placeholder={`${formData.prenom} ${formData.nom}`.trim() || 'Mots-clés pour le rapprochement'}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Espaces = ET, Virgules = OU. Par défaut: nom du prestataire.
              </p>
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

      {/* Dialog de visualisation avec recherche de rapprochement */}
      <ViewPrestataireDialog
        prestataire={selectedPrestataire}
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
      />
    </div>
  );
}