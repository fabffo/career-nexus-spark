import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ParamActivite {
  code: string;
  libelle: string;
}

interface CreateFournisseurQuickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (fournisseurId: string, type: 'GENERAL' | 'SERVICE') => void;
  initialData?: {
    raison_sociale?: string;
    adresse?: string;
    telephone?: string;
    email?: string;
  };
}

export default function CreateFournisseurQuickDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  initialData 
}: CreateFournisseurQuickDialogProps) {
  const [loading, setLoading] = useState(false);
  const [activites, setActivites] = useState<ParamActivite[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    type: '' as 'GENERAL' | 'SERVICE' | '',
    raison_sociale: '',
    secteur_activite: '',
    activite: '',
    adresse: '',
    telephone: '',
    email: '',
    site_web: '',
  });

  const resetForm = () => {
    setFormData({
      type: '',
      raison_sociale: '',
      secteur_activite: '',
      activite: '',
      adresse: '',
      telephone: '',
      email: '',
      site_web: '',
    });
  };

  useEffect(() => {
    const fetchActivites = async () => {
      const { data } = await supabase
        .from("param_activite")
        .select("code, libelle")
        .order("libelle");
      if (data) setActivites(data);
    };
    fetchActivites();
  }, []);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          type: '',
          raison_sociale: initialData.raison_sociale || '',
          secteur_activite: '',
          activite: '',
          adresse: initialData.adresse || '',
          telephone: initialData.telephone || '',
          email: initialData.email || '',
          site_web: '',
        });
      } else {
        resetForm();
      }
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.type || !formData.raison_sociale) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const table = formData.type === 'GENERAL' ? 'fournisseurs_generaux' : 'fournisseurs_services';
      
      const insertData: any = {
          raison_sociale: formData.raison_sociale,
          secteur_activite: formData.secteur_activite || null,
          adresse: formData.adresse || null,
          telephone: formData.telephone || null,
          email: formData.email || null,
          site_web: formData.site_web || null,
        };
      if (formData.activite) {
        insertData.activite = formData.activite;
      }

      const { data, error } = await supabase
        .from(table)
        .insert(insertData)
        .select('id')
        .single();

      if (error) throw error;

      toast({
        title: "Succès",
        description: "Fournisseur créé avec succès",
      });

      resetForm();
      onSuccess(data.id, formData.type);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erreur lors de la création du fournisseur:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le fournisseur",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un nouveau fournisseur</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type de fournisseur */}
          <div className="space-y-2">
            <Label>
              Type de fournisseur <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value: 'GENERAL' | 'SERVICE') => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SERVICE">Fournisseur de services</SelectItem>
                <SelectItem value="GENERAL">Fournisseur général</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Raison sociale */}
          <div className="space-y-2">
            <Label htmlFor="raison_sociale">
              Raison sociale <span className="text-destructive">*</span>
            </Label>
            <Input
              id="raison_sociale"
              value={formData.raison_sociale}
              onChange={(e) => setFormData({ ...formData, raison_sociale: e.target.value })}
              placeholder="Ex: ABC Services"
              required
            />
          </div>

          {/* Secteur d'activité */}
          <div className="space-y-2">
            <Label htmlFor="secteur_activite">Secteur d'activité</Label>
            <Input
              id="secteur_activite"
              value={formData.secteur_activite}
              onChange={(e) => setFormData({ ...formData, secteur_activite: e.target.value })}
              placeholder="Ex: Informatique, Conseil, etc."
            />
          </div>

          {/* Activité */}
          <div className="space-y-2">
            <Label>Activité</Label>
            <Select
              value={formData.activite}
              onValueChange={(value) => setFormData({ ...formData, activite: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une activité" />
              </SelectTrigger>
              <SelectContent>
                {activites.map((a) => (
                  <SelectItem key={a.code} value={a.code}>{a.libelle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Adresse */}
          <div className="space-y-2">
            <Label htmlFor="adresse">Adresse</Label>
            <Input
              id="adresse"
              value={formData.adresse}
              onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
              placeholder="Ex: 123 Rue de Paris, 75001 Paris"
            />
          </div>

          {/* Téléphone */}
          <div className="space-y-2">
            <Label htmlFor="telephone">Téléphone</Label>
            <Input
              id="telephone"
              value={formData.telephone}
              onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
              placeholder="Ex: +33 1 23 45 67 89"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Ex: contact@exemple.fr"
            />
          </div>

          {/* Site web */}
          <div className="space-y-2">
            <Label htmlFor="site_web">Site web</Label>
            <Input
              id="site_web"
              type="url"
              value={formData.site_web}
              onChange={(e) => setFormData({ ...formData, site_web: e.target.value })}
              placeholder="Ex: https://www.exemple.fr"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Création..." : "Créer le fournisseur"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
