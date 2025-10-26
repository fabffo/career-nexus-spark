import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { ExternalLink } from "lucide-react";

interface EditAbonnementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  abonnement: any;
}

const NATURES = [
  { value: "RELEVE_BANQUE", label: "Relevé Banque" },
  { value: "ASSURANCE", label: "Assurance" },
  { value: "LOA_VOITURE", label: "LOA Voiture" },
  { value: "LOYER", label: "Loyer" },
  { value: "AUTRE", label: "Autre" },
];

export function EditAbonnementDialog({
  open,
  onOpenChange,
  abonnement,
}: EditAbonnementDialogProps) {
  const queryClient = useQueryClient();
  const { uploadFile, deleteFile } = useFileUpload();
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [existingDocumentUrl, setExistingDocumentUrl] = useState<string | null>(null);
  
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  const nature = watch("nature");
  const actif = watch("actif");

  useEffect(() => {
    if (abonnement) {
      reset({
        nom: abonnement.nom,
        nature: abonnement.nature,
        montant_mensuel: abonnement.montant_mensuel || "",
        jour_prelevement: abonnement.jour_prelevement || "",
        actif: abonnement.actif,
        notes: abonnement.notes || "",
      });
      setExistingDocumentUrl(abonnement.document_url || null);
      setDocumentFile(null);
    }
  }, [abonnement, reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      let documentUrl = existingDocumentUrl;
      
      if (documentFile) {
        try {
          // Delete old document if exists
          if (existingDocumentUrl) {
            await deleteFile(existingDocumentUrl);
          }
          // Upload new document
          documentUrl = await uploadFile(documentFile, "candidats-files");
        } catch (error) {
          console.error("Error uploading document:", error);
          throw new Error("Erreur lors du téléchargement du document");
        }
      }
      
      const { error } = await supabase
        .from("abonnements_partenaires")
        .update({
          nom: data.nom,
          nature: data.nature,
          montant_mensuel: data.montant_mensuel ? parseFloat(data.montant_mensuel) : null,
          jour_prelevement: data.jour_prelevement ? parseInt(data.jour_prelevement) : null,
          actif: data.actif,
          notes: data.notes || null,
          document_url: documentUrl,
        })
        .eq("id", abonnement.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abonnements-partenaires"] });
      toast.success("Abonnement modifié");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erreur lors de la modification");
      console.error(error);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifier l'abonnement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom *</Label>
              <Input id="nom" {...register("nom", { required: true })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nature">Nature *</Label>
              <Select value={nature} onValueChange={(value) => setValue("nature", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NATURES.map((n) => (
                    <SelectItem key={n.value} value={n.value}>
                      {n.label}
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

          <FileUploadField
            label="Document"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            currentFileUrl={existingDocumentUrl || undefined}
            onFileSelect={setDocumentFile}
            onFileRemove={() => {
              setExistingDocumentUrl(null);
              setDocumentFile(null);
            }}
          />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
