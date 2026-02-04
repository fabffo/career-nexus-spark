import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useFileUpload } from "@/hooks/useFileUpload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FileUploadField } from "@/components/FileUploadField";
import { FileText } from "lucide-react";
import { PartenaireSelect } from "@/components/PartenaireSelect";

interface AddAbonnementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPES = [
  { value: "CHARGE", label: "Charge" },
  { value: "AUTRE", label: "Autre" },
];

export function AddAbonnementDialog({ open, onOpenChange }: AddAbonnementDialogProps) {
  const queryClient = useQueryClient();
  const { uploadFile } = useFileUpload();
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [partenaireType, setPartenaireType] = useState<string | null>(null);
  const [partenaireId, setPartenaireId] = useState<string | null>(null);
  
  // Charger les taux de TVA depuis la table paramètre
  const { data: tvaOptions = [] } = useQuery({
    queryKey: ["tva-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tva")
        .select("id, libelle, taux, is_default")
        .order("taux");
      if (error) throw error;
      return data;
    },
  });

  // Charger les activités
  const { data: activiteOptions = [] } = useQuery({
    queryKey: ["activite-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("param_activite")
        .select("code, libelle")
        .eq("is_active", true)
        .order("libelle");
      if (error) throw error;
      return data;
    },
  });

  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      nom: "",
      activite: "",
      type: "CHARGE",
      tva: "",
      montant_mensuel: "",
      jour_prelevement: "",
      actif: true,
      notes: "",
    },
  });

  const activite = watch("activite");
  const type = watch("type");
  const tva = watch("tva");
  const actif = watch("actif");

  const handlePartenaireTypeChange = useCallback((type: string | null) => {
    setPartenaireType(type);
  }, []);

  const handlePartenaireIdChange = useCallback((id: string | null) => {
    setPartenaireId(id);
  }, []);

  // Mettre à jour TVA automatiquement selon le type
  useEffect(() => {
    if (tvaOptions.length > 0) {
      if (type === "CHARGE") {
        // Pour les charges: TVA normale (is_default ou taux > 0)
        const defaultTva = tvaOptions.find(t => t.is_default) || tvaOptions.find(t => t.taux > 0);
        if (defaultTva) setValue("tva", defaultTva.libelle);
      } else {
        // Pour les autres: TVA exonérée (taux = 0)
        const exonereTva = tvaOptions.find(t => t.taux === 0);
        if (exonereTva) setValue("tva", exonereTva.libelle);
      }
    }
  }, [type, tvaOptions, setValue]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // Créer d'abord l'abonnement
      const { data: abonnement, error: abonnementError } = await supabase
        .from("abonnements_partenaires")
        .insert({
          nom: data.nom,
          nature: "AUTRE", // Valeur par défaut, remplacée par activite
          activite: data.activite || null,
          type: data.type,
          tva: data.tva,
          montant_mensuel: data.montant_mensuel ? parseFloat(data.montant_mensuel) : null,
          jour_prelevement: data.jour_prelevement ? parseInt(data.jour_prelevement) : null,
          actif: data.actif,
          notes: data.notes || null,
          partenaire_type: partenaireType,
          partenaire_id: partenaireId,
        })
        .select()
        .single();

      if (abonnementError) throw abonnementError;
      
      // Uploader les documents et les lier à l'abonnement
      if (documentFiles.length > 0) {
        for (const file of documentFiles) {
          try {
            const documentUrl = await uploadFile(file, "candidats-files");
            
            await supabase
              .from("abonnements_documents")
              .insert({
                abonnement_id: abonnement.id,
                document_url: documentUrl,
                nom_fichier: file.name,
              });
          } catch (error) {
            console.error("Error uploading document:", error);
            // On continue même si un document échoue
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abonnements-partenaires"] });
      toast.success("Abonnement créé");
      reset();
      setDocumentFiles([]);
      setPartenaireType(null);
      setPartenaireId(null);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erreur lors de la création");
      console.error(error);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvel abonnement partenaire</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
          <PartenaireSelect
            partenaireType={partenaireType}
            partenaireId={partenaireId}
            onTypeChange={handlePartenaireTypeChange}
            onIdChange={handlePartenaireIdChange}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom *</Label>
              <Input id="nom" {...register("nom", { required: true })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="activite">Activité</Label>
              <Select value={activite} onValueChange={(value) => setValue("activite", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une activité" />
                </SelectTrigger>
                <SelectContent>
                  {activiteOptions.map((a) => (
                    <SelectItem key={a.code} value={a.code}>
                      {a.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select value={type} onValueChange={(value) => setValue("type", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tva">TVA</Label>
              <Select value={tva} onValueChange={(value) => setValue("tva", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une TVA" />
                </SelectTrigger>
                <SelectContent>
                  {tvaOptions.map((t) => (
                    <SelectItem key={t.id} value={t.libelle}>
                      {t.libelle} ({t.taux}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="montant_mensuel">Montant mensuel (€)</Label>
              <Input
                id="montant_mensuel"
                type="number"
                step="0.01"
                {...register("montant_mensuel")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jour_prelevement">Jour de prélèvement (1-31)</Label>
              <Input
                id="jour_prelevement"
                type="number"
                min="1"
                max="31"
                {...register("jour_prelevement")}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="actif"
              checked={actif}
              onCheckedChange={(checked) => setValue("actif", checked)}
            />
            <Label htmlFor="actif">Abonnement actif</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register("notes")} rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Documents (plusieurs fichiers possibles)</Label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setDocumentFiles(prev => [...prev, ...files]);
              }}
            />
            {documentFiles.length > 0 && (
              <div className="space-y-1">
                {documentFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between text-sm border rounded p-2">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {file.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDocumentFiles(prev => prev.filter((_, i) => i !== index));
                      }}
                    >
                      Supprimer
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              Créer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
