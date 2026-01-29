import { useState, useEffect } from 'react';
import { Contrat, ContratStatut } from '@/types/contrat';
import { Salarie } from '@/types/salarie';
import { contratService } from '@/services/contratService';
import { salarieService } from '@/services/salarieService';
import { clientService } from '@/services';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Eye, Copy, FileCheck, Archive, Link2, Unlink } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DeclarationCharge {
  id: string;
  nom: string;
  organisme: string;
  type_charge: string;
  montant_estime: number | null;
}

export default function ContratsSalaries() {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<Salarie[]>([]);
  const [declarationsCharges, setDeclarationsCharges] = useState<DeclarationCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContrat, setSelectedContrat] = useState<Contrat | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isChargesDialogOpen, setIsChargesDialogOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [pieceJointeFile, setPieceJointeFile] = useState<File | null>(null);
  const [linkedCharges, setLinkedCharges] = useState<string[]>([]);
  const [selectedCharges, setSelectedCharges] = useState<string[]>([]);
  const { uploadFile, deleteFile, isUploading } = useFileUpload();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    numero_contrat: '',
    statut: 'BROUILLON' as ContratStatut,
    date_debut: '',
    date_fin: '',
    version: '1.0',
    salarie_id: undefined as string | undefined,
    client_id: undefined as string | undefined,
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
      
      const [contratsData, clientsData, salariesData] = await Promise.all([
        contratService.getAll(),
        clientService.getAll(),
        salarieService.getAll()
      ]);

      // Charger les déclarations de charges sociales
      const { data: chargesData } = await supabase
        .from('declarations_charges_sociales')
        .select('id, nom, organisme, type_charge, montant_estime')
        .eq('actif', true)
        .order('nom');

      // Filtrer les contrats salariés
      const contratsSalaries = contratsData.filter(c => c.type === 'SALARIE');

      setContrats(contratsSalaries);
      setClients(clientsData);
      setSalaries(salariesData);
      setDeclarationsCharges(chargesData || []);
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

  const loadLinkedCharges = async (contratId: string) => {
    try {
      const { data, error } = await supabase
        .from('contrats_charges_sociales')
        .select('declaration_charge_id')
        .eq('contrat_id', contratId);

      if (error) throw error;
      return (data || []).map(item => item.declaration_charge_id);
    } catch (error) {
      console.error('Error loading linked charges:', error);
      return [];
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

  const openViewDialog = async (contrat: Contrat) => {
    setSelectedContrat(contrat);
    const charges = await loadLinkedCharges(contrat.id);
    setLinkedCharges(charges);
    setIsViewDialogOpen(true);
  };

  const openEditDialog = async (contrat: Contrat) => {
    setSelectedContrat(contrat);
    setFormData({
      numero_contrat: contrat.numero_contrat,
      statut: contrat.statut,
      date_debut: contrat.date_debut,
      date_fin: contrat.date_fin || '',
      version: contrat.version,
      salarie_id: (contrat as any).salarie_id,
      client_id: contrat.client_id,
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
      statut: 'BROUILLON',
      date_debut: '',
      date_fin: '',
      version: '1.0',
      salarie_id: undefined,
      client_id: undefined,
      montant: '',
      description: '',
      piece_jointe_url: ''
    });
    setPieceJointeFile(null);
    setSelectedContrat(null);
    setIsCreateMode(true);
    setIsEditDialogOpen(true);
  };

  const openChargesDialog = async (contrat: Contrat) => {
    setSelectedContrat(contrat);
    const charges = await loadLinkedCharges(contrat.id);
    setSelectedCharges(charges);
    setIsChargesDialogOpen(true);
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
        type: 'SALARIE' as const,
        statut: formData.statut,
        date_debut: formData.date_debut,
        date_fin: formData.date_fin || undefined,
        version: formData.version,
        montant: formData.montant ? parseFloat(formData.montant) : undefined,
        description: formData.description,
        piece_jointe_url: pieceJointeUrl,
        salarie_id: formData.salarie_id,
        client_id: formData.client_id,
      };

      if (isCreateMode) {
        await contratService.create(dataToSubmit);
        sonnerToast.success('Contrat salarié créé avec succès');
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

  const handleSaveCharges = async () => {
    if (!selectedContrat) return;

    try {
      setLoading(true);

      // Supprimer les liaisons existantes
      await supabase
        .from('contrats_charges_sociales')
        .delete()
        .eq('contrat_id', selectedContrat.id);

      // Ajouter les nouvelles liaisons
      if (selectedCharges.length > 0) {
        const insertData = selectedCharges.map(chargeId => ({
          contrat_id: selectedContrat.id,
          declaration_charge_id: chargeId
        }));

        const { error } = await supabase
          .from('contrats_charges_sociales')
          .insert(insertData);

        if (error) throw error;
      }

      sonnerToast.success('Charges sociales liées avec succès');
      setIsChargesDialogOpen(false);
    } catch (error) {
      console.error('Erreur liaison charges:', error);
      sonnerToast.error('Erreur lors de la liaison des charges');
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

  const getSalarieNom = (contrat: any) => {
    // Le salarié peut être dans contrat.salarie ou via salarie_id
    if (contrat.salarie) {
      return `${contrat.salarie.prenom} ${contrat.salarie.nom}`;
    }
    const salarie = salaries.find(s => s.id === contrat.salarie_id);
    return salarie ? `${salarie.prenom} ${salarie.nom}` : '-';
  };

  const getClientNom = (contrat: any) => {
    if (contrat.client?.raison_sociale) {
      return contrat.client.raison_sociale;
    }
    const client = clients.find(c => c.id === contrat.client_id);
    return client?.raison_sociale || client?.raisonSociale || '-';
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
      id: 'salarie',
      header: 'Salarié',
      cell: ({ row }) => (
        <div>{getSalarieNom(row.original)}</div>
      )
    },
    {
      id: 'client',
      header: 'Client lié',
      cell: ({ row }) => (
        <div>{getClientNom(row.original)}</div>
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
            onClick={() => openChargesDialog(row.original)}
            title="Lier des charges sociales"
          >
            <Link2 className="h-4 w-4" />
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
          <h1 className="text-3xl font-bold">Contrats Salariés</h1>
          <p className="text-muted-foreground">Gérez vos contrats avec les salariés et leurs charges sociales associées</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau contrat salarié
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={contrats}
        searchPlaceholder="Rechercher un contrat salarié..."
      />

      {/* Dialog de création/édition */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreateMode ? 'Nouveau contrat salarié' : 'Modifier le contrat'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>N° Contrat</Label>
                <Input value={formData.numero_contrat} disabled className="bg-muted" />
              </div>
              <div>
                <Label>Statut</Label>
                <Select
                  value={formData.statut}
                  onValueChange={(value) => setFormData({ ...formData, statut: value as ContratStatut })}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Salarié *</Label>
                <Select
                  value={formData.salarie_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, salarie_id: value })}
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
              <div>
                <Label>Client lié</Label>
                <Select
                  value={formData.client_id || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, client_id: value === 'none' ? undefined : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.raison_sociale || client.raisonSociale}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date de début *</Label>
                <Input
                  type="date"
                  value={formData.date_debut}
                  onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                />
              </div>
              <div>
                <Label>Date de fin</Label>
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
                  step="0.01"
                  value={formData.montant}
                  onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                  placeholder="Montant du contrat"
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
                placeholder="Description du contrat..."
                rows={3}
              />
            </div>

            <div>
              <FileUploadField
                currentFileUrl={formData.piece_jointe_url}
                onFileSelect={setPieceJointeFile}
                accept=".pdf,.doc,.docx"
                label="Pièce jointe"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={loading || isUploading || !formData.salarie_id || !formData.date_debut}>
              {isCreateMode ? 'Créer' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de visualisation */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails du contrat {selectedContrat?.numero_contrat}</DialogTitle>
          </DialogHeader>

          {selectedContrat && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">N° Contrat</Label>
                  <p className="font-medium">{selectedContrat.numero_contrat}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Statut</Label>
                  <Badge variant={getStatutBadgeVariant(selectedContrat.statut)}>
                    {selectedContrat.statut}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Salarié</Label>
                  <p className="font-medium">{getSalarieNom(selectedContrat)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Client lié</Label>
                  <p className="font-medium">{getClientNom(selectedContrat)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Date de début</Label>
                  <p className="font-medium">
                    {format(new Date(selectedContrat.date_debut), 'dd/MM/yyyy', { locale: fr })}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date de fin</Label>
                  <p className="font-medium">
                    {selectedContrat.date_fin 
                      ? format(new Date(selectedContrat.date_fin), 'dd/MM/yyyy', { locale: fr })
                      : '-'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Montant</Label>
                  <p className="font-medium">
                    {selectedContrat.montant ? `${selectedContrat.montant.toFixed(2)} €` : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Version</Label>
                  <p className="font-medium">{selectedContrat.version}</p>
                </div>
              </div>

              {selectedContrat.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="font-medium whitespace-pre-wrap">{selectedContrat.description}</p>
                </div>
              )}

              {/* Charges sociales liées */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Charges sociales liées</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {linkedCharges.length > 0 ? (
                    <ul className="space-y-2">
                      {linkedCharges.map(chargeId => {
                        const charge = declarationsCharges.find(c => c.id === chargeId);
                        return charge ? (
                          <li key={charge.id} className="flex justify-between items-center text-sm">
                            <span>{charge.nom} ({charge.organisme})</span>
                            <Badge variant="outline">{charge.type_charge}</Badge>
                          </li>
                        ) : null;
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune charge sociale liée</p>
                  )}
                </CardContent>
              </Card>

              {selectedContrat.piece_jointe_url && (
                <div>
                  <Label className="text-muted-foreground">Pièce jointe</Label>
                  <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => window.open(selectedContrat.piece_jointe_url, '_blank')}
                  >
                    Télécharger le document
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de liaison des charges sociales */}
      <Dialog open={isChargesDialogOpen} onOpenChange={setIsChargesDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lier des charges sociales</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sélectionnez les charges sociales à lier à ce contrat salarié. Ces charges seront utilisées pour le calcul des marges par client.
            </p>

            <div className="space-y-2 max-h-80 overflow-y-auto border rounded-lg p-3">
              {declarationsCharges.length > 0 ? (
                declarationsCharges.map((charge) => (
                  <div key={charge.id} className="flex items-center space-x-3 p-2 hover:bg-muted rounded">
                    <Checkbox
                      id={charge.id}
                      checked={selectedCharges.includes(charge.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCharges([...selectedCharges, charge.id]);
                        } else {
                          setSelectedCharges(selectedCharges.filter(id => id !== charge.id));
                        }
                      }}
                    />
                    <label htmlFor={charge.id} className="flex-1 cursor-pointer">
                      <div className="font-medium text-sm">{charge.nom}</div>
                      <div className="text-xs text-muted-foreground">
                        {charge.organisme} • {charge.type_charge}
                        {charge.montant_estime && ` • ${charge.montant_estime.toFixed(2)} €`}
                      </div>
                    </label>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune déclaration de charge sociale active disponible
                </p>
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              {selectedCharges.length} charge(s) sélectionnée(s)
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChargesDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveCharges} disabled={loading}>
              Enregistrer les liaisons
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
