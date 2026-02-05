import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit2, Save, X, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PrevisionAbonnementsFormProps {
  annee: number;
}

export default function PrevisionAbonnementsForm({ annee }: PrevisionAbonnementsFormProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    mois: 1,
    nom: "",
    activite: "",
    montant_mensuel: 0,
    taux_tva: 20,
  });

  // Récupérer les activités
  const { data: activites = [] } = useQuery({
    queryKey: ["param-activites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("param_activite")
        .select("code, libelle")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  // Récupérer les prévisions existantes
  const { data: previsions = [] } = useQuery({
    queryKey: ["previsions-abonnements", annee],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("previsions_abonnements")
        .select("*")
        .eq("annee", annee)
        .eq("actif", true)
        .order("mois");
      if (error) throw error;
      return data || [];
    },
  });

  // Récupérer les abonnements actifs réels pour l'import
  const { data: abonnementsActifs = [] } = useQuery({
    queryKey: ["abonnements-actifs-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("abonnements_partenaires")
        .select("id, nom, montant_mensuel, tva, activite")
        .eq("actif", true)
        .order("nom");
      if (error) throw error;
      return data || [];
    },
  });

  const calculateTotals = (montant: number, tauxTva: number) => {
    const tva = montant * (tauxTva / 100);
    const ttc = montant + tva;
    return { total_tva: tva, total_ttc: ttc };
  };

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const totals = calculateTotals(data.montant_mensuel, data.taux_tva);
      const { error } = await supabase.from("previsions_abonnements").insert({
        annee,
        mois: data.mois,
        nom: data.nom,
        activite: data.activite || null,
        montant_mensuel: data.montant_mensuel,
        taux_tva: data.taux_tva,
        total_tva: totals.total_tva,
        total_ttc: totals.total_ttc,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["previsions-abonnements", annee] });
      toast.success("Prévision ajoutée");
      resetForm();
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const totals = calculateTotals(data.montant_mensuel, data.taux_tva);
      const { error } = await supabase
        .from("previsions_abonnements")
        .update({
          mois: data.mois,
          nom: data.nom,
          activite: data.activite || null,
          montant_mensuel: data.montant_mensuel,
          taux_tva: data.taux_tva,
          total_tva: totals.total_tva,
          total_ttc: totals.total_ttc,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["previsions-abonnements", annee] });
      toast.success("Prévision mise à jour");
      setEditingId(null);
      resetForm();
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("previsions_abonnements")
        .update({ actif: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["previsions-abonnements", annee] });
      toast.success("Prévision supprimée");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  // Convertir le taux TVA texte en nombre
  const parseTvaRate = (tva: string | null): number => {
    if (!tva) return 20;
    const lower = tva.toLowerCase();
    if (lower.includes("exon") || lower === "exonere") return 0;
    if (lower.includes("20")) return 20;
    if (lower.includes("10")) return 10;
    if (lower.includes("5.5")) return 5.5;
    if (lower.includes("2.1")) return 2.1;
    return 20;
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      // Importer les abonnements actifs (1 entrée par mois pour chaque abonnement)
      const toInsert: any[] = [];
      abonnementsActifs.forEach((abo: any) => {
        const tauxTva = parseTvaRate(abo.tva);
        const montant = Number(abo.montant_mensuel) || 0;
        // Créer une prévision pour chaque mois (1 à 12)
        for (let mois = 1; mois <= 12; mois++) {
          const totals = calculateTotals(montant, tauxTva);
          toInsert.push({
            annee,
            mois,
            nom: abo.nom,
            activite: abo.activite,
            montant_mensuel: montant,
            taux_tva: tauxTva,
            total_tva: totals.total_tva,
            total_ttc: totals.total_ttc,
          });
        }
      });
      if (toInsert.length === 0) throw new Error("Aucun abonnement actif à importer");
      const { error } = await supabase.from("previsions_abonnements").insert(toInsert);
      if (error) throw error;
      return toInsert.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["previsions-abonnements", annee] });
      toast.success(`${count} prévision(s) créée(s) depuis les abonnements actifs`);
    },
    onError: (error: any) => toast.error(error.message || "Erreur lors de l'import"),
  });

  const copyMutation = useMutation({
    mutationFn: async (prevision: any) => {
      const totals = calculateTotals(Number(prevision.montant_mensuel), Number(prevision.taux_tva));
      const { error } = await supabase.from("previsions_abonnements").insert({
        annee,
        mois: prevision.mois,
        nom: `${prevision.nom} (copie)`,
        activite: prevision.activite,
        montant_mensuel: prevision.montant_mensuel,
        taux_tva: prevision.taux_tva,
        total_tva: totals.total_tva,
        total_ttc: totals.total_ttc,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["previsions-abonnements", annee] });
      toast.success("Prévision dupliquée");
    },
    onError: () => toast.error("Erreur lors de la copie"),
  });

  const resetForm = () => {
    setFormData({
      mois: 1,
      nom: "",
      activite: "",
      montant_mensuel: 0,
      taux_tva: 20,
    });
    setIsAdding(false);
  };

  const handleEdit = (prevision: any) => {
    setEditingId(prevision.id);
    setFormData({
      mois: prevision.mois,
      nom: prevision.nom || "",
      activite: prevision.activite || "",
      montant_mensuel: Number(prevision.montant_mensuel) || 0,
      taux_tva: Number(prevision.taux_tva) || 20,
    });
  };

  const handleSubmit = () => {
    if (!formData.nom) {
      toast.error("Le nom est requis");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      addMutation.mutate(formData);
    }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

  const moisLabels = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Prévisions d'Abonnements Mensuels</h3>
        <div className="flex gap-2">
          {abonnementsActifs.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Importer abonnements
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Importer les abonnements actifs</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action créera des prévisions mensuelles (12 mois) pour chacun des {abonnementsActifs.length} abonnement(s) actif(s).
                    Les prévisions existantes ne seront pas supprimées.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => importMutation.mutate()}>
                    Importer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {!isAdding && (
            <Button size="sm" onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          )}
        </div>
      </div>

      {(isAdding || editingId) && (
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Mois</Label>
              <Select
                value={formData.mois.toString()}
                onValueChange={(v) => setFormData(prev => ({ ...prev, mois: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {moisLabels.map((label, idx) => (
                    <SelectItem key={idx} value={(idx + 1).toString()}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nom de l'abonnement *</Label>
              <Input
                value={formData.nom}
                onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                placeholder="Ex: Hébergement Web"
              />
            </div>

            <div className="space-y-2">
              <Label>Activité</Label>
              <Select
                value={formData.activite}
                onValueChange={(v) => setFormData(prev => ({ ...prev, activite: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {activites.map((act) => (
                    <SelectItem key={act.code} value={act.code}>{act.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Montant HT (€)</Label>
              <Input
                type="number"
                value={formData.montant_mensuel}
                onChange={(e) => setFormData(prev => ({ ...prev, montant_mensuel: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Taux TVA (%)</Label>
              <Input
                type="number"
                value={formData.taux_tva}
                onChange={(e) => setFormData(prev => ({ ...prev, taux_tva: parseFloat(e.target.value) || 20 }))}
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Total TTC: </span>
              <span className="font-medium">
                {formatCurrency(formData.montant_mensuel * (1 + formData.taux_tva / 100))}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { resetForm(); setEditingId(null); }}>
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
              <Button size="sm" onClick={handleSubmit}>
                <Save className="h-4 w-4 mr-2" />
                {editingId ? "Mettre à jour" : "Enregistrer"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mois</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead>Activité</TableHead>
            <TableHead className="text-right">Montant HT</TableHead>
            <TableHead className="text-right">TVA</TableHead>
            <TableHead className="text-right">TTC</TableHead>
            <TableHead className="w-[120px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {previsions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Aucune prévision d'abonnement pour {annee}
              </TableCell>
            </TableRow>
          ) : (
            previsions.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{moisLabels[p.mois - 1]}</TableCell>
                <TableCell>{p.nom}</TableCell>
                <TableCell>{activites.find(a => a.code === p.activite)?.libelle || p.activite || "—"}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(p.montant_mensuel))}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(p.total_tva))}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(Number(p.total_ttc))}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => copyMutation.mutate(p)} title="Dupliquer">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(p)} title="Modifier">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)} title="Supprimer">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
