import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddAbonnementDialog } from "@/components/AddAbonnementDialog";
import { EditAbonnementDialog } from "@/components/EditAbonnementDialog";

const NATURE_LABELS: Record<string, string> = {
  RELEVE_BANQUE: "Relevé Banque",
  ASSURANCE: "Assurance",
  LOA_VOITURE: "LOA Voiture",
  LOYER: "Loyer",
  AUTRE: "Autre",
};

const NATURE_COLORS: Record<string, string> = {
  RELEVE_BANQUE: "bg-blue-500",
  ASSURANCE: "bg-green-500",
  LOA_VOITURE: "bg-purple-500",
  LOYER: "bg-orange-500",
  AUTRE: "bg-gray-500",
};

type Abonnement = {
  id: string;
  nom: string;
  nature: string;
  montant_mensuel: number;
  jour_prelevement: number;
  actif: boolean;
  notes: string;
  documents?: Array<{ id: string; document_url: string; nom_fichier: string; created_at: string }>;
};

export default function AbonnementsPartenaires() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAbonnement, setEditingAbonnement] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: abonnements = [], isLoading } = useQuery({
    queryKey: ["abonnements-partenaires"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("abonnements_partenaires")
        .select(`
          *,
          documents:abonnements_documents(id, document_url, nom_fichier, created_at)
        `)
        .order("nom");

      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("abonnements_partenaires")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abonnements-partenaires"] });
      toast.success("Abonnement supprimé");
      setDeletingId(null);
    },
    onError: (error) => {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    },
  });

  const columns: ColumnDef<Abonnement>[] = [
    {
      accessorKey: "nom",
      header: "Nom",
      cell: ({ row }) => <span className="font-medium">{row.original.nom}</span>,
    },
    {
      accessorKey: "nature",
      header: "Nature",
      cell: ({ row }) => (
        <Badge className={NATURE_COLORS[row.original.nature]}>
          {NATURE_LABELS[row.original.nature]}
        </Badge>
      ),
    },
    {
      accessorKey: "montant_mensuel",
      header: "Montant mensuel",
      cell: ({ row }) =>
        row.original.montant_mensuel
          ? `${Number(row.original.montant_mensuel).toFixed(2)} €`
          : "-",
    },
    {
      accessorKey: "jour_prelevement",
      header: "Jour prélèvement",
      cell: ({ row }) =>
        row.original.jour_prelevement ? `Le ${row.original.jour_prelevement}` : "-",
    },
    {
      accessorKey: "actif",
      header: "Statut",
      cell: ({ row }) => (
        <Badge variant={row.original.actif ? "default" : "secondary"}>
          {row.original.actif ? "Actif" : "Inactif"}
        </Badge>
      ),
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => (
        <span className="max-w-xs truncate block">{row.original.notes || "-"}</span>
      ),
    },
    {
      id: "documents",
      header: "Document",
      cell: ({ row }) => {
        const docs = row.original.documents;
        if (!docs || docs.length === 0) return "-";
        return (
          <div className="flex flex-col gap-1">
            {docs.map((doc) => (
              <Button
                key={doc.id}
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    const response = await fetch(doc.document_url);
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = doc.nom_fichier;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    toast.success("Document téléchargé");
                  } catch (error) {
                    console.error("Erreur téléchargement:", error);
                    toast.error("Erreur lors du téléchargement");
                  }
                }}
                className="justify-start"
              >
                <FileText className="h-4 w-4 mr-2" />
                {doc.nom_fichier}
              </Button>
            ))}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditingAbonnement(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeletingId(row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      meta: { className: "text-right" },
    },
  ];

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Abonnements Partenaires</h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos abonnements récurrents (assurances, loyers, LOA, etc.)
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvel abonnement
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={abonnements || []}
        searchPlaceholder="Rechercher un abonnement..."
      />

      <AddAbonnementDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />

      {editingAbonnement && (
        <EditAbonnementDialog
          open={!!editingAbonnement}
          onOpenChange={(open) => !open && setEditingAbonnement(null)}
          abonnement={editingAbonnement}
        />
      )}

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cet abonnement ? Cette action est
              irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && deleteMutation.mutate(deletingId)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
