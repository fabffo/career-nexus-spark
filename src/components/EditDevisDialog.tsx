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

interface EditDevisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  devis: Devis | null;
}

export default function EditDevisDialog({ open, onOpenChange, onSuccess, devis }: EditDevisDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [typesMission, setTypesMission] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    numero_devis: '', date_emission: '', date_echeance: '', date_validite: '',
    emetteur_nom: '', emetteur_adresse: '', emetteur_telephone: '', emetteur_email: '', emetteur_id: '',
    destinataire_type: 'CLIENT', destinataire_id: '', destinataire_nom: '',
    destinataire_adresse: '', destinataire_telephone: '', destinataire_email: '',
    informations_paiement: '', reference_societe: '', activite: '',
    statut: 'ENCOURS' as string,
  });

  const [lignes, setLignes] = useState<DevisLigne[]>([]);

  useEffect(() => {
    if (open && devis) {
      fetchData();
    }
  }, [open, devis]);

  const fetchData = async () => {
    if (!devis) return;
    const [clientsRes, typesRes, lignesRes] = await Promise.all([
      supabase.from('clients').select('*').order('raison_sociale'),
      supabase.from('param_type_mission').select('code, libelle').eq('is_active', true).order('ordre'),
      supabase.from('devis_lignes').select('*').eq('devis_id', devis.id).order('ordre'),
    ]);

    if (clientsRes.data) setClients(clientsRes.data);
    if (typesRes.data) setTypesMission(typesRes.data);

    setFormData({
      numero_devis: devis.numero_devis,
      date_emission: devis.date_emission, date_echeance: devis.date_echeance,
      date_validite: devis.date_validite || '',
      emetteur_nom: devis.emetteur_nom, emetteur_adresse: devis.emetteur_adresse || '',
      emetteur_telephone: devis.emetteur_telephone || '', emetteur_email: devis.emetteur_email || '',
      emetteur_id: devis.emetteur_id || '',
      destinataire_type: devis.destinataire_type, destinataire_id: devis.destinataire_id || '',
      destinataire_nom: devis.destinataire_nom, destinataire_adresse: devis.destinataire_adresse || '',
      destinataire_telephone: devis.destinataire_telephone || '', destinataire_email: devis.destinataire_email || '',
      informations_paiement: devis.informations_paiement || '', reference_societe: devis.reference_societe || '',
      activite: devis.activite || '', statut: devis.statut,
    });

    if (lignesRes.data && lignesRes.data.length > 0) {
      setLignes(lignesRes.data.map((l: any) => ({
        id: l.id, devis_id: l.devis_id, ordre: l.ordre, description: l.description,
        quantite: Number(l.quantite), prix_unitaire_ht: Number(l.prix_unitaire_ht),
        prix_ht: Number(l.prix_ht), taux_tva: Number(l.taux_tva),
        montant_tva: Number(l.montant_tva || 0), prix_ttc: Number(l.prix_ttc || 0),
      })));
    } else {
      setLignes([{ ordre: 1, description: '', quantite: 1, prix_unitaire_ht: 0, prix_ht: 0, taux_tva: 20, montant_tva: 0, prix_ttc: 0 }]);
    }
  };

  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setFormData(prev => ({
        ...prev, destinataire_id: client.id, destinataire_nom: client.raison_sociale,
        destinataire_adresse: client.adresse_ligne1 || '', destinataire_telephone: client.telephone || '',
        destinataire_email: client.email || '',
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
    if (!devis) return;
    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('devis')
        .update({
          date_emission: formData.date_emission, date_echeance: formData.date_echeance,
          date_validite: formData.date_validite || null,
          destinataire_type: formData.destinataire_type, destinataire_id: formData.destinataire_id || null,
          destinataire_nom: formData.destinataire_nom, destinataire_adresse: formData.destinataire_adresse || null,
          destinataire_telephone: formData.destinataire_telephone || null, destinataire_email: formData.destinataire_email || null,
          total_ht: totalHT, total_tva: totalTVA, total_ttc: totalTTC,
          informations_paiement: formData.informations_paiement || null,
          reference_societe: formData.reference_societe || null, activite: formData.activite || null,
          statut: formData.statut,
        })
        .eq('id', devis.id);

      if (updateError) throw updateError;

      // Delete old lines and insert new ones
      await supabase.from('devis_lignes').delete().eq('devis_id', devis.id);
      
      const lignesData = lignes.filter(l => l.description).map(l => ({
        devis_id: devis.id, ordre: l.ordre, description: l.description,
        quantite: l.quantite, prix_unitaire_ht: l.prix_unitaire_ht, prix_ht: l.prix_ht,
        taux_tva: l.taux_tva, montant_tva: l.montant_tva || 0, prix_ttc: l.prix_ttc || 0,
      }));

      if (lignesData.length > 0) {
        const { error: lignesError } = await supabase.from('devis_lignes').insert(lignesData);
        if (lignesError) throw lignesError;
      }

      toast({ title: "Succès", description: "Devis modifié avec succès" });
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
          <DialogTitle>Modifier le devis {formData.numero_devis}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><Label>N° Devis</Label><Input value={formData.numero_devis} readOnly className="bg-muted" /></div>
            <div><Label>Date émission</Label><Input type="date" value={formData.date_emission} onChange={e => setFormData(p => ({ ...p, date_emission: e.target.value }))} /></div>
            <div><Label>Date échéance</Label><Input type="date" value={formData.date_echeance} onChange={e => setFormData(p => ({ ...p, date_echeance: e.target.value }))} /></div>
            <div><Label>Date validité</Label><Input type="date" value={formData.date_validite} onChange={e => setFormData(p => ({ ...p, date_validite: e.target.value }))} /></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Activité</Label>
              <Select value={formData.activite} onValueChange={v => setFormData(p => ({ ...p, activite: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {typesMission.map(t => (<SelectItem key={t.code} value={t.code}>{t.libelle}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={formData.statut} onValueChange={v => setFormData(p => ({ ...p, statut: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENCOURS">En cours</SelectItem>
                  <SelectItem value="REALISE">Réalisé</SelectItem>
                  <SelectItem value="ANNULE">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-sm">Client destinataire</h3>
            <Select value={formData.destinataire_id} onValueChange={handleClientChange}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => (<SelectItem key={c.id} value={c.id}>{c.raison_sociale}</SelectItem>))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nom</Label><Input value={formData.destinataire_nom} onChange={e => setFormData(p => ({ ...p, destinataire_nom: e.target.value }))} /></div>
              <div><Label>Email</Label><Input value={formData.destinataire_email} onChange={e => setFormData(p => ({ ...p, destinataire_email: e.target.value }))} /></div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">Lignes du devis</h3>
              <Button type="button" variant="outline" size="sm" onClick={addLigne}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
            </div>
            {lignes.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded p-2">
                <div className="col-span-4"><Label className="text-xs">Description</Label><Input value={l.description} onChange={e => updateLigne(i, 'description', e.target.value)} /></div>
                <div className="col-span-1"><Label className="text-xs">Qté</Label><Input type="number" value={l.quantite} onChange={e => updateLigne(i, 'quantite', Number(e.target.value))} /></div>
                <div className="col-span-2"><Label className="text-xs">PU HT</Label><Input type="number" step="0.01" value={l.prix_unitaire_ht} onChange={e => updateLigne(i, 'prix_unitaire_ht', Number(e.target.value))} /></div>
                <div className="col-span-1"><Label className="text-xs">TVA %</Label><Input type="number" value={l.taux_tva} onChange={e => updateLigne(i, 'taux_tva', Number(e.target.value))} /></div>
                <div className="col-span-2"><Label className="text-xs">Total HT</Label><Input value={l.prix_ht.toFixed(2)} readOnly className="bg-muted" /></div>
                <div className="col-span-1"><Label className="text-xs">TTC</Label><Input value={(l.prix_ttc || 0).toFixed(2)} readOnly className="bg-muted" /></div>
                <div className="col-span-1"><Button type="button" variant="ghost" size="icon" onClick={() => removeLigne(i)} disabled={lignes.length <= 1}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <div className="space-y-1 text-right text-sm">
              <p>Total HT: <span className="font-bold">{totalHT.toFixed(2)} €</span></p>
              <p>Total TVA: <span className="font-bold">{totalTVA.toFixed(2)} €</span></p>
              <p className="text-base">Total TTC: <span className="font-bold">{totalTTC.toFixed(2)} €</span></p>
            </div>
          </div>

          <div><Label>Informations de paiement</Label><Textarea value={formData.informations_paiement} onChange={e => setFormData(p => ({ ...p, informations_paiement: e.target.value }))} rows={3} /></div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={loading}>{loading ? "Enregistrement..." : "Modifier"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
