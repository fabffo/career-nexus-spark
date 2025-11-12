import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ChevronsUpDown, Check, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Facture, FactureLigne } from "@/pages/Factures";
import type { Mission } from "@/types/mission";

interface EditFactureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  facture: Facture;
}

export default function EditFactureDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  facture 
}: EditFactureDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [societeInterne, setSocieteInterne] = useState<any>(null);
  const [formData, setFormData] = useState(facture);
  const [lignes, setLignes] = useState<FactureLigne[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [typesMission, setTypesMission] = useState<any[]>([]);

  useEffect(() => {
    if (open && facture) {
      setFormData(facture);
      fetchLignes();
      fetchMissions();
      fetchTypesMission();
      fetchSocieteInterne();
    }
  }, [open, facture]);

  const fetchLignes = async () => {
    try {
      const { data, error } = await supabase
        .from('facture_lignes')
        .select('*')
        .eq('facture_id', facture.id)
        .order('ordre');

      if (error) throw error;
      // Mapper les données avec les valeurs par défaut pour les colonnes manquantes
      const lignesWithDefaults = (data || []).map((ligne: any) => ({
        ...ligne,
        quantite: ligne.quantite || 1,
        prix_unitaire_ht: ligne.prix_unitaire_ht || ligne.prix_ht || 0
      }));
      setLignes(lignesWithDefaults);
    } catch (error) {
      console.error('Erreur lors du chargement des lignes:', error);
    }
  };

  const fetchMissions = async () => {
    try {
      const { data: missionsData } = await supabase
        .from('missions')
        .select(`
          *, 
          tva(*),
          contrat:contrats(
            id,
            type,
            client:clients(id, raison_sociale)
          )
        `)
        .eq('statut', 'EN_COURS')
        .order('titre');
      setMissions((missionsData as Mission[]) || []);
    } catch (error) {
      console.error('Erreur lors du chargement des missions:', error);
    }
  };

  const fetchTypesMission = async () => {
    try {
      const { data: typesData } = await supabase
        .from('param_type_mission')
        .select('*')
        .eq('is_active', true)
        .order('ordre, libelle');
      setTypesMission(typesData || []);
    } catch (error) {
      console.error('Erreur lors du chargement des types de mission:', error);
    }
  };

  const fetchSocieteInterne = async () => {
    try {
      const { data } = await supabase
        .from('societe_interne')
        .select('*')
        .single();
      setSocieteInterne(data);
    } catch (error) {
      console.error('Erreur lors du chargement de la société:', error);
    }
  };

  const addLigne = () => {
    setLignes(prev => [...prev, {
      ordre: prev.length + 1,
      description: '',
      quantite: 1,
      prix_unitaire_ht: 0,
      prix_ht: 0,
      taux_tva: 20,
      montant_tva: 0,
      prix_ttc: 0
    }]);
  };

  const removeLigne = async (ligne: FactureLigne) => {
    if (ligne.id) {
      // Supprimer de la base de données
      try {
        const { error } = await supabase
          .from('facture_lignes')
          .delete()
          .eq('id', ligne.id);

        if (error) throw error;
      } catch (error) {
        toast({
          title: "Erreur",
          description: "Impossible de supprimer la ligne",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Supprimer de l'état local
    setLignes(prev => prev.filter(l => l.id !== ligne.id).map((l, i) => ({ ...l, ordre: i + 1 })));
  };

  const updateLigne = (index: number, field: keyof FactureLigne | 'mission_id', value: any) => {
    setLignes(prev => prev.map((ligne, i) => {
      if (i !== index) return ligne;
      
      // Si on sélectionne une mission
      if (field === 'mission_id' && value !== 'custom') {
        const mission = missions.find(m => m.id === value);
        if (mission) {
          const prixUnitaire = mission.prix_ht || mission.tjm || 0;
          const tauxTva = mission.tva?.taux || mission.taux_tva || 20;
          const quantite = ligne.quantite || 1;
          const prixHt = quantite * prixUnitaire;
          const montantTva = prixHt * tauxTva / 100;
          
          return {
            ...ligne,
            description: `Mission : ${mission.titre}${mission.description ? ' - ' + mission.description : ''}`,
            prix_unitaire_ht: prixUnitaire,
            prix_ht: prixHt,
            taux_tva: tauxTva,
            montant_tva: montantTva,
            prix_ttc: prixHt + montantTva
          };
        }
      }
      
      const updatedLigne = { ...ligne, [field]: value };
      
      // Recalculer les montants si quantité ou prix unitaire HT change
      if (field === 'quantite' || field === 'prix_unitaire_ht') {
        const quantite = field === 'quantite' ? parseFloat(value) || 0 : updatedLigne.quantite;
        const prixUnitaire = field === 'prix_unitaire_ht' ? parseFloat(value) || 0 : updatedLigne.prix_unitaire_ht;
        updatedLigne.prix_ht = quantite * prixUnitaire;
      }
      
      // Recalculer TVA et TTC si prix HT ou taux TVA change
      if (field === 'quantite' || field === 'prix_unitaire_ht' || field === 'taux_tva' || field === 'prix_ht') {
        const prixHt = updatedLigne.prix_ht || 0;
        const tauxTva = field === 'taux_tva' ? parseFloat(value) || 0 : updatedLigne.taux_tva;
        updatedLigne.montant_tva = prixHt * tauxTva / 100;
        updatedLigne.prix_ttc = prixHt + updatedLigne.montant_tva;
      }
      
      return updatedLigne;
    }));
  };

  const calculateTotals = () => {
    const total_ht = lignes.reduce((sum, ligne) => sum + (ligne.prix_ht || 0), 0);
    const total_tva = lignes.reduce((sum, ligne) => {
      const ht = ligne.prix_ht || 0;
      const tva = ligne.taux_tva || 0;
      return sum + (ht * tva / 100);
    }, 0);
    const total_ttc = total_ht + total_tva;
    
    return { total_ht, total_tva, total_ttc };
  };

  // Filtrer les missions en fonction du type de facture et du client sélectionné
  const getFilteredMissions = () => {
    let filtered = missions;
    
    // Pour les factures de vente, ne montrer que les missions avec des contrats CLIENT
    if (formData.type_facture === 'VENTES') {
      filtered = filtered.filter(mission => 
        mission.contrat?.type === 'CLIENT'
      );
      
      // Si un client est sélectionné, filtrer par ce client
      if (formData.destinataire_id) {
        filtered = filtered.filter(mission => 
          mission.contrat?.client?.id === formData.destinataire_id
        );
      }
    }
    
    return filtered;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Préparer les données de mise à jour
      const updateData: any = {
        date_echeance: formData.date_echeance,
        statut: formData.statut,
        informations_paiement: formData.informations_paiement,
        reference_societe: formData.reference_societe,
      };

      // Pour les factures d'achat, permettre la modification de date_emission, emetteur_nom, destinataire_nom
      if (facture.type_facture === 'ACHATS') {
        updateData.date_emission = format(new Date(formData.date_emission), 'yyyy-MM-dd');
        updateData.emetteur_nom = formData.emetteur_nom;
        updateData.destinataire_nom = formData.destinataire_nom;
      }

      // Mettre à jour la facture
      const { error: factureError } = await supabase
        .from('factures')
        .update(updateData)
        .eq('id', facture.id);

      if (factureError) throw factureError;

      // Mettre à jour les lignes existantes et créer les nouvelles
      for (const ligne of lignes) {
        if (ligne.id) {
          // Mettre à jour la ligne existante
          const { error } = await supabase
            .from('facture_lignes')
            .update({
              ordre: ligne.ordre,
              description: ligne.description,
              quantite: ligne.quantite,
              prix_unitaire_ht: ligne.prix_unitaire_ht,
              prix_ht: ligne.prix_ht,
              taux_tva: ligne.taux_tva,
            })
            .eq('id', ligne.id);

          if (error) throw error;
        } else {
          // Créer une nouvelle ligne
          const { error } = await supabase
            .from('facture_lignes')
            .insert({
              facture_id: facture.id,
              ordre: ligne.ordre,
              description: ligne.description,
              quantite: ligne.quantite,
              prix_unitaire_ht: ligne.prix_unitaire_ht,
              prix_ht: ligne.prix_ht,
              taux_tva: ligne.taux_tva,
            });

          if (error) throw error;
        }
      }

      toast({
        title: "Succès",
        description: "Facture modifiée avec succès",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier la facture",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier la Facture {facture.numero_facture}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations - modifiables pour ACHATS */}
          {facture.type_facture === 'ACHATS' ? (
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Type</p>
                <p className="font-medium">{facture.type_facture}</p>
              </div>
              <div>
                <Label>Date d'émission</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.date_emission && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.date_emission ? (
                        format(new Date(formData.date_emission), "dd/MM/yyyy", { locale: fr })
                      ) : (
                        <span>Sélectionner une date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={new Date(formData.date_emission)}
                      onSelect={(date) => date && setFormData(prev => ({ ...prev, date_emission: format(date, 'yyyy-MM-dd') }))}
                      locale={fr}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="emetteur_nom">Émetteur</Label>
                <Input
                  id="emetteur_nom"
                  value={formData.emetteur_nom}
                  onChange={(e) => setFormData(prev => ({ ...prev, emetteur_nom: e.target.value }))}
                  placeholder="Nom de l'émetteur"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destinataire_nom">Destinataire</Label>
                <Input
                  id="destinataire_nom"
                  value={formData.destinataire_nom}
                  onChange={(e) => setFormData(prev => ({ ...prev, destinataire_nom: e.target.value }))}
                  placeholder="Nom du destinataire"
                />
                {societeInterne?.siren && <p className="text-sm text-muted-foreground">SIREN: {societeInterne.siren}</p>}
                {societeInterne?.tva && <p className="text-sm text-muted-foreground">N° TVA: {societeInterne.tva}</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">{facture.type_facture}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date d'émission</p>
                  <p className="font-medium">{new Date(facture.date_emission).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
              
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Émetteur</p>
                <p className="font-medium">{facture.emetteur_nom}</p>
                {facture.emetteur_adresse && <p className="text-sm text-muted-foreground">{facture.emetteur_adresse}</p>}
                {societeInterne?.siren && <p className="text-sm text-muted-foreground">SIREN: {societeInterne.siren}</p>}
                {societeInterne?.tva && <p className="text-sm text-muted-foreground">N° TVA: {societeInterne.tva}</p>}
              </div>
              
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Destinataire</p>
                <p className="font-medium">{facture.destinataire_nom}</p>
                {facture.destinataire_adresse && <p className="text-sm text-muted-foreground">{facture.destinataire_adresse}</p>}
              </div>
            </div>
          )}

          {/* Champs modifiables */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Date d'échéance</Label>
              <Input
                type="date"
                value={formData.date_echeance}
                onChange={(e) => setFormData(prev => ({ ...prev, date_echeance: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={formData.statut} onValueChange={(value: any) => setFormData(prev => ({ ...prev, statut: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BROUILLON">Brouillon</SelectItem>
                  <SelectItem value="VALIDEE">Validée</SelectItem>
                  <SelectItem value="PAYEE">Payée</SelectItem>
                  <SelectItem value="ANNULEE">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Activité</Label>
              <Select value={(formData as any).activite || 'Prestation'} onValueChange={(value: string) => setFormData(prev => ({ ...prev, activite: value } as any))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typesMission.map((type) => (
                    <SelectItem key={type.id} value={type.libelle}>
                      {type.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lignes de facture */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-lg font-semibold">Lignes de facture</Label>
              <Button type="button" onClick={addLigne} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Ajouter une ligne
              </Button>
            </div>

            {lignes.map((ligne, index) => (
              <div key={index} className="space-y-4 p-4 border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor={`description-${index}`}>Description</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between text-left font-normal"
                        >
                          {ligne.description || "Sélectionner une mission ou saisir librement..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput 
                            placeholder="Rechercher une mission ou saisir librement..." 
                            value={ligne.description}
                            onValueChange={(value) => updateLigne(index, "description", value)}
                          />
                          <CommandEmpty>
                            <div className="p-2 text-sm">
                              {formData.type_facture === 'VENTES' && !formData.destinataire_id ? (
                                <span className="text-muted-foreground">
                                  Sélectionnez d'abord un client pour voir les missions disponibles
                                </span>
                              ) : (
                                <span>
                                  Tapez pour saisir une description personnalisée
                                </span>
                              )}
                            </div>
                          </CommandEmpty>
                          <CommandGroup heading="Missions en cours">
                            {getFilteredMissions().map((mission) => (
                              <CommandItem
                                key={mission.id}
                                value={mission.titre}
                                onSelect={() => updateLigne(index, "mission_id", mission.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    ligne.description?.includes(mission.titre) ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{mission.titre}</span>
                                  {mission.contrat?.client && (
                                    <span className="text-xs text-muted-foreground">
                                      Client: {mission.contrat.client.raison_sociale}
                                    </span>
                                  )}
                                  {mission.prix_ht && (
                                    <span className="text-sm text-muted-foreground">
                                      {mission.prix_ht}€ HT - TVA {mission.tva?.taux || mission.taux_tva || 20}%
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label htmlFor={`ordre-${index}`}>Ordre</Label>
                    <Input
                      id={`ordre-${index}`}
                      type="number"
                      min="1"
                      value={ligne.ordre}
                      onChange={(e) => updateLigne(index, "ordre", parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div>
                    <Label htmlFor={`quantite-${index}`}>Quantité</Label>
                    <Input
                      id={`quantite-${index}`}
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={ligne.quantite}
                      onChange={(e) => updateLigne(index, "quantite", e.target.value)}
                      placeholder="1"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor={`prix_unitaire_ht-${index}`}>Prix unitaire HT (€)</Label>
                    <Input
                      id={`prix_unitaire_ht-${index}`}
                      type="number"
                      step="0.01"
                      value={ligne.prix_unitaire_ht}
                      onChange={(e) => updateLigne(index, "prix_unitaire_ht", e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`taux_tva-${index}`}>Taux TVA (%)</Label>
                    <Input
                      id={`taux_tva-${index}`}
                      type="number"
                      step="0.01"
                      value={ligne.taux_tva}
                      onChange={(e) => updateLigne(index, "taux_tva", e.target.value)}
                      placeholder="20.00"
                    />
                  </div>

                  <div>
                    <Label>Montant HT (€)</Label>
                    <Input
                      type="text"
                      value={ligne.prix_ht.toFixed(2)}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div>
                    <Label>Montant TVA (€)</Label>
                    <Input
                      type="text"
                      value={(ligne.montant_tva || 0).toFixed(2)}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div>
                    <Label>Montant TTC (€)</Label>
                    <Input
                      type="text"
                      value={(ligne.prix_ttc || 0).toFixed(2)}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                {lignes.length > 1 && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeLigne(ligne)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Supprimer
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Totaux */}
          <div className="border-t pt-4">
            <div className="flex justify-end space-y-1">
              <div className="text-right space-y-1">
                <p>Total HT: <span className="font-semibold">{totals.total_ht.toFixed(2)} €</span></p>
                <p>Total TVA: <span className="font-semibold">{totals.total_tva.toFixed(2)} €</span></p>
                <p className="text-lg">Total TTC: <span className="font-bold">{totals.total_ttc.toFixed(2)} €</span></p>
              </div>
            </div>
          </div>

          {/* Informations complémentaires */}
          <div className="space-y-4">
            <div>
              <Label>Informations de paiement</Label>
              <Textarea
                value={formData.informations_paiement || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, informations_paiement: e.target.value }))}
                rows={3}
              />
            </div>
            <div>
              <Label>Référence société</Label>
              <Input
                value={formData.reference_societe || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, reference_societe: e.target.value }))}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}