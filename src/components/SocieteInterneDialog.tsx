import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Save, Loader2 } from 'lucide-react';

interface SocieteInterneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SocieteInterneDialog({ open, onOpenChange }: SocieteInterneDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    raison_sociale: '',
    adresse: '',
    telephone: '',
    email: '',
    capital_social: '',
    siren: '',
    tva: '',
    reference_bancaire: '',
    etablissement_bancaire: '',
    iban: '',
    bic: ''
  });

  useEffect(() => {
    if (open) {
      fetchSocieteData();
    }
  }, [open]);

  const fetchSocieteData = async () => {
    try {
      setFetching(true);
      const { data, error } = await supabase
        .from('societe_interne')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setFormData({
          raison_sociale: data.raison_sociale || '',
          adresse: data.adresse || '',
          telephone: data.telephone || '',
          email: data.email || '',
          capital_social: data.capital_social ? String(data.capital_social) : '',
          siren: data.siren || '',
          tva: data.tva || '',
          reference_bancaire: data.reference_bancaire || '',
          etablissement_bancaire: data.etablissement_bancaire || '',
          iban: data.iban || '',
          bic: data.bic || ''
        });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des données:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de récupérer les informations de la société',
        variant: 'destructive'
      });
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Vérifier si une entrée existe déjà
      const { data: existing } = await supabase
        .from('societe_interne')
        .select('id')
        .single();

      if (existing) {
        // Mise à jour
        const { error } = await supabase
          .from('societe_interne')
          .update({
            ...formData,
            capital_social: formData.capital_social ? parseFloat(formData.capital_social) : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Création
        const { error } = await supabase
          .from('societe_interne')
          .insert({
            ...formData,
            capital_social: formData.capital_social ? parseFloat(formData.capital_social) : null
          });

        if (error) throw error;
      }

      toast({
        title: 'Succès',
        description: 'Les informations de la société ont été enregistrées'
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'enregistrer les informations',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (fetching) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Informations de la société interne</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Coordonnées</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="raison_sociale">Raison sociale *</Label>
                <Input
                  id="raison_sociale"
                  value={formData.raison_sociale}
                  onChange={(e) => handleChange('raison_sociale', e.target.value)}
                  required
                  placeholder="Nom de la société"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capital_social">Capital social (€)</Label>
                <Input
                  id="capital_social"
                  type="number"
                  step="0.01"
                  value={formData.capital_social}
                  onChange={(e) => handleChange('capital_social', e.target.value)}
                  placeholder="800.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="siren">N° SIREN</Label>
                <Input
                  id="siren"
                  value={formData.siren}
                  onChange={(e) => handleChange('siren', e.target.value)}
                  placeholder="834.114.837"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tva">N° de TVA</Label>
                <Input
                  id="tva"
                  value={formData.tva}
                  onChange={(e) => handleChange('tva', e.target.value)}
                  placeholder="FR21834114837"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telephone">Téléphone</Label>
                <Input
                  id="telephone"
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => handleChange('telephone', e.target.value)}
                  placeholder="+33 1 23 45 67 89"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="contact@societe.fr"
                />
              </div>

              <div className="col-span-full space-y-2">
                <Label htmlFor="adresse">Adresse</Label>
                <Textarea
                  id="adresse"
                  value={formData.adresse}
                  onChange={(e) => handleChange('adresse', e.target.value)}
                  placeholder="Adresse complète de la société"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informations bancaires</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="etablissement_bancaire">Établissement bancaire</Label>
                <Input
                  id="etablissement_bancaire"
                  value={formData.etablissement_bancaire}
                  onChange={(e) => handleChange('etablissement_bancaire', e.target.value)}
                  placeholder="CREDIT AGRICOLE"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference_bancaire">Référence bancaire</Label>
                <Input
                  id="reference_bancaire"
                  value={formData.reference_bancaire}
                  onChange={(e) => handleChange('reference_bancaire', e.target.value)}
                  placeholder="XXXXXXXXXXXXSAS"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="iban">IBAN</Label>
                <Input
                  id="iban"
                  value={formData.iban}
                  onChange={(e) => handleChange('iban', e.target.value)}
                  placeholder="FR999999999999999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bic">BIC</Label>
                <Input
                  id="bic"
                  value={formData.bic}
                  onChange={(e) => handleChange('bic', e.target.value)}
                  placeholder="A9999999999999"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}