import { useState, useEffect } from 'react';
import { Contrat, ContratStatut } from '@/types/contrat';
import { contratService, prestataireService, fournisseurServicesService, fournisseurGeneralService } from '@/services/contratService';
import { clientService } from '@/services';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Eye, Copy, FileCheck, XCircle, Archive, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast as sonnerToast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFileUpload } from '@/hooks/useFileUpload';
import { FileUploadField } from '@/components/FileUploadField';
import { supabase } from '@/integrations/supabase/client';

type ContratType = 'PRESTATAIRE' | 'FOURNISSEUR_SERVICES' | 'FOURNISSEUR_GENERAL';

export default function ContratsFournisseurs() {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [prestataires, setPrestataires] = useState<any[]>([]);
  const [fournisseursServices, setFournisseursServices] = useState<any[]>([]);
  const [fournisseursGeneraux, setFournisseursGeneraux] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContrat, setSelectedContrat] = useState<Contrat | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [pieceJointeFile, setPieceJointeFile] = useState<File | null>(null);
  const { uploadFile, deleteFile, isUploading } = useFileUpload();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    numero_contrat: '',
    type: 'PRESTATAIRE' as ContratType,
    statut: 'BROUILLON' as ContratStatut,
    date_debut: '',
    date_fin: '',
    version: '1.0',
    prestataire_id: undefined as string | undefined,
    fournisseur_services_id: undefined as string | undefined,
    fournisseur_general_id: undefined as string | undefined,
    client_lie_id: undefined as string | undefined,
    montant: '',
    description: '',
    piece_jointe_url: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [contratsData, clientsData, prestatairesData] = await Promise.all([
        contratService.getAll(),
        clientService.getAll(),
        prestataireService.getAll()
      ]);

      // Charger les fournisseurs
      let fournisseursServicesData: any[] = [];
      let fournisseursGenerauxData: any[] = [];
      
      try {
        const { data: fsData } = await supabase.from('fournisseurs_services').select('*');
        fournisseursServicesData = fsData || [];
      } catch (error) {
        console.log('Erreur chargement fournisseurs_services:', error);
      }
      
      try {
        const { data: fgData } = await supabase.from('fournisseurs_generaux').select('*');
        fournisseursGenerauxData = fgData || [];
      } catch (error) {
        console.log('Erreur chargement fournisseurs_generaux:', error);
      }

      // Filtrer les contrats fournisseurs
      const contratsFournisseurs = contratsData.filter(c => 
        c.type === 'PRESTATAIRE' || 
        c.type === 'FOURNISSEUR_SERVICES' || 
        c.type === 'FOURNISSEUR_GENERAL'
      );

      setContrats(contratsFournisseurs);
      setClients(clientsData);
      setPrestataires(prestatairesData);
      setFournisseursServices(fournisseursServicesData);
      setFournisseursGeneraux(fournisseursGenerauxData);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce contrat ?')) {
      return;
    }
    try {
      await contratService.delete(id);
      sonnerToast.success('Contrat supprimé avec succès');
      loadData();
    } catch (error: any) {
      console.error('Error deleting contrat:', error);
      sonnerToast.error('Erreur lors de la suppression');
    }
  };

  const handleDuplicate = async (contrat: Contrat) => {
    try {
      const { id, created_at, updated_at, created_by, ...dataToClone } = contrat as any;
      await contratService.create({
        ...dataToClone,
        statut: 'BROUILLON',
        version: '1.0',
        parent_id: undefined
      });
      sonnerToast.success('Contrat dupliqué avec succès');
      loadData();
    } catch (error: any) {
      console.error('Error duplicating contrat:', error);
      sonnerToast.error('Erreur lors de la duplication');
    }
  };

  const handleStatusAction = async (id: string, action: 'activer' | 'terminer' | 'annuler') => {
    try {
      switch (action) {
        case 'activer':
          await contratService.activer(id);
          sonnerToast.success('Contrat activé');
          break;
        case 'terminer':
          await contratService.terminer(id);
          sonnerToast.success('Contrat terminé');
          break;
        case 'annuler':
          await contratService.annuler(id);
          sonnerToast.success('Contrat annulé');
          break;
      }
      loadData();
    } catch (error: any) {
      console.error(`Error ${action}:`, error);
      sonnerToast.error(`Erreur lors de l'action`);
    }
  };

  const openViewDialog = (contrat: Contrat) => {
    setSelectedContrat(contrat);
    setIsViewDialogOpen(true);
  };

  const openEditDialog = (contrat: Contrat) => {
    setSelectedContrat(contrat);
    setFormData({
      numero_contrat: contrat.numero_contrat,
      type: contrat.type as ContratType,
      statut: contrat.statut,
      date_debut: contrat.date_debut,
      date_fin: contrat.date_fin || '',
      version: contrat.version,
      prestataire_id: contrat.prestataire_id,
      fournisseur_services_id: contrat.fournisseur_services_id,
      fournisseur_general_id: contrat.fournisseur_general_id,
      client_lie_id: contrat.client_lie_id,
      montant: contrat.montant?.toString() || '',
      description: contrat.description || '',
      piece_jointe_url: contrat.piece_jointe_url || ''
    });
    setIsCreateMode(false);
    setIsEditDialogOpen(true);
  };

  const openCreateDialog = async () => {
    const numero = await generateNumeroContrat();
    setFormData({
      numero_contrat: numero,
      type: 'PRESTATAIRE',
      statut: 'BROUILLON',
      date_debut: '',
      date_fin: '',
      version: '1.0',
      prestataire_id: undefined,
      fournisseur_services_id: undefined,
      fournisseur_general_id: undefined,
      client_lie_id: undefined,
      montant: '',
      description: '',
      piece_jointe_url: ''
    });
    setPieceJointeFile(null);
    setSelectedContrat(null);
    setIsCreateMode(true);
    setIsEditDialogOpen(true);
  };

  const generateNumeroContrat = async () => {
    try {
      const year = new Date().getFullYear();
      const { data, error } = await supabase.rpc('get_next_contract_number', { p_year: year });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur génération numéro:', error);
      const year = new Date().getFullYear();
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `${year}-${random}`;
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      let pieceJointeUrl = formData.piece_jointe_url;

      if (pieceJointeFile) {
        pieceJointeUrl = await uploadFile(pieceJointeFile, 'contrats');
      }

      const dataToSubmit = {
        numero_contrat: formData.numero_contrat,
        type: formData.type,
        statut: formData.statut,
        date_debut: formData.date_debut,
        date_fin: formData.date_fin || undefined,
        version: formData.version,
        montant: formData.montant ? parseFloat(formData.montant) : undefined,
        description: formData.description,
        piece_jointe_url: pieceJointeUrl,
        prestataire_id: (formData.type === 'PRESTATAIRE' || formData.type === 'FOURNISSEUR_SERVICES') ? formData.prestataire_id : undefined,
        fournisseur_services_id: formData.type === 'FOURNISSEUR_SERVICES' ? formData.fournisseur_services_id : undefined,
        fournisseur_general_id: formData.type === 'FOURNISSEUR_GENERAL' ? formData.fournisseur_general_id : undefined,
        client_lie_id: formData.client_lie_id,
      };

      if (isCreateMode) {
        await contratService.create(dataToSubmit);
        sonnerToast.success('Contrat créé avec succès');
      } else if (selectedContrat) {
        if (pieceJointeFile && selectedContrat.piece_jointe_url) {
          await deleteFile(selectedContrat.piece_jointe_url, 'contrats');
        }
        await contratService.update(selectedContrat.id, dataToSubmit);
        sonnerToast.success('Contrat modifié avec succès');
      }

      setIsEditDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      sonnerToast.error('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const getStatutBadgeVariant = (statut: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'BROUILLON': 'outline',
      'ACTIF': 'default',
      'TERMINE': 'secondary',
      'ANNULE': 'destructive',
      'ARCHIVE': 'outline'
    };
    return variants[statut] || 'outline';
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'PRESTATAIRE': 'Prestataire',
      'FOURNISSEUR_SERVICES': 'Fournisseur Services',
      'FOURNISSEUR_GENERAL': 'Fournisseur Général'
    };
    return labels[type] || type;
  };

  const getFournisseurNom = (contrat: Contrat) => {
    if (contrat.type === 'PRESTATAIRE' && contrat.prestataire) {
      return `${contrat.prestataire.prenom} ${contrat.prestataire.nom}`;
    }
    if (contrat.type === 'FOURNISSEUR_SERVICES' && contrat.fournisseur_services) {
      return contrat.fournisseur_services.raison_sociale;
    }
    if (contrat.type === 'FOURNISSEUR_GENERAL' && contrat.fournisseur_general) {
      return contrat.fournisseur_general.raison_sociale;
    }
    return '-';
  };

  const getClientLieNom = (contrat: any) => {
    if (contrat.client_lie?.raison_sociale) {
      return contrat.client_lie.raison_sociale;
    }
    return '-';
  };

  const columns: ColumnDef<Contrat>[] = [
    {
      accessorKey: 'numero_contrat',
      header: 'N° Contrat',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.numero_contrat}</div>
      )
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant="outline">{getTypeLabel(row.original.type)}</Badge>
      )
    },
    {
      id: 'fournisseur',
      header: 'Fournisseur',
      cell: ({ row }) => (
        <div>{getFournisseurNom(row.original)}</div>
      )
    },
    {
      id: 'prestataire_lie',
      header: 'Prestataire',
      cell: ({ row }) => {
        // Show prestataire for FOURNISSEUR_SERVICES contracts
        if (row.original.type === 'FOURNISSEUR_SERVICES' && row.original.prestataire) {
          return <div className="text-sm">{row.original.prestataire.prenom} {row.original.prestataire.nom}</div>;
        }
        return <div className="text-muted-foreground">-</div>;
      }
    },
    {
      id: 'client_lie',
      header: 'Client lié',
      cell: ({ row }) => (
        <div>{getClientLieNom(row.original)}</div>
      )
    },
    {
      accessorKey: 'date_debut',
      header: 'Date début',
      cell: ({ row }) => format(new Date(row.original.date_debut), 'dd/MM/yyyy', { locale: fr })
    },
    {
      accessorKey: 'date_fin',
      header: 'Date fin',
      cell: ({ row }) => row.original.date_fin 
        ? format(new Date(row.original.date_fin), 'dd/MM/yyyy', { locale: fr })
        : '-'
    },
    {
      accessorKey: 'montant',
      header: 'Montant',
      cell: ({ row }) => row.original.montant 
        ? `${row.original.montant.toFixed(2)} €`
        : '-'
    },
    {
      accessorKey: 'statut',
      header: 'Statut',
      cell: ({ row }) => (
        <Badge variant={getStatutBadgeVariant(row.original.statut)}>
          {row.original.statut}
        </Badge>
      )
    },
    {
      accessorKey: 'version',
      header: 'Version',
      cell: ({ row }) => <Badge variant="outline">{row.original.version}</Badge>
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openViewDialog(row.original)}
            title="Voir le contrat"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEditDialog(row.original)}
            title="Modifier le contrat"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDuplicate(row.original)}
            title="Dupliquer le contrat"
          >
            <Copy className="h-4 w-4" />
          </Button>
          {row.original.statut === 'BROUILLON' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleStatusAction(row.original.id, 'activer')}
              title="Activer le contrat"
            >
              <FileCheck className="h-4 w-4 text-green-600" />
            </Button>
          )}
          {row.original.statut === 'ACTIF' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleStatusAction(row.original.id, 'terminer')}
              title="Terminer le contrat"
            >
              <Archive className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(row.original.id)}
            title="Supprimer le contrat"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Contrats Fournisseurs</h1>
          <p className="text-muted-foreground">Gérez vos contrats avec les prestataires et fournisseurs</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau contrat
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={contrats}
        searchPlaceholder="Rechercher un contrat fournisseur..."
      />

      {/* Dialog de création/édition */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreateMode ? 'Nouveau contrat fournisseur' : 'Modifier le contrat'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>N° Contrat</Label>
                <Input value={formData.numero_contrat} disabled className="bg-muted" />
              </div>
              <div>
                <Label>Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as ContratType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESTATAIRE">Prestataire</SelectItem>
                    <SelectItem value="FOURNISSEUR_SERVICES">Fournisseur Services</SelectItem>
                    <SelectItem value="FOURNISSEUR_GENERAL">Fournisseur Général</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sélection du fournisseur selon le type */}
            {formData.type === 'PRESTATAIRE' && (
              <div>
                <Label>Prestataire *</Label>
                <Select
                  value={formData.prestataire_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, prestataire_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un prestataire" />
                  </SelectTrigger>
                  <SelectContent>
                    {prestataires.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.prenom} {p.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.type === 'FOURNISSEUR_SERVICES' && (
              <>
                <div>
                  <Label>Fournisseur de services *</Label>
                  <Select
                    value={formData.fournisseur_services_id || ''}
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      fournisseur_services_id: value,
                      prestataire_id: undefined // Reset prestataire when fournisseur changes
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un fournisseur" />
                    </SelectTrigger>
                    <SelectContent>
                      {fournisseursServices.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.raison_sociale}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Prestataire lié au fournisseur de services */}
                {formData.fournisseur_services_id && (
                  <div>
                    <Label>Prestataire (optionnel)</Label>
                    <Select
                      value={formData.prestataire_id || 'none'}
                      onValueChange={(value) => setFormData({ 
                        ...formData, 
                        prestataire_id: value === 'none' ? undefined : value 
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Aucun prestataire" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun prestataire</SelectItem>
                        {prestataires
                          .filter((p) => p.fournisseur_services_id === formData.fournisseur_services_id)
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.prenom} {p.nom}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {prestataires.filter((p) => p.fournisseur_services_id === formData.fournisseur_services_id).length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Aucun prestataire rattaché à ce fournisseur
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {formData.type === 'FOURNISSEUR_GENERAL' && (
              <div>
                <Label>Fournisseur général *</Label>
                <Select
                  value={formData.fournisseur_general_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, fournisseur_general_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un fournisseur" />
                  </SelectTrigger>
                  <SelectContent>
                    {fournisseursGeneraux.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.raison_sociale}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Client lié */}
            <div>
              <Label>Client lié (optionnel)</Label>
              <Select
                value={formData.client_lie_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, client_lie_id: value === 'none' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucun client lié" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun client lié</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.raisonSociale || c.raison_sociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date début *</Label>
                <Input
                  type="date"
                  value={formData.date_debut}
                  onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                />
              </div>
              <div>
                <Label>Date fin</Label>
                <Input
                  type="date"
                  value={formData.date_fin}
                  onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Montant (€)</Label>
                <Input
                  type="number"
                  value={formData.montant}
                  onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Version</Label>
                <Input value={formData.version} disabled className="bg-muted" />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <FileUploadField
              label="Pièce jointe"
              accept=".pdf,.doc,.docx"
              currentFileUrl={formData.piece_jointe_url}
              onFileSelect={(file) => setPieceJointeFile(file)}
              onFileRemove={() => {
                setPieceJointeFile(null);
                setFormData({ ...formData, piece_jointe_url: '' });
              }}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={loading || isUploading}>
              {isCreateMode ? 'Créer' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de visualisation */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails du contrat</DialogTitle>
          </DialogHeader>

          {selectedContrat && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">N° Contrat</Label>
                  <p className="font-medium">{selectedContrat.numero_contrat}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <Badge variant="outline">{getTypeLabel(selectedContrat.type)}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Fournisseur</Label>
                  <p className="font-medium">{getFournisseurNom(selectedContrat)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Client lié</Label>
                  <p className="font-medium">{getClientLieNom(selectedContrat)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Date début</Label>
                  <p className="font-medium">
                    {selectedContrat.date_debut ? format(new Date(selectedContrat.date_debut), 'dd MMMM yyyy', { locale: fr }) : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date fin</Label>
                  <p className="font-medium">
                    {selectedContrat.date_fin ? format(new Date(selectedContrat.date_fin), 'dd MMMM yyyy', { locale: fr }) : '-'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Montant</Label>
                  <p className="font-medium">
                    {selectedContrat.montant ? `${selectedContrat.montant.toLocaleString('fr-FR')} €` : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Version</Label>
                  <p className="font-medium">{selectedContrat.version}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Statut</Label>
                <Badge variant={getStatutBadgeVariant(selectedContrat.statut)} className="mt-1">
                  {selectedContrat.statut}
                </Badge>
              </div>

              {selectedContrat.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="whitespace-pre-wrap">{selectedContrat.description}</p>
                </div>
              )}

              {selectedContrat.piece_jointe_url && (
                <div>
                  <Button
                    variant="outline"
                    onClick={() => window.open(selectedContrat.piece_jointe_url, '_blank')}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Voir la pièce jointe
                  </Button>
                </div>
              )}
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
