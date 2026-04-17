import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type JustificatifPortee = "GLOBAL" | "ANNUEL" | "MENSUEL";

export type JustificatifRow = {
  id: string;
  abonnement_id: string;
  portee: JustificatifPortee;
  annee: number | null;
  ligne_rapprochement_id: string | null;
  document_url: string;
  nom_fichier: string;
  notes: string | null;
  created_at: string;
};

const BUCKET = "paiements-abonnements-justificatifs";

/**
 * Charge tous les justificatifs (global, annuel, mensuel) pour un abonnement donné.
 */
export function useJustificatifsAbonnement(abonnementId: string | undefined) {
  return useQuery({
    queryKey: ["paj-justificatifs", abonnementId],
    enabled: !!abonnementId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paiements_abonnements_justificatifs")
        .select("*")
        .eq("abonnement_id", abonnementId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as JustificatifRow[];
    },
  });
}

/**
 * Charge les justificatifs pour une liste d'abonnements (pour calculer le statut par ligne).
 */
export function useJustificatifsBulk(abonnementIds: string[]) {
  const ids = [...new Set(abonnementIds)].filter(Boolean).sort();
  return useQuery({
    queryKey: ["paj-justificatifs-bulk", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paiements_abonnements_justificatifs")
        .select("*")
        .in("abonnement_id", ids);
      if (error) throw error;
      return (data || []) as JustificatifRow[];
    },
  });
}

/**
 * Donne le justificatif applicable à une ligne précise (mensuel > annuel > global).
 */
export function pickJustificatifForLine(
  justificatifs: JustificatifRow[],
  abonnementId: string | null | undefined,
  ligneId: string,
  dateIso: string,
): JustificatifRow | null {
  if (!abonnementId) return null;
  const annee = new Date(dateIso).getFullYear();
  const candidates = justificatifs.filter((j) => j.abonnement_id === abonnementId);
  const mensuel = candidates.find((j) => j.portee === "MENSUEL" && j.ligne_rapprochement_id === ligneId);
  if (mensuel) return mensuel;
  const annuel = candidates.find((j) => j.portee === "ANNUEL" && j.annee === annee);
  if (annuel) return annuel;
  const global = candidates.find((j) => j.portee === "GLOBAL");
  return global || null;
}

export function useUploadJustificatif() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      file: File;
      abonnement_id: string;
      portee: JustificatifPortee;
      annee?: number | null;
      ligne_rapprochement_id?: string | null;
      notes?: string | null;
    }) => {
      const sanitized = params.file.name
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .substring(0, 100);
      const path = `${params.abonnement_id}/${Date.now()}_${sanitized}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, params.file);
      if (upErr) throw upErr;

      const { error: insErr } = await supabase
        .from("paiements_abonnements_justificatifs")
        .insert({
          abonnement_id: params.abonnement_id,
          portee: params.portee,
          annee: params.portee === "ANNUEL" ? params.annee ?? null : null,
          ligne_rapprochement_id:
            params.portee === "MENSUEL" ? params.ligne_rapprochement_id ?? null : null,
          document_url: path,
          nom_fichier: params.file.name,
          notes: params.notes ?? null,
        });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success("Justificatif ajouté");
      qc.invalidateQueries({ queryKey: ["paj-justificatifs"] });
      qc.invalidateQueries({ queryKey: ["paj-justificatifs-bulk"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de l'ajout"),
  });
}

export function useDeleteJustificatif() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (justif: JustificatifRow) => {
      await supabase.storage.from(BUCKET).remove([justif.document_url]);
      const { error } = await supabase
        .from("paiements_abonnements_justificatifs")
        .delete()
        .eq("id", justif.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Justificatif supprimé");
      qc.invalidateQueries({ queryKey: ["paj-justificatifs"] });
      qc.invalidateQueries({ queryKey: ["paj-justificatifs-bulk"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de la suppression"),
  });
}

export async function downloadJustificatif(justif: JustificatifRow) {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(justif.document_url);
    if (error) throw error;
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = justif.nom_fichier;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e: any) {
    toast.error(e?.message || "Erreur de téléchargement");
  }
}
