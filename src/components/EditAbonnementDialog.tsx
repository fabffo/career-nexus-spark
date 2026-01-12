import { useEffect, useState, useCallback } from "react";
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
import { ExternalLink, FileText } from "lucide-react";
import { RapprochementSearchSection } from "@/components/RapprochementSearchSection";
import { MatchingHistorySection } from "@/components/MatchingHistorySection";
import { PartenaireSelect } from "@/components/PartenaireSelect";

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

const TYPES = [
  { value: "CHARGE", label: "Charge" },
  { value: "AUTRE", label: "Autre" },
];

export function EditAbonnementDialog({
  open,
  onOpenChange,
  abonnement,
}: EditAbonnementDialogProps) {
  const queryClient = useQueryClient();
  const { uploadFile, deleteFile } = useFileUpload();
  const [newDocumentFiles, setNewDocumentFiles] = useState<File[]>([]);
  const [existingDocuments, setExistingDocuments] = useState<any[]>([]);
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

  const { register, handleSubmit, reset, setValue, watch } = useForm();

  const nature = watch("nature");
  const type = watch("type");
  const tva = watch("tva");
  const actif = watch("actif");

  const handlePartenaireTypeChange = useCallback((type: string | null) => {
    setPartenaireType(type);
  }, []);

  const handlePartenaireIdChange = useCallback((id: string | null) => {
    setPartenaireId(id);
  }, []);

  useEffect(() => {
    if (abonnement) {
      const defaultKeywords = abonnement.nom;
      reset({
        nom: abonnement.nom,
        nature: abonnement.nature,
        type: abonnement.type || "CHARGE",
        tva: abonnement.tva || "normal",
        montant_mensuel: abonnement.montant_mensuel || "",
        jour_prelevement: abonnement.jour_prelevement || "",
        actif: abonnement.actif,
        notes: abonnement.notes || "",
        mots_cles_rapprochement: abonnement.mots_cles_rapprochement || defaultKeywords,
      });
      
      // Set partenaire values
      setPartenaireType(abonnement.partenaire_type || null);
      setPartenaireId(abonnement.partenaire_id || null);
      
      // Charger les documents existants
      const loadDocuments = async () => {
        const { data } = await supabase
          .from("abonnements_documents")
          .select("*")
          .eq("abonnement_id", abonnement.id)
          .order("created_at");
        
        setExistingDocuments(data || []);
      };
      
      loadDocuments();
      setNewDocumentFiles([]);
    }
  }, [abonnement, reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      // Mettre à jour l'abonnement
      const { error } = await supabase
        .from("abonnements_partenaires")
        .update({
          nom: data.nom,
          nature: data.nature,
          type: data.type,
          tva: data.tva,
          montant_mensuel: data.montant_mensuel ? parseFloat(data.montant_mensuel) : null,
          jour_prelevement: data.jour_prelevement ? parseInt(data.jour_prelevement) : null,
          actif: data.actif,
          notes: data.notes || null,
          mots_cles_rapprochement: data.mots_cles_rapprochement || null,
          partenaire_type: partenaireType,
          partenaire_id: partenaireId,
        })
        .eq("id", abonnement.id);

      if (error) throw error;
      
      // Uploader les nouveaux documents
      if (newDocumentFiles.length > 0) {
        for (const file of newDocumentFiles) {
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
          }
        }
      }
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

  const mots_cles_rapprochement = watch("mots_cles_rapprochement");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier l'abonnement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
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
            <Label htmlFor="mots_cles_rapprochement">Mots-clés de rapprochement bancaire</Label>
            <Input
              id="mots_cles_rapprochement"
              {...register("mots_cles_rapprochement")}
              placeholder="Ex: ORANGE ABONNEMENT ou ORANGE, SFR"
            />
            <p className="text-xs text-muted-foreground">
              <strong>Syntaxe :</strong> Espace = ET (tous les mots), Virgule = OU (l'un ou l'autre)
            </p>
          </div>

          {/* Rapprochement sections */}
          {abonnement && (
            <>
              <RapprochementSearchSection 
                entityType="abonnement"
                entityId={abonnement.id}
                entityName={abonnement.nom}
                savedKeywords={mots_cles_rapprochement}
              />
              <MatchingHistorySection 
                entityType="abonnement"
                entityId={abonnement.id}
                entityName={abonnement.nom}
              />
            </>
          )}

          <div className="space-y-2">
            <Label>Documents existants</Label>
            {existingDocuments.length > 0 ? (
              <div className="space-y-1">
                {existingDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between text-sm border rounded p-2">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {doc.nom_fichier}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          await deleteFile(doc.document_url);
                          await supabase
                            .from("abonnements_documents")
                            .delete()
                            .eq("id", doc.id);
                          setExistingDocuments(prev => prev.filter(d => d.id !== doc.id));
                          toast.success("Document supprimé");
                        } catch (error) {
                          toast.error("Erreur lors de la suppression");
                        }
                      }}
                    >
                      Supprimer
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun document</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Ajouter de nouveaux documents</Label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setNewDocumentFiles(prev => [...prev, ...files]);
              }}
            />
            {newDocumentFiles.length > 0 && (
              <div className="space-y-1">
                {newDocumentFiles.map((file, index) => (
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
                        setNewDocumentFiles(prev => prev.filter((_, i) => i !== index));
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
            <Button type="submit" disabled={updateMutation.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
