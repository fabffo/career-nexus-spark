import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Facture, FactureLigne } from "@/pages/Factures";
import type { Mission } from "@/types/mission";

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
  const [missions, setMissions] = useState<Mission[]>([]);
  
  const [formData, setFormData] = useState({
    type_facture: 'VENTES' as 'VENTES' | 'ACHATS',
    numero_facture: '',
    date_emission: new Date().toISOString().split('T')[0],
    date_echeance: '',
    emetteur_type: '',
    emetteur_id: '',
    emetteur_nom: '',
    emetteur_adresse: '',
    emetteur_telephone: '',
    emetteur_email: '',
    destinataire_type: '',
    destinataire_id: '',
    destinataire_nom: '',
    destinataire_adresse: '',
    destinataire_telephone: '',
    destinataire_email: '',
    informations_paiement: '',
    reference_societe: '',
    statut: 'BROUILLON' as 'BROUILLON' | 'VALIDEE' | 'PAYEE' | 'ANNULEE',
  });

  const [lignes, setLignes] = useState<FactureLigne[]>([
    { ordre: 1, description: '', quantite: 1, prix_unitaire_ht: 0, prix_ht: 0, taux_tva: 20, montant_tva: 0, prix_ttc: 0 }
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
          numero_facture: '', // Pour une copie, on génère un nouveau numéro
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
        // Pour une nouvelle facture de vente, appliquer les données de société interne
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
        
        setFormData({
          type_facture: 'VENTES',
          numero_facture: '',
          date_emission: new Date().toISOString().split('T')[0],
          date_echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          emetteur_type: 'SOCIETE_INTERNE',
          emetteur_id: societeInterne.id,
          emetteur_nom: societeInterne.raison_sociale,
          emetteur_adresse: societeInterne.adresse || '',
          emetteur_telephone: societeInterne.telephone || '',
          emetteur_email: societeInterne.email || '',
          destinataire_type: 'CLIENT',
          destinataire_id: '',
          destinataire_nom: '',
          destinataire_adresse: '',
          destinataire_telephone: '',
          destinataire_email: '',
          informations_paiement: infoPaiement.trim(),
          reference_societe: societeInterne.siren || '',
          statut: 'BROUILLON',
        });
        setLignes([{ ordre: 1, description: '', quantite: 1, prix_unitaire_ht: 0, prix_ht: 0, taux_tva: 20, montant_tva: 0, prix_ttc: 0 }]);
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
    setLignes([{ ordre: 1, description: '', quantite: 1, prix_unitaire_ht: 0, prix_ht: 0, taux_tva: 20, montant_tva: 0, prix_ttc: 0 }]);
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

      // Récupérer les missions en cours avec TVA
      const { data: missionsData } = await supabase
        .from('missions')
        .select('*, tva(*)')
        .eq('statut', 'EN_COURS')
        .order('titre');
      setMissions((missionsData as Mission[]) || []);
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
      quantite: 1,
      prix_unitaire_ht: 0,
      prix_ht: 0,
      taux_tva: 20,
      montant_tva: 0,
      prix_ttc: 0
    }]);
  };

  const removeLigne = (index: number) => {
    if (lignes.length > 1) {
      setLignes(prev => prev.filter((_, i) => i !== index).map((l, i) => ({ ...l, ordre: i + 1 })));
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let numeroFacture = formData.numero_facture;
      
      // Pour les factures de vente, générer automatiquement le numéro
      if (formData.type_facture === 'VENTES') {
        const { data: numeroData, error: numeroError } = await supabase
          .rpc('generate_numero_facture', { p_type: formData.type_facture });

        if (numeroError) throw numeroError;
        numeroFacture = numeroData;
      } else if (formData.type_facture === 'ACHATS' && !numeroFacture) {
        // Pour les factures d'achat, vérifier que le numéro est saisi
        toast({
          title: "Erreur",
          description: "Veuillez saisir le numéro de facture fournisseur",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Créer la facture
      const { data: facture, error: factureError } = await supabase
        .from('factures')
        .insert({
          ...formData,
          numero_facture: numeroFacture,
        })
        .select()
        .single();

      if (factureError) throw factureError;

      // Créer les lignes de facture
      const lignesToInsert = lignes.map(ligne => ({
        facture_id: facture.id,
        ordre: ligne.ordre,
        description: ligne.description,
        quantite: ligne.quantite,
        prix_unitaire_ht: ligne.prix_unitaire_ht,
        prix_ht: ligne.prix_ht,
        taux_tva: ligne.taux_tva,
      }));

      const { error: lignesError } = await supabase
        .from('facture_lignes')
        .insert(lignesToInsert);

      if (lignesError) throw lignesError;

      // Générer le PDF pour les factures de vente
      if (formData.type_facture === 'VENTES') {
        try {
          const response = await supabase.functions.invoke('generate-facture-pdf', {
            body: { facture_id: facture.id }
          });
          
          if (response.error) {
            console.error('Erreur génération PDF:', response.error);
            toast({
              title: "Avertissement",
              description: "La facture a été créée mais le PDF n'a pas pu être généré",
              variant: "destructive",
            });
          } else if (response.data) {
            // Créer un blob à partir de la réponse
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            
            // Créer un lien de téléchargement
            const a = document.createElement('a');
            a.href = url;
            a.download = `facture_${numeroFacture.replace(/\//g, '-')}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Libérer l'URL
            window.URL.revokeObjectURL(url);
            
            toast({
              title: "Succès",
              description: "Facture créée et PDF généré avec succès",
            });
          }
        } catch (error) {
          console.error('Erreur lors de la génération du PDF:', error);
          toast({
            title: "Avertissement",
            description: "La facture a été créée mais le PDF n'a pas pu être généré",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Succès",
          description: "Facture créée avec succès",
        });
      }

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

          {/* Dates et Numéro de facture */}
          <div className="grid grid-cols-3 gap-4">
            {formData.type_facture === 'ACHATS' && (
              <div>
                <Label>Numéro de facture *</Label>
                <Input
                  type="text"
                  value={formData.numero_facture || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, numero_facture: e.target.value }))}
                  placeholder="N° facture fournisseur"
                  required={formData.type_facture === 'ACHATS'}
                />
              </div>
            )}
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
                              Tapez pour saisir une description personnalisée
                            </div>
                          </CommandEmpty>
                          <CommandGroup heading="Missions en cours">
                            {missions.map((mission) => (
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
                      onClick={() => removeLigne(index)}
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