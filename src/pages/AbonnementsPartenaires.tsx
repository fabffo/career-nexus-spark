import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
        .select("*")
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

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Nature</TableHead>
              <TableHead>Montant mensuel</TableHead>
              <TableHead>Jour prélèvement</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Document</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : abonnements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  Aucun abonnement
                </TableCell>
              </TableRow>
            ) : (
              abonnements.map((abonnement) => (
                <TableRow key={abonnement.id}>
                  <TableCell className="font-medium">{abonnement.nom}</TableCell>
                  <TableCell>
                    <Badge className={NATURE_COLORS[abonnement.nature]}>
                      {NATURE_LABELS[abonnement.nature]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {abonnement.montant_mensuel
                      ? `${Number(abonnement.montant_mensuel).toFixed(2)} €`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {abonnement.jour_prelevement
                      ? `Le ${abonnement.jour_prelevement}`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={abonnement.actif ? "default" : "secondary"}>
                      {abonnement.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {abonnement.notes || "-"}
                  </TableCell>
                  <TableCell>
                    {abonnement.document_url ? (
                      <a
                        href={abonnement.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <FileText className="h-4 w-4" />
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingAbonnement(abonnement)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingId(abonnement.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
