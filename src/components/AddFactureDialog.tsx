import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import type { Facture, FactureLigne } from "@/pages/Factures";

interface AddFactureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialData?: Facture | null;
}

export default function AddFactureDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  initialData 
}: AddFactureDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [societeInterne, setSocieteInterne] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [fournisseursGeneraux, setFournisseursGeneraux] = useState<any[]>([]);
  const [fournisseursServices, setFournisseursServices] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    type_facture: 'VENTES' as 'VENTES' | 'ACHATS',
    date_emission: new Date().toISOString().split('T')[0],
    date_echeance: '',
    emetteur_type: '',
    emetteur_id: '' as string | undefined,
    emetteur_nom: '',
    emetteur_adresse: '' as string | undefined,
    emetteur_telephone: '' as string | undefined,
    emetteur_email: '' as string | undefined,
    destinataire_type: '',
    destinataire_id: '' as string | undefined,
    destinataire_nom: '',
    destinataire_adresse: '' as string | undefined,
    destinataire_telephone: '' as string | undefined,
    destinataire_email: '' as string | undefined,
    informations_paiement: '' as string | undefined,
    reference_societe: '' as string | undefined,
    statut: 'BROUILLON' as 'BROUILLON' | 'VALIDEE' | 'PAYEE' | 'ANNULEE',
  });

  const [lignes, setLignes] = useState<FactureLigne[]>([
    { ordre: 1, description: '', prix_ht: 0, taux_tva: 20 }
  ]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  useEffect(() => {
    if (open && societeInterne) {
      if (initialData) {
        // Si on a des données initiales (copie), les utiliser
        const { id, numero_facture, created_at, updated_at, created_by, lignes, ...dataToUse } = initialData;
        setFormData({
          ...dataToUse,
          emetteur_id: dataToUse.emetteur_id || '',
          emetteur_adresse: dataToUse.emetteur_adresse || '',
          emetteur_telephone: dataToUse.emetteur_telephone || '',
          emetteur_email: dataToUse.emetteur_email || '',
          destinataire_id: dataToUse.destinataire_id || '',
          destinataire_adresse: dataToUse.destinataire_adresse || '',
          destinataire_telephone: dataToUse.destinataire_telephone || '',
          destinataire_email: dataToUse.destinataire_email || '',
          informations_paiement: dataToUse.informations_paiement || '',
          reference_societe: dataToUse.reference_societe || '',
          statut: 'BROUILLON',
          date_emission: new Date().toISOString().split('T')[0],
        });
        if (initialData.lignes) {
          setLignes(initialData.lignes);
        }
      } else {
        // Sinon, réinitialiser le formulaire avec les données de société interne
        resetForm();
        // Appliquer automatiquement les données de société interne pour VENTES
        if (formData.type_facture === 'VENTES') {
          // Construire les informations de paiement
          let infoPaiement = '';
          if (societeInterne.etablissement_bancaire) {
            infoPaiement += `Banque: ${societeInterne.etablissement_bancaire}\n`;
          }
          if (societeInterne.iban) {
            infoPaiement += `IBAN: ${societeInterne.iban}\n`;
          }
          if (societeInterne.bic) {
            infoPaiement += `BIC: ${societeInterne.bic}`;
          }
          
          setFormData(prev => ({
            ...prev,
            emetteur_type: 'SOCIETE_INTERNE',
            emetteur_id: societeInterne.id,
            emetteur_nom: societeInterne.raison_sociale,
            emetteur_adresse: societeInterne.adresse || '',
            emetteur_telephone: societeInterne.telephone || '',
            emetteur_email: societeInterne.email || '',
            destinataire_type: 'CLIENT',
            informations_paiement: infoPaiement.trim(),
            reference_societe: societeInterne.siren || '',
          }));
        }
      }
    }
  }, [open, initialData, societeInterne]);

  const resetForm = () => {
    const newFormData: any = {
      type_facture: 'VENTES',
      date_emission: new Date().toISOString().split('T')[0],
      date_echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      emetteur_type: '',
      emetteur_id: '',
      emetteur_nom: '',
      emetteur_adresse: '',
      emetteur_telephone: '',
      emetteur_email: '',
      destinataire_type: 'CLIENT',
      destinataire_id: '',
      destinataire_nom: '',
      destinataire_adresse: '',
      destinataire_telephone: '',
      destinataire_email: '',
      informations_paiement: '',
      reference_societe: '',
      statut: 'BROUILLON',
    };
    
    // Si on a la société interne, pré-remplir pour les ventes
    if (societeInterne) {
      // Construire les informations de paiement
      let infoPaiement = '';
      if (societeInterne.etablissement_bancaire) {
        infoPaiement += `Banque: ${societeInterne.etablissement_bancaire}\n`;
      }
      if (societeInterne.iban) {
        infoPaiement += `IBAN: ${societeInterne.iban}\n`;
      }
      if (societeInterne.bic) {
        infoPaiement += `BIC: ${societeInterne.bic}`;
      }
      
      newFormData.emetteur_type = 'SOCIETE_INTERNE';
      newFormData.emetteur_id = societeInterne.id;
      newFormData.emetteur_nom = societeInterne.raison_sociale;
      newFormData.emetteur_adresse = societeInterne.adresse || '';
      newFormData.emetteur_telephone = societeInterne.telephone || '';
      newFormData.emetteur_email = societeInterne.email || '';
      newFormData.informations_paiement = infoPaiement.trim();
      newFormData.reference_societe = societeInterne.siren || '';
    }
    
    setFormData(newFormData);
    setLignes([{ ordre: 1, description: '', prix_ht: 0, taux_tva: 20 }]);
  };

  const fetchData = async () => {
    try {
      // Récupérer la société interne
      const { data: societe } = await supabase
        .from('societe_interne')
        .select('*')
        .single();
      setSocieteInterne(societe);

      // Récupérer les clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .order('raison_sociale');
      setClients(clientsData || []);

      // Récupérer les fournisseurs généraux
      const { data: fournGeneraux } = await supabase
        .from('fournisseurs_generaux')
        .select('*')
        .order('raison_sociale');
      setFournisseursGeneraux(fournGeneraux || []);

      // Récupérer les fournisseurs de services
      const { data: fournServices } = await supabase
        .from('fournisseurs_services')
        .select('*')
        .order('raison_sociale');
      setFournisseursServices(fournServices || []);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    }
  };

  const handleTypeChange = (type: 'VENTES' | 'ACHATS') => {
    setFormData(prev => {
      const newData = { ...prev, type_facture: type };
      
      // Réinitialiser les coordonnées émetteur et destinataire
      if (type === 'VENTES' && societeInterne) {
        // Construire les informations de paiement
        let infoPaiement = '';
        if (societeInterne.etablissement_bancaire) {
          infoPaiement += `Banque: ${societeInterne.etablissement_bancaire}\n`;
        }
        if (societeInterne.iban) {
          infoPaiement += `IBAN: ${societeInterne.iban}\n`;
        }
        if (societeInterne.bic) {
          infoPaiement += `BIC: ${societeInterne.bic}`;
        }
        
        // Pour les ventes, l'émetteur est la société interne
        newData.emetteur_type = 'SOCIETE_INTERNE';
        newData.emetteur_id = societeInterne.id;
        newData.emetteur_nom = societeInterne.raison_sociale;
        newData.emetteur_adresse = societeInterne.adresse || '';
        newData.emetteur_telephone = societeInterne.telephone || '';
        newData.emetteur_email = societeInterne.email || '';
        newData.informations_paiement = infoPaiement.trim();
        newData.reference_societe = societeInterne.siren || '';
        
        // Le destinataire sera un client
        newData.destinataire_type = 'CLIENT';
        newData.destinataire_id = '';
        newData.destinataire_nom = '';
        newData.destinataire_adresse = '';
        newData.destinataire_telephone = '';
        newData.destinataire_email = '';
      } else if (type === 'ACHATS' && societeInterne) {
        // Pour les achats, le destinataire est la société interne
        newData.destinataire_type = 'SOCIETE_INTERNE';
        newData.destinataire_id = societeInterne.id;
        newData.destinataire_nom = societeInterne.raison_sociale;
        newData.destinataire_adresse = societeInterne.adresse || '';
        newData.destinataire_telephone = societeInterne.telephone || '';
        newData.destinataire_email = societeInterne.email || '';
        
        // L'émetteur sera un fournisseur
        newData.emetteur_type = '';
        newData.emetteur_id = '';
        newData.emetteur_nom = '';
        newData.emetteur_adresse = '';
        newData.emetteur_telephone = '';
        newData.emetteur_email = '';
        newData.informations_paiement = '';
        newData.reference_societe = '';
      }
      
      return newData;
    });
  };

  const handleEmetteurChange = (type: string, id: string) => {
    let emetteur = null;
    
    if (type === 'FOURNISSEUR_GENERAL') {
      emetteur = fournisseursGeneraux.find(f => f.id === id);
    } else if (type === 'FOURNISSEUR_SERVICE') {
      emetteur = fournisseursServices.find(f => f.id === id);
    }
    
    if (emetteur) {
      setFormData(prev => ({
        ...prev,
        emetteur_type: type,
        emetteur_id: id,
        emetteur_nom: emetteur.raison_sociale,
        emetteur_adresse: emetteur.adresse || '',
        emetteur_telephone: emetteur.telephone || '',
        emetteur_email: emetteur.email || '',
      }));
    }
  };

  const handleDestinataireClientChange = (id: string) => {
    const client = clients.find(c => c.id === id);
    if (client) {
      setFormData(prev => ({
        ...prev,
        destinataire_id: id,
        destinataire_nom: client.raison_sociale,
        destinataire_adresse: client.adresse || '',
        destinataire_telephone: client.telephone || '',
        destinataire_email: client.email || '',
      }));
    }
  };

  const addLigne = () => {
    setLignes(prev => [...prev, {
      ordre: prev.length + 1,
      description: '',
      prix_ht: 0,
      taux_tva: 20
    }]);
  };

  const removeLigne = (index: number) => {
    if (lignes.length > 1) {
      setLignes(prev => prev.filter((_, i) => i !== index).map((l, i) => ({ ...l, ordre: i + 1 })));
    }
  };

  const updateLigne = (index: number, field: keyof FactureLigne, value: any) => {
    setLignes(prev => prev.map((ligne, i) => 
      i === index ? { ...ligne, [field]: value } : ligne
    ));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Générer le numéro de facture
      const { data: numeroData, error: numeroError } = await supabase
        .rpc('generate_numero_facture', { p_type: formData.type_facture });

      if (numeroError) throw numeroError;

      // Créer la facture
      const { data: facture, error: factureError } = await supabase
        .from('factures')
        .insert({
          ...formData,
          numero_facture: numeroData,
        })
        .select()
        .single();

      if (factureError) throw factureError;

      // Créer les lignes de facture
      const lignesToInsert = lignes.map(ligne => ({
        facture_id: facture.id,
        ordre: ligne.ordre,
        description: ligne.description,
        prix_ht: ligne.prix_ht,
        taux_tva: ligne.taux_tva,
      }));

      const { error: lignesError } = await supabase
        .from('facture_lignes')
        .insert(lignesToInsert);

      if (lignesError) throw lignesError;

      toast({
        title: "Succès",
        description: "Facture créée avec succès",
      });

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la facture",
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
          <DialogTitle>Nouvelle Facture</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type de facture */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type de facture</Label>
              <Select value={formData.type_facture} onValueChange={(value: 'VENTES' | 'ACHATS') => handleTypeChange(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VENTES">Ventes</SelectItem>
                  <SelectItem value="ACHATS">Achats</SelectItem>
                </SelectContent>
              </Select>
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
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date d'émission</Label>
              <Input
                type="date"
                value={formData.date_emission}
                onChange={(e) => setFormData(prev => ({ ...prev, date_emission: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Date d'échéance</Label>
              <Input
                type="date"
                value={formData.date_echeance}
                onChange={(e) => setFormData(prev => ({ ...prev, date_echeance: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Émetteur */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">Émetteur</Label>
            {formData.type_facture === 'VENTES' ? (
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="font-medium">{formData.emetteur_nom}</p>
                {formData.emetteur_adresse && <p className="text-sm">{formData.emetteur_adresse}</p>}
                {formData.emetteur_telephone && <p className="text-sm">Tél: {formData.emetteur_telephone}</p>}
                {formData.emetteur_email && <p className="text-sm">Email: {formData.emetteur_email}</p>}
              </div>
            ) : (
              <div className="space-y-2">
                <Select onValueChange={(value) => {
                  const [type, id] = value.split(':');
                  handleEmetteurChange(type, id);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un fournisseur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>-- Fournisseurs Généraux --</SelectItem>
                    {fournisseursGeneraux.map(f => (
                      <SelectItem key={f.id} value={`FOURNISSEUR_GENERAL:${f.id}`}>
                        {f.raison_sociale}
                      </SelectItem>
                    ))}
                    <SelectItem value="none2" disabled>-- Fournisseurs Services --</SelectItem>
                    {fournisseursServices.map(f => (
                      <SelectItem key={f.id} value={`FOURNISSEUR_SERVICE:${f.id}`}>
                        {f.raison_sociale}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Destinataire */}
          <div className="space-y-2">
            <Label className="text-lg font-semibold">Destinataire</Label>
            {formData.type_facture === 'ACHATS' ? (
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="font-medium">{formData.destinataire_nom}</p>
                {formData.destinataire_adresse && <p className="text-sm">{formData.destinataire_adresse}</p>}
                {formData.destinataire_telephone && <p className="text-sm">Tél: {formData.destinataire_telephone}</p>}
                {formData.destinataire_email && <p className="text-sm">Email: {formData.destinataire_email}</p>}
              </div>
            ) : (
              <Select onValueChange={handleDestinataireClientChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.raison_sociale}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Lignes de facture */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-lg font-semibold">Lignes de facture</Label>
              <Button type="button" onClick={addLigne} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Ajouter une ligne
              </Button>
            </div>

            <div className="space-y-2">
              {lignes.map((ligne, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 p-2 border rounded">
                  <div className="col-span-5">
                    <Input
                      placeholder="Description"
                      value={ligne.description}
                      onChange={(e) => updateLigne(index, 'description', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Prix HT"
                      value={ligne.prix_ht}
                      onChange={(e) => updateLigne(index, 'prix_ht', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="TVA %"
                      value={ligne.taux_tva}
                      onChange={(e) => updateLigne(index, 'taux_tva', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="col-span-2 flex items-center">
                    <span className="text-sm font-medium">
                      TTC: {((ligne.prix_ht || 0) * (1 + (ligne.taux_tva || 0) / 100)).toFixed(2)} €
                    </span>
                  </div>
                  <div className="col-span-1 flex items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLigne(index)}
                      disabled={lignes.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
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
                value={formData.informations_paiement}
                onChange={(e) => setFormData(prev => ({ ...prev, informations_paiement: e.target.value }))}
                rows={3}
              />
            </div>
            <div>
              <Label>Référence société</Label>
              <Input
                value={formData.reference_societe}
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
              {loading ? "Création..." : "Créer la facture"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}