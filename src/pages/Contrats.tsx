import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FileText, Edit, Trash2, Eye, Copy, Download, FileCheck, XCircle, Archive } from 'lucide-react';
import { contratService, prestataireService, fournisseurServicesService, fournisseurGeneralService } from '@/services/contratService';
import { clientService } from '@/services';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFileUpload } from '@/hooks/useFileUpload';
import { FileUploadField } from '@/components/FileUploadField';
import { ContratType, ContratStatut, ReferenceClientLigne } from '@/types/contrat';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';

export default function Contrats() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [contrats, setContrats] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatuts, setSelectedStatuts] = useState<ContratStatut[]>(['BROUILLON', 'ACTIF']);
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
  const [tvaList, setTvaList] = useState<any[]>([]);

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
    client_lie_id: undefined as string | undefined,
    montant: '',
    description: '',
    piece_jointe_url: '',
    reference_client: [] as ReferenceClientLigne[],
    tva_id: 'e8357902-a99c-4c97-b0c5-aea42059f735' as string | undefined,
  });

  useEffect(() => {
    loadData();
  }, []);

  // Gérer les paramètres d'URL pour édition/visualisation/création
  useEffect(() => {
    const editId = searchParams.get('edit');
    const viewId = searchParams.get('view');
    const isNew = searchParams.get('new');
    
    if (isNew === 'true') {
      // Ouvrir le dialog de création
      resetForm();
      setIsDialogOpen(true);
      // Nettoyer l'URL
      setSearchParams({});
    } else if ((editId || viewId) && contrats.length > 0) {
      const contratId = editId || viewId;
      const contrat = contrats.find(c => c.id === contratId);
      
      if (contrat) {
        if (editId) {
          openEditDialog(contrat);
        } else if (viewId) {
          openViewDialog(contrat);
        }
        // Nettoyer l'URL après avoir ouvert le dialog
        setSearchParams({});
      }
    }
  }, [searchParams, contrats]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Charger les contrats avec une requête simplifiée
      const { data: contratsData, error: contratsError } = await supabase
        .from('contrats')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (contratsError) throw contratsError;

      // Charger les autres données séparément pour les selects
      const [clientsData, prestatairesData, tvaData] = await Promise.all([
        clientService.getAll(),
        prestataireService.getAll(),
        supabase.from('tva').select('*').order('taux').then(r => r.data || []),
      ]);
      
      // Charger les fournisseurs avec gestion d'erreur
      let fournisseursServicesData: any[] = [];
      let fournisseursGenerauxData: any[] = [];
      
      try {
        const { data: fsData } = await supabase
          .from('fournisseurs_services')
          .select('*');
        fournisseursServicesData = fsData || [];
      } catch (error) {
        console.log('Erreur chargement fournisseurs_services:', error);
      }
      
      try {
        const { data: fgData } = await supabase
          .from('fournisseurs_generaux')
          .select('*');
        fournisseursGenerauxData = fgData || [];
      } catch (error) {
        console.log('Erreur chargement fournisseurs_generaux:', error);
      }
      
      // Pour chaque contrat, charger manuellement les relations nécessaires
      const contratsWithRelations = await Promise.all((contratsData || []).map(async (contrat) => {
        let relationData = {};
        
        if (contrat.client_id) {
          const client = clientsData.find(c => c.id === contrat.client_id);
          relationData = { ...relationData, client };
        }
        
        if (contrat.prestataire_id) {
          const prestataire = prestatairesData.find(p => p.id === contrat.prestataire_id);
          relationData = { ...relationData, prestataire };
        }
        
        if (contrat.fournisseur_services_id) {
          const fournisseur_services = fournisseursServicesData.find(f => f.id === contrat.fournisseur_services_id);
          relationData = { ...relationData, fournisseur_services };
        }
        
        if (contrat.fournisseur_general_id) {
          const fournisseur_general = fournisseursGenerauxData.find(f => f.id === contrat.fournisseur_general_id);
          relationData = { ...relationData, fournisseur_general };
        }

        // Client lié pour les contrats fournisseurs
        if (contrat.client_lie_id) {
          const client_lie = clientsData.find(c => c.id === contrat.client_lie_id);
          relationData = { ...relationData, client_lie };
        }
        
        return { ...contrat, ...relationData };
      }));
      
      console.log('Données chargées:', {
        contrats: contratsWithRelations,
        clients: clientsData,
        prestataires: prestatairesData,
        fournisseursServices: fournisseursServicesData,
        fournisseursGeneraux: fournisseursGenerauxData
      });
      
      setContrats(contratsWithRelations);
      setClients(clientsData);
      setPrestataires(prestatairesData);
      setFournisseursServices(fournisseursServicesData);
      setFournisseursGeneraux(fournisseursGenerauxData);
      setTvaList(tvaData);
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
        // Client lié pour les contrats fournisseurs
        client_lie_id: formData.type !== 'CLIENT' ? formData.client_lie_id : undefined,
        // Référence client uniquement pour les contrats clients (jsonb)
        reference_client: formData.type === 'CLIENT' && formData.reference_client.length > 0 
          ? formData.reference_client 
          : undefined,
      };

      if (isAvenant && selectedContrat) {
        await contratService.createAvenant(selectedContrat.id, dataToSubmit);
        toast.success('Avenant créé avec succès');
      } else if (isEditMode && selectedContrat) {
        // Supprimer l'ancien fichier si un nouveau est uploadé
        if (pieceJointeFile && selectedContrat.piece_jointe_url) {
          await deleteFile(selectedContrat.piece_jointe_url, 'contrats');
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

  const handleDownloadContrat = async (filePath: string) => {
    try {
      // Générer une URL signée valide 1 heure
      const { data, error } = await supabase.storage
        .from('contrats')
        .createSignedUrl(filePath, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      toast.error('Erreur lors du téléchargement du fichier');
    }
  };

  const resetForm = async () => {
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
      client_lie_id: undefined,
      montant: '',
      description: '',
      piece_jointe_url: '',
      reference_client: [],
      tva_id: 'e8357902-a99c-4c97-b0c5-aea42059f735',
    });
    setPieceJointeFile(null);
    setSelectedContrat(null);
    setIsEditMode(false);
    setIsAvenant(false);
  };

  const openEditDialog = (contrat: any) => {
    setSelectedContrat(contrat);
    // Parse reference_client from jsonb
    let refClient: ReferenceClientLigne[] = [];
    if (contrat.reference_client) {
      if (Array.isArray(contrat.reference_client)) {
        refClient = contrat.reference_client;
      } else if (typeof contrat.reference_client === 'string') {
        refClient = [{ reference: contrat.reference_client, montant: contrat.montant || 0 }];
      }
    }
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
      client_lie_id: contrat.client_lie_id,
      montant: contrat.montant?.toString() || '',
      description: contrat.description || '',
      piece_jointe_url: contrat.piece_jointe_url || '',
      reference_client: refClient,
      tva_id: contrat.tva_id || 'e8357902-a99c-4c97-b0c5-aea42059f735',
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
      client_lie_id: contrat.client_lie_id,
      tva_id: contrat.tva_id || 'e8357902-a99c-4c97-b0c5-aea42059f735',
      description: `Avenant au contrat ${contrat.numero_contrat}`,
    });
    setIsEditMode(false);
    setIsAvenant(true);
    setIsDialogOpen(true);
  };

  const openViewDialog = (contrat: any) => {
    // S'assurer que les relations sont chargées
    const contratWithRelations = contrats.find(c => c.id === contrat.id) || contrat;
    console.log('Contrat pour visualisation:', contratWithRelations);
    console.log('Client du contrat:', contratWithRelations.client);
    setSelectedContrat(contratWithRelations);
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
        return contrat.client?.raisonSociale || contrat.client?.raison_sociale || '-';
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
    selectedStatuts.includes(contrat.statut) &&
    `${contrat.numero_contrat} ${contrat.description || ''} ${getContratParty(contrat)}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "numero_contrat",
      header: "N° Contrat",
      cell: ({ row }) => <span className="font-medium">{row.original.numero_contrat}</span>,
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => getTypeLabel(row.original.type),
    },
    {
      id: "partie",
      header: "Partie",
      cell: ({ row }) => getContratParty(row.original),
    },
    {
      accessorKey: "montant",
      header: "Montant",
      cell: ({ row }) =>
        row.original.montant ? `${row.original.montant.toLocaleString('fr-FR')} €` : '-',
    },
    {
      accessorKey: "date_debut",
      header: "Date début",
      cell: ({ row }) =>
        row.original.date_debut
          ? format(new Date(row.original.date_debut), 'dd/MM/yyyy', { locale: fr })
          : '-',
    },
    {
      accessorKey: "date_fin",
      header: "Date fin",
      cell: ({ row }) =>
        row.original.date_fin
          ? format(new Date(row.original.date_fin), 'dd/MM/yyyy', { locale: fr })
          : '-',
    },
    {
      accessorKey: "version",
      header: "Version",
    },
    {
      accessorKey: "statut",
      header: "Statut",
      cell: ({ row }) => (
        <Badge variant={getStatutBadgeVariant(row.original.statut)}>
          {row.original.statut}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      meta: { className: "min-w-[220px]" },
      cell: ({ row }) => {
        const contrat = row.original;
        return (
          <TooltipProvider>
            <div className="flex justify-end gap-1 flex-nowrap !overflow-visible">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openViewDialog(contrat); }}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Voir les détails</p></TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditDialog(contrat); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Modifier le contrat</p></TooltipContent>
              </Tooltip>
              
              {contrat.statut === 'BROUILLON' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={() => handleStatusAction(contrat.id, 'activer')}>
                      <FileCheck className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Activer le contrat</p></TooltipContent>
                </Tooltip>
              )}
              
              {contrat.statut === 'ACTIF' && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="ghost" onClick={() => openAvenantDialog(contrat)}>
                        <Archive className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Créer un avenant</p></TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="ghost" onClick={() => handleStatusAction(contrat.id, 'terminer')}>
                        <FileCheck className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Terminer le contrat</p></TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="ghost" onClick={() => handleStatusAction(contrat.id, 'annuler')}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Annuler le contrat</p></TooltipContent>
                  </Tooltip>
                </>
              )}
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" onClick={() => handleDuplicate(contrat)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Dupliquer le contrat</p></TooltipContent>
              </Tooltip>
              
              {contrat.piece_jointe_url && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={() => handleDownloadContrat(contrat.piece_jointe_url)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Télécharger la pièce jointe</p></TooltipContent>
                </Tooltip>
              )}
              
              {contrat.statut === 'BROUILLON' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(contrat.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Supprimer le contrat</p></TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        );
      },
    },
  ];

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
          <div className="mb-4 space-y-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Filtrer par statut:</Label>
              <div className="flex flex-wrap gap-2">
                {(['BROUILLON', 'ACTIF', 'TERMINE', 'ANNULE', 'ARCHIVE'] as ContratStatut[]).map((statut) => (
                  <Button
                    key={statut}
                    variant={selectedStatuts.includes(statut) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      if (selectedStatuts.includes(statut)) {
                        if (selectedStatuts.length > 1) {
                          setSelectedStatuts(selectedStatuts.filter(s => s !== statut));
                        }
                      } else {
                        setSelectedStatuts([...selectedStatuts, statut]);
                      }
                    }}
                  >
                    {statut}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedStatuts(['BROUILLON', 'ACTIF', 'TERMINE', 'ANNULE', 'ARCHIVE'])}
                >
                  Tous
                </Button>
              </div>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={filteredContrats}
            searchPlaceholder="Rechercher un contrat..."
          />
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
              <>
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
                <div>
                  <Label>Références Client</Label>
                  <div className="space-y-2">
                    {formData.reference_client.map((ref, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={ref.reference}
                          onChange={(e) => {
                            const updated = [...formData.reference_client];
                            updated[idx] = { ...updated[idx], reference: e.target.value };
                            setFormData({ ...formData, reference_client: updated });
                          }}
                          placeholder="Ex: BDC PO150827 B SIRA Accompagnement RH"
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          value={ref.montant}
                          onChange={(e) => {
                            const updated = [...formData.reference_client];
                            updated[idx] = { ...updated[idx], montant: parseFloat(e.target.value) || 0 };
                            setFormData({ ...formData, reference_client: updated });
                          }}
                          placeholder="Montant"
                          className="w-32"
                        />
                        <span className="text-sm text-muted-foreground">€</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const updated = formData.reference_client.filter((_, i) => i !== idx);
                            setFormData({ ...formData, reference_client: updated });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          reference_client: [...formData.reference_client, { reference: '', montant: 0 }]
                        });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter une référence
                    </Button>
                  </div>
                </div>
              </>
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

            {/* Sélection du client lié pour les contrats fournisseurs */}
            {(formData.type === 'PRESTATAIRE' || formData.type === 'FOURNISSEUR_SERVICES' || formData.type === 'FOURNISSEUR_GENERAL') && (
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
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.raisonSociale || client.raison_sociale}
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

            <div className="grid grid-cols-3 gap-4">
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
                <Label htmlFor="tva_id">TVA</Label>
                <Select 
                  value={formData.tva_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, tva_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner la TVA" />
                  </SelectTrigger>
                  <SelectContent>
                    {tvaList.map(tva => (
                      <SelectItem key={tva.id} value={tva.id}>
                        {tva.libelle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Label className="text-muted-foreground">
                  {selectedContrat.type === 'CLIENT' ? 'Client' : 'Fournisseur'}
                </Label>
                <p className="font-medium">
                  {selectedContrat.type === 'CLIENT' && selectedContrat.client
                    ? selectedContrat.client.raisonSociale || selectedContrat.client.raison_sociale
                    : selectedContrat.type === 'PRESTATAIRE' && selectedContrat.prestataire
                    ? `${selectedContrat.prestataire.nom} ${selectedContrat.prestataire.prenom}`
                    : selectedContrat.type === 'FOURNISSEUR_SERVICES' && selectedContrat.fournisseur_services
                    ? selectedContrat.fournisseur_services.raisonSociale || selectedContrat.fournisseur_services.raison_sociale
                    : selectedContrat.type === 'FOURNISSEUR_GENERAL' && selectedContrat.fournisseur_general
                    ? selectedContrat.fournisseur_general.raisonSociale || selectedContrat.fournisseur_general.raison_sociale
                    : 'Non renseigné'}
                </p>
              </div>

              {/* Référence client - uniquement pour les contrats clients */}
              {selectedContrat.type === 'CLIENT' && selectedContrat.reference_client && Array.isArray(selectedContrat.reference_client) && selectedContrat.reference_client.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Références Client</Label>
                  <div className="space-y-1 mt-1">
                    {selectedContrat.reference_client.map((ref: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-2 border rounded">
                        <span className="font-medium">{ref.reference}</span>
                        <span className="text-muted-foreground">{ref.montant?.toLocaleString('fr-FR')} €</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Client lié - affiché uniquement pour les contrats fournisseurs */}
              {selectedContrat.type !== 'CLIENT' && (
                <div>
                  <Label className="text-muted-foreground">Client lié</Label>
                  <p className="font-medium">
                    {selectedContrat.client_lie?.raison_sociale || selectedContrat.client_lie?.raisonSociale || 'Aucun'}
                  </p>
                </div>
              )}

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

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">Montant</Label>
                  <p className="font-medium">
                    {selectedContrat.montant ? `${selectedContrat.montant.toLocaleString('fr-FR')} €` : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">TVA</Label>
                  <p className="font-medium">
                    {tvaList.find(t => t.id === selectedContrat.tva_id)?.libelle || '-'}
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
                    onClick={() => handleDownloadContrat(selectedContrat.piece_jointe_url)}
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