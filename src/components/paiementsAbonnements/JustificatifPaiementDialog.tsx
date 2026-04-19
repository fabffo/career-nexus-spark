import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileText, Loader2, Trash2, Upload, BadgeCheck } from "lucide-react";
import {
  downloadJustificatif,
  pickJustificatifForLine,
  useDeleteJustificatif,
  useJustificatifsAbonnement,
  useMarkExempte,
  useUploadJustificatif,
  type JustificatifPortee,
} from "@/features/paiementsAbonnements/useJustificatifs";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ligneId: string;
  abonnementId: string;
  abonnementNom: string;
  datePaiement: string;
};

const PORTEE_LABELS: Record<JustificatifPortee, string> = {
  GLOBAL: "Global (toutes lignes)",
  ANNUEL: "Annuel (toute l'année)",
  MENSUEL: "Mensuel (cette ligne uniquement)",
  EXEMPTE: "Pas de justificatif requis",
};

const PORTEE_BADGE: Record<JustificatifPortee, string> = {
  GLOBAL: "bg-purple-100 text-purple-800 hover:bg-purple-100",
  ANNUEL: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  MENSUEL: "bg-green-100 text-green-800 hover:bg-green-100",
  EXEMPTE: "bg-slate-200 text-slate-800 hover:bg-slate-200",
};

export function JustificatifPaiementDialog({
  open,
  onOpenChange,
  ligneId,
  abonnementId,
  abonnementNom,
  datePaiement,
}: Props) {
  const annee = new Date(datePaiement).getFullYear();
  const [file, setFile] = useState<File | null>(null);
  const [portee, setPortee] = useState<JustificatifPortee>("MENSUEL");
  const [anneeSel, setAnneeSel] = useState<number>(annee);
  const [notes, setNotes] = useState("");

  const { data: justifs = [], isLoading } = useJustificatifsAbonnement(abonnementId);
  const upload = useUploadJustificatif();
  const del = useDeleteJustificatif();
  const markExempte = useMarkExempte();

  const applicable = pickJustificatifForLine(justifs, abonnementId, ligneId, datePaiement);

  const handleUpload = async () => {
    if (!file) return;
    await upload.mutateAsync({
      file,
      abonnement_id: abonnementId,
      portee,
      annee: portee === "ANNUEL" ? anneeSel : null,
      ligne_rapprochement_id: portee === "MENSUEL" ? ligneId : null,
      notes: notes || null,
    });
    setFile(null);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Justificatifs — {abonnementNom}
          </DialogTitle>
          <DialogDescription>
            Paiement du {format(new Date(datePaiement), "dd MMMM yyyy", { locale: fr })}
          </DialogDescription>
        </DialogHeader>

        {/* Justificatif applicable */}
        <div className="rounded-md border p-3 bg-muted/30">
          <div className="text-sm font-medium mb-2">Justificatif applicable à cette ligne</div>
          {applicable ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Badge className={PORTEE_BADGE[applicable.portee]}>
                  {PORTEE_LABELS[applicable.portee]}
                  {applicable.portee === "ANNUEL" && ` ${applicable.annee}`}
                </Badge>
                <span className="truncate text-sm">
                  {applicable.nom_fichier || (applicable.notes ?? "Exempté")}
                </span>
              </div>
              {applicable.document_url && (
                <Button size="sm" variant="outline" onClick={() => downloadJustificatif(applicable)}>
                  <Download className="h-4 w-4 mr-1" /> Télécharger
                </Button>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Aucun justificatif disponible.</div>
          )}
        </div>

        {/* Marquer comme exempté (cette ligne uniquement) */}
        <div className="rounded-md border p-3 bg-muted/10">
          <div className="text-sm font-medium mb-1">Pas de justificatif requis</div>
          <p className="text-xs text-muted-foreground mb-2">
            Marquer cette ligne comme valide sans téléverser de fichier.
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={markExempte.isPending}
            onClick={() =>
              markExempte.mutate({
                abonnement_id: abonnementId,
                ligne_rapprochement_id: ligneId,
                notes: notes || null,
              })
            }
          >
            <BadgeCheck className="h-4 w-4 mr-1" />
            Marquer comme "Pas de justificatif requis"
          </Button>
        </div>

        {/* Ajouter */}
        <div className="space-y-3 border rounded-md p-3">
          <div className="text-sm font-medium">Ajouter un justificatif</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Portée</Label>
              <Select value={portee} onValueChange={(v) => setPortee(v as JustificatifPortee)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MENSUEL">Mensuel (cette ligne)</SelectItem>
                  <SelectItem value="ANNUEL">Annuel (une année)</SelectItem>
                  <SelectItem value="GLOBAL">Global (toutes lignes)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {portee === "ANNUEL" && (
              <div>
                <Label className="text-xs">Année</Label>
                <Input
                  type="number"
                  value={anneeSel}
                  onChange={(e) => setAnneeSel(Number(e.target.value))}
                />
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs">Fichier</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <Label className="text-xs">Notes (optionnel)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button onClick={handleUpload} disabled={!file || upload.isPending} className="w-full">
            {upload.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Téléverser
          </Button>
        </div>

        {/* Liste de tous les justificatifs de l'abonnement */}
        <div>
          <div className="text-sm font-medium mb-2">
            Tous les justificatifs de cet abonnement ({justifs.length})
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : justifs.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucun justificatif enregistré.</div>
          ) : (
            <div className="space-y-2">
              {justifs.map((j) => (
                <div
                  key={j.id}
                  className="flex items-center justify-between gap-2 p-2 border rounded-md"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge className={PORTEE_BADGE[j.portee]}>
                      {PORTEE_LABELS[j.portee]}
                      {j.portee === "ANNUEL" && ` ${j.annee}`}
                    </Badge>
                    <span className="truncate text-sm">{j.nom_fichier}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => downloadJustificatif(j)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Supprimer "${j.nom_fichier}" ?`)) del.mutate(j);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
