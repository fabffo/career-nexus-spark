import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Upload, X } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useFileUpload } from "@/hooks/useFileUpload";

interface AddFactureAchatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Fournisseur {
  id: string;
  raison_sociale: string;
  type: 'GENERAL' | 'SERVICE';
}

interface Prestataire {
  id: string;
  nom: string;
  prenom: string;
}

export default function AddFactureAchatDialog({ open, onOpenChange, onSuccess }: AddFactureAchatDialogProps) {
  const [loading, setLoading] = useState(false);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { uploadFile, isUploading } = useFileUpload();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    numero_facture: '',
    date_emission: new Date(),
    fournisseur_type: '',
    fournisseur_id: '',
    montant_ht: '',
    montant_tva: '',
    statut: 'BROUILLON' as const,
  });

  useEffect(() => {
    if (open) {
      fetchData();
      resetForm();
    }
  }, [open]);

  const fetchData = async () => {
    try {
      // Récupérer les fournisseurs généraux
      const { data: fg, error: fgError } = await supabase
        .from('fournisseurs_generaux')
        .select('id, raison_sociale')
        .order('raison_sociale');

      if (fgError) throw fgError;

      // Récupérer les fournisseurs de services
      const { data: fs, error: fsError } = await supabase
        .from('fournisseurs_services')
        .select('id, raison_sociale')
        .order('raison_sociale');

      if (fsError) throw fsError;

      // Récupérer les prestataires
      const { data: prest, error: prestError } = await supabase
        .from('prestataires')
        .select('id, nom, prenom')
        .order('nom');

      if (prestError) throw prestError;

      // Combiner les fournisseurs
      const allFournisseurs = [
        ...(fg || []).map(f => ({ ...f, type: 'GENERAL' as const })),
        ...(fs || []).map(f => ({ ...f, type: 'SERVICE' as const })),
      ];

      setFournisseurs(allFournisseurs);
      setPrestataires(prest || []);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      numero_facture: '',
      date_emission: new Date(),
      fournisseur_type: '',
      fournisseur_id: '',
      montant_ht: '',
      montant_tva: '',
      statut: 'BROUILLON',
    });
    setSelectedFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const calculateMontantTTC = () => {
    const ht = parseFloat(formData.montant_ht) || 0;
    const tva = parseFloat(formData.montant_tva) || 0;
    return ht + tva;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.numero_facture || !formData.fournisseur_id || !formData.montant_ht) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Récupérer les informations du fournisseur ou prestataire
      let emetteurNom = '';
      let emetteurType = '';
      let emetteurId = '';

      if (formData.fournisseur_type === 'PRESTATAIRE') {
        const prestataire = prestataires.find(p => p.id === formData.fournisseur_id);
        if (prestataire) {
          emetteurNom = `${prestataire.prenom} ${prestataire.nom}`;
          emetteurType = 'PRESTATAIRE';
          emetteurId = prestataire.id;
        }
      } else {
        const fournisseur = fournisseurs.find(f => f.id === formData.fournisseur_id);
        if (fournisseur) {
          emetteurNom = fournisseur.raison_sociale;
          emetteurType = fournisseur.type === 'GENERAL' ? 'FOURNISSEUR_GENERAL' : 'FOURNISSEUR_SERVICE';
          emetteurId = fournisseur.id;
        }
      }

      // Upload du fichier si présent
      let factureUrl = null;
      if (selectedFile) {
        // Uploader dans le bucket factures (privé)
        factureUrl = await uploadFile(selectedFile, 'factures');
      }

      // Récupérer les infos de la société interne comme destinataire
      const { data: societeData, error: societeError } = await supabase
        .from('societe_interne')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (societeError) throw societeError;

      if (!societeData) {
        toast({
          title: "Erreur",
          description: "Aucune société interne configurée. Veuillez configurer la société dans les paramètres.",
          variant: "destructive",
        });
        return;
      }

      const montantHT = parseFloat(formData.montant_ht);
      const montantTVA = parseFloat(formData.montant_tva) || 0;
      const montantTTC = montantHT + montantTVA;

      // Créer la facture (sans select car les politiques RLS peuvent bloquer la lecture immédiate)
      const { error: factureError } = await supabase
        .from('factures')
        .insert({
          numero_facture: formData.numero_facture,
          type_facture: 'ACHATS',
          date_emission: format(formData.date_emission, 'yyyy-MM-dd'),
          date_echeance: format(formData.date_emission, 'yyyy-MM-dd'),
          emetteur_type: emetteurType,
          emetteur_id: emetteurId,
          emetteur_nom: emetteurNom,
          destinataire_type: 'SOCIETE_INTERNE',
          destinataire_id: societeData?.id,
          destinataire_nom: societeData?.raison_sociale || '',
          destinataire_adresse: societeData?.adresse,
          destinataire_telephone: societeData?.telephone,
          destinataire_email: societeData?.email,
          total_ht: montantHT,
          total_tva: montantTVA,
          total_ttc: montantTTC,
          statut: formData.statut,
          reference_societe: factureUrl,
        });

      if (factureError) throw factureError;

      toast({
        title: "Succès",
        description: "Facture d'achat créée avec succès",
      });

      onSuccess();
    } catch (error: any) {
      console.error('Erreur lors de la création de la facture:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la facture d'achat",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle facture d'achat</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Numéro de facture */}
          <div className="space-y-2">
            <Label htmlFor="numero_facture">
              Numéro de facture <span className="text-destructive">*</span>
            </Label>
            <Input
              id="numero_facture"
              value={formData.numero_facture}
              onChange={(e) => setFormData({ ...formData, numero_facture: e.target.value })}
              placeholder="Ex: FA-2024-001"
              required
            />
          </div>

          {/* Date d'émission */}
          <div className="space-y-2">
            <Label>
              Date d'émission <span className="text-destructive">*</span>
            </Label>
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
                    format(formData.date_emission, "dd/MM/yyyy", { locale: fr })
                  ) : (
                    <span>Sélectionner une date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.date_emission}
                  onSelect={(date) => date && setFormData({ ...formData, date_emission: date })}
                  locale={fr}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Type de fournisseur */}
          <div className="space-y-2">
            <Label>
              Type de fournisseur <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.fournisseur_type}
              onValueChange={(value) => setFormData({ ...formData, fournisseur_type: value, fournisseur_id: '' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FOURNISSEUR">Fournisseur</SelectItem>
                <SelectItem value="PRESTATAIRE">Prestataire</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sélection du fournisseur ou prestataire */}
          {formData.fournisseur_type && (
            <div className="space-y-2">
              <Label>
                {formData.fournisseur_type === 'PRESTATAIRE' ? 'Prestataire' : 'Fournisseur'}{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.fournisseur_id}
                onValueChange={(value) => setFormData({ ...formData, fournisseur_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {formData.fournisseur_type === 'PRESTATAIRE'
                    ? prestataires.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.prenom} {p.nom}
                        </SelectItem>
                      ))
                    : fournisseurs.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.raison_sociale}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Montant HT */}
          <div className="space-y-2">
            <Label htmlFor="montant_ht">
              Montant HT (€) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="montant_ht"
              type="number"
              step="0.01"
              min="0"
              value={formData.montant_ht}
              onChange={(e) => setFormData({ ...formData, montant_ht: e.target.value })}
              placeholder="0.00"
              required
            />
          </div>

          {/* Montant TVA */}
          <div className="space-y-2">
            <Label htmlFor="montant_tva">Montant TVA (€)</Label>
            <Input
              id="montant_tva"
              type="number"
              step="0.01"
              min="0"
              value={formData.montant_tva}
              onChange={(e) => setFormData({ ...formData, montant_tva: e.target.value })}
              placeholder="0.00"
            />
          </div>

          {/* Montant TTC (calculé) */}
          <div className="space-y-2">
            <Label>Montant TTC (€)</Label>
            <div className="p-2 bg-muted rounded-md font-medium">
              {new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR',
              }).format(calculateMontantTTC())}
            </div>
          </div>

          {/* Upload de fichier */}
          <div className="space-y-2">
            <Label htmlFor="file">Fichier de la facture</Label>
            {selectedFile ? (
              <div className="flex items-center gap-2 p-2 border rounded-md">
                <span className="flex-1 text-sm truncate">{selectedFile.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-md p-4">
                <label htmlFor="file" className="cursor-pointer flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Cliquez pour sélectionner un fichier
                  </span>
                  <input
                    id="file"
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Statut */}
          <div className="space-y-2">
            <Label>Statut</Label>
            <Select
              value={formData.statut}
              onValueChange={(value: any) => setFormData({ ...formData, statut: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BROUILLON">Brouillon</SelectItem>
                <SelectItem value="VALIDEE">Validée</SelectItem>
                <SelectItem value="PAYEE">Payée</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading || isUploading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading || isUploading}>
              {loading || isUploading ? "Création en cours..." : "Créer la facture"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
