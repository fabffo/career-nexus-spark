import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { candidatService } from '@/services';
import { Candidat } from '@/types/models';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Users, Trash2, Edit2 } from 'lucide-react';

interface AssociateCandidatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posteId: string;
  posteTitle: string;
}

interface CandidatPoste {
  id: string;
  candidat_id: string;
  poste_id: string;
  etape_recrutement: string;
  date_candidature: string;
  salaire_propose?: number;
  notes?: string;
  candidats?: Candidat;
}

interface EtapeRecrutement {
  code: string;
  libelle: string;
  couleur: string;
  ordre: number;
}

export function AssociateCandidatsDialog({ open, onOpenChange, posteId, posteTitle }: AssociateCandidatsDialogProps) {
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [associatedCandidats, setAssociatedCandidats] = useState<CandidatPoste[]>([]);
  const [etapes, setEtapes] = useState<EtapeRecrutement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCandidatIds, setSelectedCandidatIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCandidat, setEditingCandidat] = useState<CandidatPoste | null>(null);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, posteId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [candidatsData, etapesData] = await Promise.all([
        candidatService.getAll(),
        supabase
          .from('param_etapes_recrutement')
          .select('*')
          .eq('is_active', true)
          .order('ordre', { ascending: true })
      ]);

      setCandidats(candidatsData);
      setEtapes((etapesData.data || []) as EtapeRecrutement[]);

      // Charger les candidats déjà associés
      const { data: associated } = await supabase
        .from('candidats_postes')
        .select('*')
        .eq('poste_id', posteId);

      // Enrichir avec les données des candidats
      const enrichedAssociations = (associated || []).map(assoc => ({
        ...assoc,
        candidats: candidatsData.find(c => c.id === assoc.candidat_id)
      }));

      setAssociatedCandidats(enrichedAssociations as CandidatPoste[]);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const filteredCandidats = candidats.filter(c => {
    const fullName = `${c.nom} ${c.prenom} ${c.metier}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  const toggleCandidatSelection = (candidatId: string) => {
    setSelectedCandidatIds(prev =>
      prev.includes(candidatId)
        ? prev.filter(id => id !== candidatId)
        : [...prev, candidatId]
    );
  };

  const handleAssociate = async () => {
    if (selectedCandidatIds.length === 0) {
      toast.error('Veuillez sélectionner au moins un candidat');
      return;
    }

    try {
      setLoading(true);
      const associations = selectedCandidatIds.map(candidatId => ({
        candidat_id: candidatId,
        poste_id: posteId,
        etape_recrutement: 'CV_RECU',
        date_candidature: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('candidats_postes')
        .insert(associations);

      if (error) throw error;

      toast.success(`${selectedCandidatIds.length} candidat(s) associé(s) avec succès`);
      setSelectedCandidatIds([]);
      loadData();
    } catch (error: any) {
      console.error('Erreur:', error);
      if (error.message?.includes('duplicate')) {
        toast.error('Un ou plusieurs candidats sont déjà associés à ce poste');
      } else {
        toast.error('Erreur lors de l\'association');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEtape = async (associationId: string, newEtape: string) => {
    try {
      const { error } = await supabase
        .from('candidats_postes')
        .update({ etape_recrutement: newEtape })
        .eq('id', associationId);

      if (error) throw error;

      toast.success('Étape mise à jour');
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleRemoveAssociation = async (associationId: string) => {
    try {
      const { error } = await supabase
        .from('candidats_postes')
        .delete()
        .eq('id', associationId);

      if (error) throw error;

      toast.success('Candidat retiré du poste');
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const getEtapeColor = (code: string) => {
    const etape = etapes.find(e => e.code === code);
    return etape?.couleur || '#9CA3AF';
  };

  const getEtapeLibelle = (code: string) => {
    const etape = etapes.find(e => e.code === code);
    return etape?.libelle || code;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gérer les candidats - {posteTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-2 gap-4">
          {/* Liste des candidats à associer */}
          <div className="space-y-3">
            <div>
              <Label>Ajouter des candidats</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un candidat..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <ScrollArea className="h-[400px] border rounded-lg p-2">
              {loading ? (
                <div className="text-center py-8">Chargement...</div>
              ) : (
                <div className="space-y-2">
                  {filteredCandidats.map((candidat) => {
                    const isAssociated = associatedCandidats.some(
                      a => a.candidat_id === candidat.id
                    );
                    const isSelected = selectedCandidatIds.includes(candidat.id);

                    return (
                      <div
                        key={candidat.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          isAssociated ? 'bg-muted/50 opacity-50' : isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleCandidatSelection(candidat.id)}
                          disabled={isAssociated}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {candidat.nom} {candidat.prenom}
                          </p>
                          <p className="text-xs text-muted-foreground">{candidat.metier}</p>
                          {candidat.mail && (
                            <p className="text-xs text-muted-foreground">{candidat.mail}</p>
                          )}
                          {candidat.telephone && (
                            <p className="text-xs text-muted-foreground">{candidat.telephone}</p>
                          )}
                        </div>
                        {isAssociated && (
                          <Badge variant="secondary" className="text-xs">Déjà associé</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            <Button
              onClick={handleAssociate}
              disabled={selectedCandidatIds.length === 0 || loading}
              className="w-full"
            >
              Associer {selectedCandidatIds.length > 0 && `(${selectedCandidatIds.length})`}
            </Button>
          </div>

          {/* Candidats associés avec suivi */}
          <div className="space-y-3">
            <Label>Candidats associés ({associatedCandidats.length})</Label>
            <ScrollArea className="h-[480px] border rounded-lg p-2">
              {associatedCandidats.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Aucun candidat associé
                </div>
              ) : (
                <div className="space-y-3">
                  {associatedCandidats.map((assoc) => (
                    <div
                      key={assoc.id}
                      className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {assoc.candidats?.nom} {assoc.candidats?.prenom}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {assoc.candidats?.metier}
                          </p>
                          {assoc.candidats?.mail && (
                            <p className="text-xs text-muted-foreground">{assoc.candidats.mail}</p>
                          )}
                          {assoc.candidats?.telephone && (
                            <p className="text-xs text-muted-foreground">{assoc.candidats.telephone}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAssociation(assoc.id)}
                          className="h-7 w-7"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Étape du recrutement</Label>
                        <Select
                          value={assoc.etape_recrutement}
                          onValueChange={(value) => handleUpdateEtape(assoc.id, value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {etapes.map((etape) => (
                              <SelectItem key={etape.code} value={etape.code}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: etape.couleur }}
                                  />
                                  {etape.libelle}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Badge
                          style={{
                            backgroundColor: `${getEtapeColor(assoc.etape_recrutement)}20`,
                            color: getEtapeColor(assoc.etape_recrutement),
                            borderColor: getEtapeColor(assoc.etape_recrutement)
                          }}
                          className="border text-xs"
                        >
                          {getEtapeLibelle(assoc.etape_recrutement)}
                        </Badge>
                      </div>

                      {assoc.notes && (
                        <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                          {assoc.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
