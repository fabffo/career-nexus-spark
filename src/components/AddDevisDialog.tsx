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
import type { Devis, DevisLigne } from "@/types/devis";

interface AddDevisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialData?: (Devis & { lignes?: DevisLigne[] }) | null;
}

export default function AddDevisDialog({ open, onOpenChange, onSuccess, initialData }: AddDevisDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [societeInterne, setSocieteInterne] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [typesMission, setTypesMission] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    numero_devis: '',
    date_emission: new Date().toISOString().split('T')[0],
    date_echeance: '',
    date_validite: '',
    emetteur_type: 'SOCIETE_INTERNE',
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
    activite: 'Prestation',
  });

  const [lignes, setLignes] = useState<DevisLigne[]>([
    { ordre: 1, description: '', quantite: 1, prix_unitaire_ht: 0, prix_ht: 0, taux_tva: 20, montant_tva: 0, prix_ttc: 0 }
  ]);

  useEffect(() => {
    if (open) {
      if (initialData?.lignes && initialData.lignes.length > 0) {
        setLignes(initialData.lignes.map((l, i) => ({
          ordre: i + 1, description: l.description || '', quantite: l.quantite || 1,
          prix_unitaire_ht: l.prix_unitaire_ht || 0, prix_ht: l.prix_ht || 0,
          taux_tva: l.taux_tva || 20, montant_tva: l.montant_tva || 0, prix_ttc: l.prix_ttc || 0,
        })));
      }
      fetchData();
    } else {
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setFormData({
      numero_devis: '', date_emission: new Date().toISOString().split('T')[0],
      date_echeance: '', date_validite: '', emetteur_type: 'SOCIETE_INTERNE', emetteur_id: '', emetteur_nom: '',
      emetteur_adresse: '', emetteur_telephone: '', emetteur_email: '',
      destinataire_type: 'CLIENT', destinataire_id: '', destinataire_nom: '',
      destinataire_adresse: '', destinataire_telephone: '', destinataire_email: '',
      informations_paiement: '', reference_societe: '', activite: 'Prestation',
    });
    setLignes([{ ordre: 1, description: '', quantite: 1, prix_unitaire_ht: 0, prix_ht: 0, taux_tva: 20, montant_tva: 0, prix_ttc: 0 }]);
  };

  const fetchData = async () => {
    try {
      const [societeRes, clientsRes, typesRes] = await Promise.all([
        supabase.from('societe_interne').select('*').limit(1).maybeSingle(),
        supabase.from('clients').select('*').order('raison_sociale'),
        supabase.from('param_type_mission').select('code, libelle').eq('is_active', true).order('ordre'),
      ]);

      if (societeRes.data) {
        setSocieteInterne(societeRes.data);
        if (!initialData) {
          setFormData(prev => ({
            ...prev,
            emetteur_nom: societeRes.data.raison_sociale || '',
            emetteur_adresse: societeRes.data.adresse || '',
            emetteur_telephone: societeRes.data.telephone || '',
            emetteur_email: societeRes.data.email || '',
            emetteur_id: societeRes.data.id || '',
            informations_paiement: `IBAN: ${societeRes.data.iban || ''} - BIC: ${societeRes.data.bic || ''}`,
            reference_societe: societeRes.data.siren || '',
          }));
        }
      }
      if (clientsRes.data) setClients(clientsRes.data);
      if (typesRes.data) setTypesMission(typesRes.data);

      if (initialData) {
        setFormData({
          numero_devis: '', // Will be auto-generated
          date_emission: initialData.date_emission || new Date().toISOString().split('T')[0],
          date_echeance: initialData.date_echeance || '',
          date_validite: initialData.date_validite || '',
          emetteur_type: initialData.emetteur_type || 'SOCIETE_INTERNE',
          emetteur_id: initialData.emetteur_id || '',
          emetteur_nom: initialData.emetteur_nom || '',
          emetteur_adresse: initialData.emetteur_adresse || '',
          emetteur_telephone: initialData.emetteur_telephone || '',
          emetteur_email: initialData.emetteur_email || '',
          destinataire_type: initialData.destinataire_type || 'CLIENT',
          destinataire_id: initialData.destinataire_id || '',
          destinataire_nom: initialData.destinataire_nom || '',
          destinataire_adresse: initialData.destinataire_adresse || '',
          destinataire_telephone: initialData.destinataire_telephone || '',
          destinataire_email: initialData.destinataire_email || '',
          informations_paiement: initialData.informations_paiement || '',
          reference_societe: initialData.reference_societe || '',
          activite: initialData.activite || 'Prestation',
        });
      }

      // Generate devis number
      const { data: numData } = await supabase.rpc('get_next_devis_numero');
      if (numData) {
        setFormData(prev => ({ ...prev, numero_devis: numData }));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      const delai = client.delai_paiement_jours || 30;
      const dateEmission = new Date(formData.date_emission);
      const dateEcheance = new Date(dateEmission);
      dateEcheance.setDate(dateEcheance.getDate() + delai);

      setFormData(prev => ({
        ...prev,
        destinataire_id: client.id,
        destinataire_nom: client.raison_sociale,
        destinataire_adresse: client.adresse_ligne1 || '',
        destinataire_telephone: client.telephone || '',
        destinataire_email: client.email || '',
        date_echeance: dateEcheance.toISOString().split('T')[0],
      }));
    }
  };

  const updateLigne = (index: number, field: keyof DevisLigne, value: any) => {
    const updated = [...lignes];
    (updated[index] as any)[field] = value;
    if (field === 'quantite' || field === 'prix_unitaire_ht' || field === 'taux_tva') {
      const l = updated[index];
      l.prix_ht = Number((l.quantite * l.prix_unitaire_ht).toFixed(2));
      l.montant_tva = Number((l.prix_ht * l.taux_tva / 100).toFixed(2));
      l.prix_ttc = Number((l.prix_ht + (l.montant_tva || 0)).toFixed(2));
    }
    setLignes(updated);
  };

  const addLigne = () => {
    setLignes([...lignes, { ordre: lignes.length + 1, description: '', quantite: 1, prix_unitaire_ht: 0, prix_ht: 0, taux_tva: 20, montant_tva: 0, prix_ttc: 0 }]);
  };

  const removeLigne = (index: number) => {
    if (lignes.length <= 1) return;
    setLignes(lignes.filter((_, i) => i !== index).map((l, i) => ({ ...l, ordre: i + 1 })));
  };

  const totalHT = lignes.reduce((s, l) => s + l.prix_ht, 0);
  const totalTVA = lignes.reduce((s, l) => s + (l.montant_tva || 0), 0);
  const totalTTC = lignes.reduce((s, l) => s + (l.prix_ttc || 0), 0);

  const handleSubmit = async () => {
    if (!formData.destinataire_nom || lignes.every(l => !l.description)) {
      toast({ title: "Erreur", description: "Veuillez remplir les champs obligatoires", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: devisData, error: devisError } = await supabase
        .from('devis')
        .insert({
          numero_devis: formData.numero_devis,
          date_emission: formData.date_emission,
          date_echeance: formData.date_echeance,
          date_validite: formData.date_validite || null,
          emetteur_type: formData.emetteur_type,
          emetteur_id: formData.emetteur_id || null,
          emetteur_nom: formData.emetteur_nom,
          emetteur_adresse: formData.emetteur_adresse || null,
          emetteur_telephone: formData.emetteur_telephone || null,
          emetteur_email: formData.emetteur_email || null,
          destinataire_type: formData.destinataire_type,
          destinataire_id: formData.destinataire_id || null,
          destinataire_nom: formData.destinataire_nom,
          destinataire_adresse: formData.destinataire_adresse || null,
          destinataire_telephone: formData.destinataire_telephone || null,
          destinataire_email: formData.destinataire_email || null,
          total_ht: totalHT,
          total_tva: totalTVA,
          total_ttc: totalTTC,
          informations_paiement: formData.informations_paiement || null,
          reference_societe: formData.reference_societe || null,
          activite: formData.activite || null,
          statut: 'ENCOURS',
        })
        .select()
        .single();

      if (devisError) throw devisError;

      const lignesData = lignes.filter(l => l.description).map(l => ({
        devis_id: devisData.id,
        ordre: l.ordre,
        description: l.description,
        quantite: l.quantite,
        prix_unitaire_ht: l.prix_unitaire_ht,
        prix_ht: l.prix_ht,
        taux_tva: l.taux_tva,
        montant_tva: l.montant_tva || 0,
        prix_ttc: l.prix_ttc || 0,
      }));

      if (lignesData.length > 0) {
        const { error: lignesError } = await supabase.from('devis_lignes').insert(lignesData);
        if (lignesError) throw lignesError;
      }

      toast({ title: "Succès", description: "Devis créé avec succès" });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau Devis</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Infos générales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>N° Devis</Label>
              <Input value={formData.numero_devis} readOnly className="bg-muted" />
            </div>
            <div>
              <Label>Date émission</Label>
              <Input type="date" value={formData.date_emission} onChange={e => setFormData(p => ({ ...p, date_emission: e.target.value }))} />
            </div>
            <div>
              <Label>Date échéance</Label>
              <Input type="date" value={formData.date_echeance} onChange={e => setFormData(p => ({ ...p, date_echeance: e.target.value }))} />
            </div>
            <div>
              <Label>Date validité</Label>
              <Input type="date" value={formData.date_validite} onChange={e => setFormData(p => ({ ...p, date_validite: e.target.value }))} />
            </div>
          </div>

          {/* Activité */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Activité</Label>
              <Select value={formData.activite} onValueChange={v => setFormData(p => ({ ...p, activite: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {typesMission.map(t => (
                    <SelectItem key={t.code} value={t.code}>{t.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Émetteur (auto) */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-sm">Émetteur</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nom</Label><Input value={formData.emetteur_nom} readOnly className="bg-muted" /></div>
              <div><Label>Email</Label><Input value={formData.emetteur_email} readOnly className="bg-muted" /></div>
            </div>
          </div>

          {/* Destinataire */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-sm">Client destinataire</h3>
            <Select value={formData.destinataire_id} onValueChange={handleClientChange}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.raison_sociale}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nom</Label><Input value={formData.destinataire_nom} onChange={e => setFormData(p => ({ ...p, destinataire_nom: e.target.value }))} /></div>
              <div><Label>Email</Label><Input value={formData.destinataire_email} onChange={e => setFormData(p => ({ ...p, destinataire_email: e.target.value }))} /></div>
              <div><Label>Adresse</Label><Input value={formData.destinataire_adresse} onChange={e => setFormData(p => ({ ...p, destinataire_adresse: e.target.value }))} /></div>
              <div><Label>Téléphone</Label><Input value={formData.destinataire_telephone} onChange={e => setFormData(p => ({ ...p, destinataire_telephone: e.target.value }))} /></div>
            </div>
          </div>

          {/* Lignes */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">Lignes du devis</h3>
              <Button type="button" variant="outline" size="sm" onClick={addLigne}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
            </div>
            {lignes.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded p-2">
                <div className="col-span-4">
                  <Label className="text-xs">Description</Label>
                  <Input value={l.description} onChange={e => updateLigne(i, 'description', e.target.value)} />
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">Qté</Label>
                  <Input type="number" value={l.quantite} onChange={e => updateLigne(i, 'quantite', Number(e.target.value))} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">PU HT</Label>
                  <Input type="number" step="0.01" value={l.prix_unitaire_ht} onChange={e => updateLigne(i, 'prix_unitaire_ht', Number(e.target.value))} />
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">TVA %</Label>
                  <Input type="number" value={l.taux_tva} onChange={e => updateLigne(i, 'taux_tva', Number(e.target.value))} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Total HT</Label>
                  <Input value={l.prix_ht.toFixed(2)} readOnly className="bg-muted" />
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">TTC</Label>
                  <Input value={(l.prix_ttc || 0).toFixed(2)} readOnly className="bg-muted" />
                </div>
                <div className="col-span-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeLigne(i)} disabled={lignes.length <= 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Totaux */}
          <div className="flex justify-end">
            <div className="space-y-1 text-right text-sm">
              <p>Total HT: <span className="font-bold">{totalHT.toFixed(2)} €</span></p>
              <p>Total TVA: <span className="font-bold">{totalTVA.toFixed(2)} €</span></p>
              <p className="text-base">Total TTC: <span className="font-bold">{totalTTC.toFixed(2)} €</span></p>
            </div>
          </div>

          {/* Paiement */}
          <div>
            <Label>Informations de paiement</Label>
            <Textarea value={formData.informations_paiement} onChange={e => setFormData(p => ({ ...p, informations_paiement: e.target.value }))} rows={3} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={loading}>{loading ? "Enregistrement..." : "Créer le devis"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
