import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FileText, Calendar, DollarSign } from "lucide-react";

interface CreateFactureFromCRADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  craData: {
    id: string;
    mission_id: string;
    prestataire_id?: string;
    salarie_id?: string;
    annee: number;
    mois: number;
    ca_mensuel: number;
    jours_travailles: number;
    mission?: any;
  };
  onSuccess: () => void;
}

export default function CreateFactureFromCRADialog({
  open,
  onOpenChange,
  craData,
  onSuccess
}: CreateFactureFromCRADialogProps) {
  const [loading, setLoading] = useState(false);
  const [tvaRates, setTvaRates] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    date_emission: format(new Date(), 'yyyy-MM-dd'),
    date_echeance: format(new Date(new Date().setDate(new Date().getDate() + 30)), 'yyyy-MM-dd'),
    tva_id: '',
    taux_tva: 20,
    notes: `Facture pour le mois de ${format(new Date(craData.annee, craData.mois - 1), 'MMMM yyyy', { locale: fr })}`,
    description: `Prestation ${craData.mission?.titre || ''} - ${format(new Date(craData.annee, craData.mois - 1), 'MMMM yyyy', { locale: fr })}`
  });

  useEffect(() => {
    if (open) {
      loadTVA();
    }
  }, [open]);

  const loadTVA = async () => {
    try {
      const { data, error } = await supabase
        .from('tva')
        .select('*')
        .order('taux', { ascending: false });

      if (error) throw error;
      setTvaRates(data || []);

      // Sélectionner la TVA par défaut (20%)
      const defaultTva = data?.find(t => t.is_default) || data?.[0];
      if (defaultTva) {
        setFormData(prev => ({
          ...prev,
          tva_id: defaultTva.id,
          taux_tva: defaultTva.taux
        }));
      }
    } catch (error) {
      console.error('Erreur chargement TVA:', error);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!craData.mission?.contrat?.client) {
      toast.error("Impossible de créer la facture : client introuvable");
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Calculer les montants
      const montant_ht = craData.ca_mensuel;
      const montant_tva = montant_ht * (formData.taux_tva / 100);
      const montant_ttc = montant_ht + montant_tva;

      // Obtenir le numéro de facture
      const { data: numeroData, error: numeroError } = await supabase
        .rpc('generate_numero_facture', { p_type: 'VENTES' });

      if (numeroError) throw numeroError;

      // Obtenir les informations du client
      const client = craData.mission.contrat.client;

      // Créer la facture
      const { data: facture, error: factureError } = await supabase
        .from('factures')
        .insert({
          numero_facture: numeroData,
          type_facture: 'VENTES',
          destinataire_id: client.id,
          destinataire_type: 'CLIENT',
          destinataire_nom: client.raison_sociale || '',
          destinataire_email: client.email || null,
          destinataire_adresse: client.adresse || null,
          destinataire_telephone: client.telephone || null,
          emetteur_type: 'SOCIETE',
          emetteur_nom: 'Votre Société', // À adapter selon votre configuration
          date_emission: formData.date_emission,
          date_echeance: formData.date_echeance,
          statut: 'BROUILLON',
          total_ht: montant_ht,
          total_tva: montant_tva,
          total_ttc: montant_ttc,
          created_by: user.id
        })
        .select()
        .single();

      if (factureError) throw factureError;

      // Créer la ligne de facture
      const { error: ligneError } = await supabase
        .from('facture_lignes')
        .insert({
          facture_id: facture.id,
          description: formData.description,
          quantite: craData.jours_travailles,
          prix_unitaire_ht: craData.mission?.tjm || craData.mission?.prix_ht || 0,
          taux_tva: formData.taux_tva,
          montant_tva: montant_tva,
          prix_ht: montant_ht,
          prix_ttc: montant_ttc,
          ordre: 1
        });

      if (ligneError) throw ligneError;

      toast.success("Facture créée avec succès");
      onSuccess();
      onOpenChange(false);
      
    } catch (error: any) {
      console.error('Erreur création facture:', error);
      toast.error(error.message || "Erreur lors de la création de la facture");
    } finally {
      setLoading(false);
    }
  };

  const montant_ht = craData.ca_mensuel;
  const montant_tva = montant_ht * (formData.taux_tva / 100);
  const montant_ttc = montant_ht + montant_tva;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Créer une facture depuis le CRA
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Informations CRA */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h3 className="font-medium">Informations du CRA</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Client:</span>
                <p className="font-medium">{craData.mission?.contrat?.client?.raison_sociale || 'N/A'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Mission:</span>
                <p className="font-medium">{craData.mission?.titre || 'N/A'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Période:</span>
                <p className="font-medium">
                  {format(new Date(craData.annee, craData.mois - 1), 'MMMM yyyy', { locale: fr })}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Jours travaillés:</span>
                <p className="font-medium">{craData.jours_travailles} jours</p>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date_emission">
                <Calendar className="h-4 w-4 inline mr-2" />
                Date d'émission *
              </Label>
              <Input
                id="date_emission"
                type="date"
                value={formData.date_emission}
                onChange={(e) => setFormData({ ...formData, date_emission: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_echeance">
                <Calendar className="h-4 w-4 inline mr-2" />
                Date d'échéance *
              </Label>
              <Input
                id="date_echeance"
                type="date"
                value={formData.date_echeance}
                onChange={(e) => setFormData({ ...formData, date_echeance: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description de la ligne</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description de la prestation"
            />
          </div>

          {/* TVA */}
          <div className="space-y-2">
            <Label htmlFor="tva_id">TVA</Label>
            <Select value={formData.tva_id} onValueChange={handleTvaChange}>
              <SelectTrigger id="tva_id">
                <SelectValue placeholder="Sélectionner un taux de TVA" />
              </SelectTrigger>
              <SelectContent>
                {tvaRates.map((tva) => (
                  <SelectItem key={tva.id} value={tva.id}>
                    {tva.libelle} ({tva.taux}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Montants (lecture seule) */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h3 className="font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Montants
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total HT:</span>
                <p className="font-medium text-lg">{montant_ht.toFixed(2)} €</p>
              </div>
              <div>
                <span className="text-muted-foreground">TVA ({formData.taux_tva}%):</span>
                <p className="font-medium text-lg">{montant_tva.toFixed(2)} €</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total TTC:</span>
                <p className="font-medium text-lg">{montant_ttc.toFixed(2)} €</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notes ou commentaires sur la facture"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
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
