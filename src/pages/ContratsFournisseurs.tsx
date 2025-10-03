import { useState, useEffect } from 'react';
import { Contrat } from '@/types/contrat';
import { contratService } from '@/services/contratService';
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
import { useNavigate } from 'react-router-dom';

export default function ContratsFournisseurs() {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContrat, setSelectedContrat] = useState<Contrat | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadContrats();
  }, []);

  const loadContrats = async () => {
    try {
      setLoading(true);
      const data = await contratService.getAll();
      // Filtrer les contrats fournisseurs (prestataire, fournisseur services et général)
      const contratsFournisseurs = data.filter(c => 
        c.type === 'PRESTATAIRE' || 
        c.type === 'FOURNISSEUR_SERVICES' || 
        c.type === 'FOURNISSEUR_GENERAL'
      );
      setContrats(contratsFournisseurs);
    } catch (error: any) {
      console.error('Error loading contrats:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les contrats fournisseurs",
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
      loadContrats();
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
      loadContrats();
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
      loadContrats();
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
    navigate(`/contrats?edit=${contrat.id}`);
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
        <Button onClick={() => navigate('/contrats?new=true')}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau contrat
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={contrats}
        searchPlaceholder="Rechercher un contrat fournisseur..."
      />

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

              <div>
                <Label className="text-muted-foreground">Fournisseur</Label>
                <p className="font-medium">{getFournisseurNom(selectedContrat)}</p>
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
