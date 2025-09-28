import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, FileText, Edit, Trash2, Eye, Copy, Download, Calendar, DollarSign, FileCheck, XCircle, Archive } from 'lucide-react';
import { contratService, prestataireService, fournisseurServicesService, fournisseurGeneralService } from '@/services/contratService';
import { clientService } from '@/services';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFileUpload } from '@/hooks/useFileUpload';
import { FileUploadField } from '@/components/FileUploadField';
import { ContratType, ContratStatut } from '@/types/contrat';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function Contrats() {
  const [contrats, setContrats] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedContrat, setSelectedContrat] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAvenant, setIsAvenant] = useState(false);
  const [pieceJointeFile, setPieceJointeFile] = useState<File | null>(null);
  const { uploadFile, deleteFile, isUploading } = useFileUpload();

  // Listes pour les selects
  const [clients, setClients] = useState<any[]>([]);
  const [prestataires, setPrestataires] = useState<any[]>([]);
  const [fournisseursServices, setFournisseursServices] = useState<any[]>([]);
  const [fournisseursGeneraux, setFournisseursGeneraux] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    numero_contrat: '',
    type: 'CLIENT' as ContratType,
    statut: 'BROUILLON' as ContratStatut,
    date_debut: '',
    date_fin: '',
    version: '1.0',
    parent_id: undefined as string | undefined,
    client_id: undefined as string | undefined,
    prestataire_id: undefined as string | undefined,
    fournisseur_services_id: undefined as string | undefined,
    fournisseur_general_id: undefined as string | undefined,
    montant: '',
    description: '',
    piece_jointe_url: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [contratsData, clientsData, prestatairesData, fournisseursServicesData, fournisseursGenerauxData] = await Promise.all([
        contratService.getAll(),
        clientService.getAll(),
        prestataireService.getAll(),
        fournisseurServicesService.getAll(),
        fournisseurGeneralService.getAll()
      ]);
      
      console.log('Données chargées:', {
        contrats: contratsData,
        clients: clientsData,
        prestataires: prestatairesData,
        fournisseursServices: fournisseursServicesData,
        fournisseursGeneraux: fournisseursGenerauxData
      });
      
      setContrats(contratsData);
      setClients(clientsData);
      setPrestataires(prestatairesData);
      setFournisseursServices(fournisseursServicesData);
      setFournisseursGeneraux(fournisseursGenerauxData);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      toast.error('Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  const generateNumeroContrat = async () => {
    try {
      const year = new Date().getFullYear();
      const { data, error } = await supabase.rpc('get_next_contract_number', { p_year: year });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur lors de la génération du numéro:', error);
      // Fallback sur l'ancien système en cas d'erreur
      const year = new Date().getFullYear();
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `${year}-${random}`;
    }
  };

  // Fonction pour afficher un numéro temporaire (non incrémenté)
  const getTemporaryNumeroContrat = () => {
    const year = new Date().getFullYear();
    return `${year}-XXXX`;
  };

  const generateNumeroAvenant = async (parentNumero: string) => {
    try {
      const { data, error } = await supabase.rpc('get_next_avenant_number', { p_parent_numero: parentNumero });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur lors de la génération du numéro d\'avenant:', error);
      // Fallback
      return `${parentNumero}-AV`;
    }
  };

  const handleSubmit = async () => {
    console.log('FormData avant soumission:', formData);
    console.log('Clients disponibles:', clients);
    
    try {
      setLoading(true);
      
      // Générer le numéro de contrat uniquement lors de la soumission
      let finalNumeroContrat = formData.numero_contrat;
      if (!isEditMode && !isAvenant && formData.numero_contrat.includes('XXXX')) {
        finalNumeroContrat = await generateNumeroContrat();
      }
      let pieceJointeUrl = formData.piece_jointe_url;

      // Upload de la pièce jointe si nécessaire
      if (pieceJointeFile) {
        pieceJointeUrl = await uploadFile(pieceJointeFile, 'contrats');
      }

      const dataToSubmit = {
        ...formData,
        numero_contrat: finalNumeroContrat, // Utiliser le numéro généré
        montant: formData.montant ? parseFloat(formData.montant) : undefined,
        piece_jointe_url: pieceJointeUrl,
        date_fin: formData.date_fin || undefined, // Convertir chaîne vide en undefined
        // Nettoyer les IDs non utilisés selon le type
        client_id: formData.type === 'CLIENT' ? formData.client_id : undefined,
        prestataire_id: formData.type === 'PRESTATAIRE' ? formData.prestataire_id : undefined,
        fournisseur_services_id: formData.type === 'FOURNISSEUR_SERVICES' ? formData.fournisseur_services_id : undefined,
        fournisseur_general_id: formData.type === 'FOURNISSEUR_GENERAL' ? formData.fournisseur_general_id : undefined,
      };

      if (isAvenant && selectedContrat) {
        await contratService.createAvenant(selectedContrat.id, dataToSubmit);
        toast.success('Avenant créé avec succès');
      } else if (isEditMode && selectedContrat) {
        // Supprimer l'ancien fichier si un nouveau est uploadé
        if (pieceJointeFile && selectedContrat.piece_jointe_url) {
          await deleteFile(selectedContrat.piece_jointe_url);
        }

        await contratService.update(selectedContrat.id, dataToSubmit);
        toast.success('Contrat modifié avec succès');
      } else {
        await contratService.create(dataToSubmit);
        toast.success('Contrat créé avec succès');
      }

      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce contrat ?')) {
      try {
        await contratService.delete(id);
        toast.success('Contrat supprimé avec succès');
        loadData();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        toast.error('Erreur lors de la suppression');
      }
    }
  };

  const handleDuplicate = async (contrat: any) => {
    const { id, created_at, updated_at, created_by, ...dataToClone } = contrat;
    try {
      // Ne pas générer le numéro tout de suite
      await contratService.create({
        ...dataToClone,
        numero_contrat: await generateNumeroContrat(), // Générer seulement lors de la duplication effective
        statut: 'BROUILLON',
        version: '1.0',
        parent_id: undefined
      });
      toast.success('Contrat dupliqué avec succès');
      loadData();
    } catch (error) {
      console.error('Erreur lors de la duplication:', error);
      toast.error('Erreur lors de la duplication');
    }
  };

  const handleStatusAction = async (id: string, action: 'activer' | 'terminer' | 'annuler') => {
    try {
      switch (action) {
        case 'activer':
          await contratService.activer(id);
          toast.success('Contrat activé');
          break;
        case 'terminer':
          await contratService.terminer(id);
          toast.success('Contrat terminé');
          break;
        case 'annuler':
          await contratService.annuler(id);
          toast.success('Contrat annulé');
          break;
      }
      loadData();
    } catch (error) {
      console.error(`Erreur lors de ${action}:`, error);
      toast.error(`Erreur lors de l'action`);
    }
  };

  const resetForm = async () => {
    // Utiliser un numéro temporaire pour l'affichage
    setFormData({
      numero_contrat: getTemporaryNumeroContrat(),
      type: 'CLIENT',
      statut: 'BROUILLON',
      date_debut: '',
      date_fin: '',
      version: '1.0',
      parent_id: undefined,
      client_id: undefined,
      prestataire_id: undefined,
      fournisseur_services_id: undefined,
      fournisseur_general_id: undefined,
      montant: '',
      description: '',
      piece_jointe_url: ''
    });
    setPieceJointeFile(null);
    setSelectedContrat(null);
    setIsEditMode(false);
    setIsAvenant(false);
  };

  const openEditDialog = (contrat: any) => {
    setSelectedContrat(contrat);
    setFormData({
      numero_contrat: contrat.numero_contrat,
      type: contrat.type,
      statut: contrat.statut,
      date_debut: contrat.date_debut,
      date_fin: contrat.date_fin || '',
      version: contrat.version,
      parent_id: contrat.parent_id,
      client_id: contrat.client_id,
      prestataire_id: contrat.prestataire_id,
      fournisseur_services_id: contrat.fournisseur_services_id,
      fournisseur_general_id: contrat.fournisseur_general_id,
      montant: contrat.montant?.toString() || '',
      description: contrat.description || '',
      piece_jointe_url: contrat.piece_jointe_url || ''
    });
    setIsEditMode(true);
    setIsAvenant(false);
    setIsDialogOpen(true);
  };

  const openAvenantDialog = async (contrat: any) => {
    setSelectedContrat(contrat);
    const avenantNumero = await generateNumeroAvenant(contrat.numero_contrat);
    setFormData({
      ...formData,
      numero_contrat: avenantNumero,
      type: contrat.type,
      date_debut: contrat.date_debut,
      client_id: contrat.client_id,
      prestataire_id: contrat.prestataire_id,
      fournisseur_services_id: contrat.fournisseur_services_id,
      fournisseur_general_id: contrat.fournisseur_general_id,
      description: `Avenant au contrat ${contrat.numero_contrat}`,
    });
    setIsEditMode(false);
    setIsAvenant(true);
    setIsDialogOpen(true);
  };

  const openViewDialog = (contrat: any) => {
    setSelectedContrat(contrat);
    setIsViewDialogOpen(true);
  };

  const getStatutBadgeVariant = (statut: ContratStatut) => {
    switch (statut) {
      case 'BROUILLON': return 'outline';
      case 'ACTIF': return 'default';
      case 'TERMINE': return 'secondary';
      case 'ANNULE': return 'destructive';
      case 'ARCHIVE': return 'outline';
      default: return 'outline';
    }
  };

  const getTypeLabel = (type: ContratType) => {
    switch (type) {
      case 'CLIENT': return 'Client';
      case 'PRESTATAIRE': return 'Prestataire';
      case 'FOURNISSEUR_SERVICES': return 'Fournisseur de services';
      case 'FOURNISSEUR_GENERAL': return 'Fournisseur général';
      default: return type;
    }
  };

  const getContratParty = (contrat: any) => {
    switch (contrat.type) {
      case 'CLIENT':
        return contrat.client?.raison_sociale || '-';
      case 'PRESTATAIRE':
        return contrat.prestataire ? `${contrat.prestataire.nom} ${contrat.prestataire.prenom}` : '-';
      case 'FOURNISSEUR_SERVICES':
        return contrat.fournisseur_services?.raison_sociale || '-';
      case 'FOURNISSEUR_GENERAL':
        return contrat.fournisseur_general?.raison_sociale || '-';
      default:
        return '-';
    }
  };

  const filteredContrats = contrats.filter(contrat =>
    `${contrat.numero_contrat} ${contrat.description || ''} ${getContratParty(contrat)}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Contrats</h1>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Contrat
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Rechercher un contrat..."
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
                  <TableHead>N° Contrat</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Partie</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Date début</TableHead>
                  <TableHead>Date fin</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : filteredContrats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      Aucun contrat trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContrats.map((contrat) => (
                    <TableRow key={contrat.id}>
                      <TableCell className="font-medium">{contrat.numero_contrat}</TableCell>
                      <TableCell>{getTypeLabel(contrat.type)}</TableCell>
                      <TableCell>{getContratParty(contrat)}</TableCell>
                      <TableCell>
                        {contrat.montant ? `${contrat.montant.toLocaleString('fr-FR')} €` : '-'}
                      </TableCell>
                      <TableCell>
                        {contrat.date_debut ? format(new Date(contrat.date_debut), 'dd/MM/yyyy', { locale: fr }) : '-'}
                      </TableCell>
                      <TableCell>
                        {contrat.date_fin ? format(new Date(contrat.date_fin), 'dd/MM/yyyy', { locale: fr }) : '-'}
                      </TableCell>
                      <TableCell>{contrat.version}</TableCell>
                      <TableCell>
                        <Badge variant={getStatutBadgeVariant(contrat.statut)}>
                          {contrat.statut}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider>
                          <div className="flex justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openViewDialog(contrat)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Voir les détails</p>
                              </TooltipContent>
                            </Tooltip>
                            
                            {contrat.statut === 'BROUILLON' && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openEditDialog(contrat)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Modifier le contrat</p>
                                  </TooltipContent>
                                </Tooltip>
                                
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleStatusAction(contrat.id, 'activer')}
                                    >
                                      <FileCheck className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Activer le contrat</p>
                                  </TooltipContent>
                                </Tooltip>
                              </>
                            )}
                            
                            {contrat.statut === 'ACTIF' && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openAvenantDialog(contrat)}
                                    >
                                      <Archive className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Créer un avenant</p>
                                  </TooltipContent>
                                </Tooltip>
                                
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleStatusAction(contrat.id, 'terminer')}
                                    >
                                      <FileCheck className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Terminer le contrat</p>
                                  </TooltipContent>
                                </Tooltip>
                                
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleStatusAction(contrat.id, 'annuler')}
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Annuler le contrat</p>
                                  </TooltipContent>
                                </Tooltip>
                              </>
                            )}
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDuplicate(contrat)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Dupliquer le contrat</p>
                              </TooltipContent>
                            </Tooltip>
                            
                            {contrat.piece_jointe_url && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => window.open(contrat.piece_jointe_url, '_blank')}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Télécharger la pièce jointe</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            
                            {contrat.statut === 'BROUILLON' && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDelete(contrat.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Supprimer le contrat</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TooltipProvider>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isAvenant ? 'Créer un avenant' : isEditMode ? 'Modifier le contrat' : 'Nouveau contrat'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="numero_contrat">N° Contrat *</Label>
                <Input
                  id="numero_contrat"
                  value={formData.numero_contrat}
                  onChange={(e) => setFormData({ ...formData, numero_contrat: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="type">Type *</Label>
                <Select 
                  value={formData.type}
                  onValueChange={(value: ContratType) => setFormData({ ...formData, type: value })}
                  disabled={isEditMode || isAvenant}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLIENT">Client</SelectItem>
                    <SelectItem value="PRESTATAIRE">Prestataire</SelectItem>
                    <SelectItem value="FOURNISSEUR_SERVICES">Fournisseur de services</SelectItem>
                    <SelectItem value="FOURNISSEUR_GENERAL">Fournisseur général</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sélection de la partie selon le type */}
            {formData.type === 'CLIENT' && (
              <div>
                <Label>Client *</Label>
                <Select 
                  value={formData.client_id || ''}
                  onValueChange={(value) => {
                    console.log('Client sélectionné:', value);
                    console.log('Clients disponibles:', clients);
                    setFormData({ ...formData, client_id: value });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.length === 0 ? (
                      <SelectItem value="no-clients" disabled>
                        Aucun client disponible
                      </SelectItem>
                    ) : (
                      clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.raisonSociale || client.raison_sociale}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

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
                    {prestataires.map(prestataire => (
                      <SelectItem key={prestataire.id} value={prestataire.id}>
                        {prestataire.nom} {prestataire.prenom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.type === 'FOURNISSEUR_SERVICES' && (
              <div>
                <Label>Fournisseur de services *</Label>
                <Select 
                  value={formData.fournisseur_services_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, fournisseur_services_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un fournisseur de services" />
                  </SelectTrigger>
                  <SelectContent>
                    {fournisseursServices.map(fournisseur => (
                      <SelectItem key={fournisseur.id} value={fournisseur.id}>
                        {fournisseur.raisonSociale || fournisseur.raison_sociale}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.type === 'FOURNISSEUR_GENERAL' && (
              <div>
                <Label>Fournisseur général *</Label>
                <Select 
                  value={formData.fournisseur_general_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, fournisseur_general_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un fournisseur général" />
                  </SelectTrigger>
                  <SelectContent>
                    {fournisseursGeneraux.map(fournisseur => (
                      <SelectItem key={fournisseur.id} value={fournisseur.id}>
                        {fournisseur.raisonSociale || fournisseur.raison_sociale}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date_debut">Date début *</Label>
                <Input
                  id="date_debut"
                  type="date"
                  value={formData.date_debut}
                  onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="date_fin">Date fin</Label>
                <Input
                  id="date_fin"
                  type="date"
                  value={formData.date_fin}
                  onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="montant">Montant (€)</Label>
                <Input
                  id="montant"
                  type="number"
                  step="0.01"
                  value={formData.montant}
                  onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="statut">Statut</Label>
                <Select 
                  value={formData.statut}
                  onValueChange={(value: ContratStatut) => setFormData({ ...formData, statut: value })}
                  disabled={isAvenant}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BROUILLON">Brouillon</SelectItem>
                    <SelectItem value="ACTIF">Actif</SelectItem>
                    <SelectItem value="TERMINE">Terminé</SelectItem>
                    <SelectItem value="ANNULE">Annulé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />
            </div>

            <FileUploadField
              label="Pièce jointe"
              accept=".pdf,.doc,.docx"
              currentFileUrl={formData.piece_jointe_url}
              onFileSelect={setPieceJointeFile}
              onFileRemove={() => {
                setPieceJointeFile(null);
                setFormData({ ...formData, piece_jointe_url: '' });
              }}
              disabled={isUploading}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || isUploading || !formData.numero_contrat || !formData.date_debut}
            >
              {isAvenant ? 'Créer l\'avenant' : isEditMode ? 'Modifier' : 'Créer'}
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
                  <p className="font-medium">{getTypeLabel(selectedContrat.type)}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Partie contractante</Label>
                <p className="font-medium">{getContratParty(selectedContrat)}</p>
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

              {selectedContrat.parent_id && (
                <div>
                  <Label className="text-muted-foreground">Contrat parent</Label>
                  <p className="text-sm text-muted-foreground">
                    Ce contrat est un avenant
                  </p>
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