import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { missionService } from '@/services/missionService';
import { contratService } from '@/services/contratService';
import { posteService } from '@/services/posteService';
import { Mission, TypeMission, TypeIntervenant, Tva } from '@/types/mission';
import { Contrat } from '@/types/contrat';
import { PosteClient } from '@/types/models';
import { supabase } from '@/integrations/supabase/client';

interface EditMissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mission: Mission;
  onSuccess: () => void;
}

interface TypeParam {
  id: string;
  code: string;
  libelle: string;
  is_active: boolean;
  ordre: number;
}

export function EditMissionDialog({ open, onOpenChange, mission, onSuccess }: EditMissionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [tvaRates, setTvaRates] = useState<Tva[]>([]);
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [postes, setPostes] = useState<PosteClient[]>([]);
  const [prestataires, setPrestataires] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [typeMissions, setTypeMissions] = useState<TypeParam[]>([]);
  const [typeIntervenants, setTypeIntervenants] = useState<TypeParam[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState<Partial<Mission>>(mission);

  useEffect(() => {
    if (open) {
      setFormData(mission);
      loadData();
    }
  }, [open, mission]);

  const loadData = async () => {
    try {
      const [tvaData, contratsData, postesData, prestatairesRes, salariesRes, typeMissionsRes, typeIntervenantsRes] = await Promise.all([
        missionService.getTvaRates(),
        contratService.getAll(),
        posteService.getAll(),
        supabase.from('prestataires').select('*').order('nom'),
        supabase.from('salaries').select('*').order('nom'),
        supabase.from('param_type_mission' as any).select('*').eq('is_active', true).order('ordre'),
        supabase.from('param_type_intervenant' as any).select('*').eq('is_active', true).order('ordre')
      ]);

      setTvaRates(tvaData);
      setContrats(contratsData);
      setPostes(postesData);
      setPrestataires(prestatairesRes.data || []);
      setSalaries(salariesRes.data || []);
      setTypeMissions((typeMissionsRes.data as any) || []);
      setTypeIntervenants((typeIntervenantsRes.data as any) || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive"
      });
    }
  };

  const handlePosteChange = (posteId: string) => {
    if (posteId === 'none') {
      setFormData(prev => ({ ...prev, poste_id: null }));
    } else {
      const poste = postes.find(p => p.id === posteId);
      if (poste) {
        setFormData(prev => ({
          ...prev,
          poste_id: posteId,
          titre: poste.nomPoste,
          description: poste.detail,
          localisation: poste.client?.adresse
        }));
      }
    }
  };

  const handleTvaChange = (tvaId: string) => {
    const tva = tvaRates.find(t => t.id === tvaId);
    if (tva) {
      setFormData(prev => ({
        ...prev,
        tva_id: tvaId,
        taux_tva: tva.taux
      }));
    }
  };

  const calculatePrixTTC = () => {
    if (formData.type_mission === 'TJM' && formData.tjm && formData.nombre_jours) {
      const prixHT = formData.tjm * formData.nombre_jours;
      return prixHT * (1 + (formData.taux_tva || 20) / 100);
    }
    if (formData.prix_ht) {
      return formData.prix_ht * (1 + (formData.taux_tva || 20) / 100);
    }
    return 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.titre) {
      toast({
        title: "Erreur",
        description: "Le titre est obligatoire",
        variant: "destructive"
      });
      return;
    }

    // Validate intervenant
    if (formData.type_intervenant === 'PRESTATAIRE' && !formData.prestataire_id) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un prestataire",
        variant: "destructive"
      });
      return;
    }
    if (formData.type_intervenant === 'SALARIE' && !formData.salarie_id) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un salarié",
        variant: "destructive"
      });
      return;
    }

    // Calculate prices for TJM
    let dataToSave = { ...formData };
    if (formData.type_mission === 'TJM' && formData.tjm && formData.nombre_jours) {
      dataToSave.prix_ht = formData.tjm * formData.nombre_jours;
    }

    // Clean data based on intervenant type
    if (formData.type_intervenant === 'PRESTATAIRE') {
      delete dataToSave.salarie_id;
    } else {
      delete dataToSave.prestataire_id;
    }

    // Remove read-only fields
    delete dataToSave.id;
    delete dataToSave.created_at;
    delete dataToSave.updated_at;
    delete dataToSave.created_by;
    delete dataToSave.poste;
    delete dataToSave.contrat;
    delete dataToSave.prestataire;
    delete dataToSave.salarie;
    delete dataToSave.tva;

    try {
      setLoading(true);
      await missionService.update(mission.id, dataToSave);
      
      toast({
        title: "Succès",
        description: "Mission modifiée avec succès"
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating mission:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier la mission",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier la mission</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Poste et Contrat */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="poste">Poste (optionnel)</Label>
              <Select value={formData.poste_id || 'none'} onValueChange={handlePosteChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un poste" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {postes.map(poste => (
                    <SelectItem key={poste.id} value={poste.id}>
                      {poste.nomPoste} - {poste.client?.raisonSociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="contrat">Contrat</Label>
              <Select 
                value={formData.contrat_id || 'none'} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, contrat_id: value === 'none' ? null : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un contrat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {contrats.map(contrat => {
                    // Déterminer le fournisseur et son type
                    let fournisseurLabel = '';
                    if (contrat.client) {
                      fournisseurLabel = `Client - ${contrat.client.raison_sociale}`;
                    } else if (contrat.prestataire) {
                      fournisseurLabel = `Prestataire - ${contrat.prestataire.nom} ${contrat.prestataire.prenom}`;
                    } else if (contrat.fournisseur_services) {
                      fournisseurLabel = `Fournisseur Services - ${contrat.fournisseur_services.raison_sociale}`;
                    } else if (contrat.fournisseur_general) {
                      fournisseurLabel = `Fournisseur Général - ${contrat.fournisseur_general.raison_sociale}`;
                    }
                    
                    return (
                      <SelectItem key={contrat.id} value={contrat.id}>
                        {contrat.numero_contrat} - {fournisseurLabel || contrat.type}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Titre et Description */}
          <div>
            <Label htmlFor="titre">Titre *</Label>
            <Input
              id="titre"
              value={formData.titre}
              onChange={(e) => setFormData(prev => ({ ...prev, titre: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Type de mission et Type d'intervenant */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type_mission">Type de mission</Label>
              <Select 
                value={formData.type_mission} 
                onValueChange={(value: TypeMission) => setFormData(prev => ({ ...prev, type_mission: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeMissions.map(type => (
                    <SelectItem key={type.id} value={type.code}>
                      {type.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="type_intervenant">Type d'intervenant</Label>
              <Select 
                value={formData.type_intervenant} 
                onValueChange={(value: TypeIntervenant) => setFormData(prev => ({ ...prev, type_intervenant: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeIntervenants.map(type => (
                    <SelectItem key={type.id} value={type.code}>
                      {type.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sélection de l'intervenant */}
          {formData.type_intervenant === 'PRESTATAIRE' ? (
            <div>
              <Label htmlFor="prestataire">Prestataire *</Label>
              <Select 
                value={formData.prestataire_id || ''} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, prestataire_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un prestataire" />
                </SelectTrigger>
                <SelectContent>
                  {prestataires.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.prenom} {p.nom} {p.email && `(${p.email})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label htmlFor="salarie">Salarié *</Label>
              <Select 
                value={formData.salarie_id || ''} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, salarie_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un salarié" />
                </SelectTrigger>
                <SelectContent>
                  {salaries.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.prenom} {s.nom} - {s.fonction || s.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Informations financières */}
          {formData.type_mission === 'TJM' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tjm">TJM (€)</Label>
                <Input
                  id="tjm"
                  type="number"
                  step="0.01"
                  value={formData.tjm || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, tjm: parseFloat(e.target.value) }))}
                />
              </div>
              <div>
                <Label htmlFor="nombre_jours">Nombre de jours</Label>
                <Input
                  id="nombre_jours"
                  type="number"
                  value={formData.nombre_jours || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre_jours: parseInt(e.target.value) }))}
                />
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="prix_ht">Prix HT (€)</Label>
              <Input
                id="prix_ht"
                type="number"
                step="0.01"
                value={formData.prix_ht || ''}
                onChange={(e) => {
                  const prixHt = parseFloat(e.target.value);
                  setFormData(prev => ({ 
                    ...prev, 
                    prix_ht: prixHt,
                    tjm: prixHt // Synchroniser TJM avec prix HT
                  }));
                }}
              />
            </div>
          )}

          {/* TVA */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tva">Taux de TVA</Label>
              <Select value={formData.tva_id || ''} onValueChange={handleTvaChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tvaRates.map(tva => (
                    <SelectItem key={tva.id} value={tva.id}>
                      {tva.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prix TTC calculé (€)</Label>
              <Input
                type="text"
                value={calculatePrixTTC().toFixed(2)}
                disabled
                className="bg-muted"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date_debut">Date de début</Label>
              <Input
                id="date_debut"
                type="date"
                value={formData.date_debut || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, date_debut: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="date_fin">Date de fin</Label>
              <Input
                id="date_fin"
                type="date"
                value={formData.date_fin || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, date_fin: e.target.value }))}
              />
            </div>
          </div>

          {/* Statut */}
          <div>
            <Label htmlFor="statut">Statut</Label>
            <Select 
              value={formData.statut} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, statut: value as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EN_COURS">En cours</SelectItem>
                <SelectItem value="TERMINE">Terminé</SelectItem>
                <SelectItem value="ANNULE">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Modification..." : "Modifier la mission"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}