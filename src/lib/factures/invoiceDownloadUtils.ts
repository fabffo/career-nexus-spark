import { supabase } from "@/integrations/supabase/client";

export type ClientRefLookupInput = {
  destinataire_id?: string | null;
  destinataire_nom?: string | null;
};

export type StorageFileReference = {
  bucket: string;
  filePath: string;
  extension: string;
};

export const cleanFilenameSegment = (value: string | null | undefined) => {
  if (!value) return "";
  return value
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "_")
    .trim();
};

export const parseStorageFileReference = (
  rawReference: string | null | undefined,
  defaultBucket = "factures"
): StorageFileReference | null => {
  const raw = (rawReference || "").trim();
  if (!raw) return null;

  let bucket = defaultBucket;
  let filePath = raw;

  if (/^https?:\/\//i.test(raw)) {
    if (raw.includes("/candidats-files/")) {
      bucket = "candidats-files";
      const match = raw.match(/candidats-files\/(.+)$/);
      filePath = match?.[1] || "";
    } else if (raw.includes("/factures/")) {
      bucket = "factures";
      const match = raw.match(/factures\/(.+)$/);
      filePath = match?.[1] || "";
    } else {
      return null;
    }
  } else {
    if (raw.startsWith("candidats-files/")) {
      bucket = "candidats-files";
      filePath = raw.replace(/^candidats-files\//, "");
    } else if (raw.startsWith("factures/")) {
      bucket = "factures";
      filePath = raw.replace(/^factures\//, "");
    }
  }

  // Un SIREN/identifiant brut (ex: 834114837) ne doit pas être considéré comme un fichier storage.
  const looksLikeStoredFile = filePath.includes("/") || /\.[a-zA-Z0-9]{2,8}$/.test(filePath);
  if (!filePath || !looksLikeStoredFile) return null;

  const extension = filePath.split(".").pop()?.toLowerCase() || "pdf";
  return { bucket, filePath, extension };
};

const tryFindClientIdByName = async (nameRaw: string): Promise<string | null> => {
  const name = nameRaw.trim();
  if (!name) return null;

  // 1) Exact (case-sensitive)
  {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("raison_sociale", name)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  // 2) Exact (case-insensitive)
  {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .ilike("raison_sociale", name)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  // 3) Prefix match (case-insensitive)
  {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .ilike("raison_sociale", `${name}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  // 4) Contains match (case-insensitive) – last resort
  {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .ilike("raison_sociale", `%${name}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  return null;
};

export const getClientIdForInvoice = async (input: ClientRefLookupInput): Promise<string | null> => {
  const id = (input.destinataire_id || "").trim();
  if (id) return id;

  if (!input.destinataire_nom) return null;
  return await tryFindClientIdByName(input.destinataire_nom);
};

export const getReferenceClientForInvoice = async (input: ClientRefLookupInput): Promise<string | null> => {
  const clientId = await getClientIdForInvoice(input);
  if (!clientId) return null;

  const { data, error } = await supabase
    .from("contrats")
    .select("reference_client, created_at")
    .eq("type", "CLIENT")
    .or(`client_id.eq.${clientId},client_lie_id.eq.${clientId}`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    // On ne throw pas : la référence est optionnelle pour le nom de fichier.
    console.debug("getReferenceClientForInvoice: contrats select error", error);
    return null;
  }

  // reference_client is now jsonb: [{reference: string, montant: number}, ...]
  const refs = (data || [])
    .map((row) => row.reference_client)
    .filter((v): v is any[] => Array.isArray(v) && v.length > 0);

  if (refs.length > 0) {
    const firstRef = refs[0][0];
    if (firstRef && typeof firstRef.reference === 'string' && firstRef.reference.trim().length > 0) {
      return firstRef.reference;
    }
  }

  return null;
};
