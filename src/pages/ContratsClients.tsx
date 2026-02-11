import { useState, useEffect } from 'react';
import { Contrat } from '@/types/contrat';
import { contratService, prestataireService } from '@/services/contratService';
import { salarieService } from '@/services/salarieService';
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

export default function ContratsClients() {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [prestataires, setPrestataires] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContrat, setSelectedContrat] = useState<Contrat | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadContrats();
    // Charger prestataires + salariés avec rôle PRESTATAIRE
    Promise.all([
      prestataireService.getAll(),
      salarieService.getAll(),
    ]).then(([prestas, salaries]) => {
      const salariesPrestataires = (salaries || [])
        .filter(s => s.role === 'PRESTATAIRE')
        .map(s => ({ ...s, _isSalarie: true }));
      setPrestataires([
        ...prestas.map(p => ({ ...p, _isSalarie: false })),
        ...salariesPrestataires,
      ]);
    }).catch(console.error);
  }, []);

  const loadContrats = async () => {
    try {
      setLoading(true);
      const data = await contratService.getAll();
      // Filtrer uniquement les contrats clients
      const contratsClients = data.filter(c => c.type === 'CLIENT');
      setContrats(contratsClients);
    } catch (error: any) {
      console.error('Error loading contrats:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les contrats clients",
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
    navigate(`/contrats?edit=${contrat.id}&returnTo=/contrats-clients`);
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

  const columns: ColumnDef<Contrat>[] = [
    {
      accessorKey: 'numero_contrat',
      header: 'N° Contrat',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.numero_contrat}</div>
      )
    },
    {
      accessorKey: 'client',
      header: 'Client',
      cell: ({ row }) => (
        <div>{row.original.client?.raison_sociale || '-'}</div>
      )
    },
    {
      accessorKey: 'reference_client',
      header: 'Réf. Client',
      cell: ({ row }) => {
        const refs = (row.original as any).reference_client;
        if (!refs || !Array.isArray(refs) || refs.length === 0) return <div>-</div>;
        return (
          <div className="space-y-0.5">
            {refs.map((ref: any, idx: number) => {
              const prestaId = ref.prestataire_id?.startsWith('sal_') ? ref.prestataire_id.slice(4) : ref.prestataire_id;
              const presta = prestaId ? prestataires.find((p: any) => p.id === prestaId) : null;
              return (
                <div key={idx} className="text-xs">
                  {ref.reference} {presta ? `[${presta.nom} ${presta.prenom}${presta._isSalarie ? ' - Salarié' : ''}]` : ''} ({ref.montant?.toLocaleString('fr-FR')}€)
                </div>
              );
            })}
          </div>
        );
      }
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
          <h1 className="text-3xl font-bold">Contrats Clients</h1>
          <p className="text-muted-foreground">Gérez vos contrats avec les clients</p>
        </div>
        <Button onClick={() => navigate('/contrats?new=true&returnTo=/contrats-clients')}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau contrat
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={contrats}
        searchPlaceholder="Rechercher un contrat client..."
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
                  <p className="font-medium">Client</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Client</Label>
                <p className="font-medium">
                  {selectedContrat.client?.raison_sociale || 'Non renseigné'}
                </p>
              </div>

              {(selectedContrat as any).reference_client && Array.isArray((selectedContrat as any).reference_client) && (selectedContrat as any).reference_client.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Références Client</Label>
                  <div className="space-y-1 mt-1">
                    {(selectedContrat as any).reference_client.map((ref: any, idx: number) => {
                      const prestaId = ref.prestataire_id?.startsWith('sal_') ? ref.prestataire_id.slice(4) : ref.prestataire_id;
                      const presta = prestaId ? prestataires.find((p: any) => p.id === prestaId) : null;
                      return (
                        <div key={idx} className="flex justify-between items-center p-2 border rounded">
                          <div>
                            <span className="font-medium">{ref.reference}</span>
                            {presta && <span className="text-sm text-muted-foreground ml-2">[{presta.nom} {presta.prenom}{presta._isSalarie ? ' - Salarié' : ''}]</span>}
                          </div>
                          <span className="text-muted-foreground">{ref.montant?.toLocaleString('fr-FR')} €</span>
                        </div>
                      );
                    })}
                  </div>
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
