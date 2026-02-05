import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Save } from "lucide-react";
import PrevisionVentesForm from "./PrevisionVentesForm";
import PrevisionAchatsServicesForm from "./PrevisionAchatsServicesForm";
import PrevisionAbonnementsForm from "./PrevisionAbonnementsForm";
import PrevisionChargesSalarialesForm from "./PrevisionChargesSalarialesForm";
import PrevisionAchatsGenerauxForm from "./PrevisionAchatsGenerauxForm";

interface TresorerieSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  annee: number;
}

export default function TresorerieSettingsDialog({
  open,
  onOpenChange,
  annee,
}: TresorerieSettingsDialogProps) {
  const queryClient = useQueryClient();
  const [soldeDebutInput, setSoldeDebutInput] = useState("");

  // Récupérer les paramètres de trésorerie
  const { data: parametresTresorerie } = useQuery({
    queryKey: ["parametres-tresorerie", annee],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parametres_tresorerie")
        .select("*")
        .eq("annee", annee)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (parametresTresorerie) {
      setSoldeDebutInput(parametresTresorerie.solde_debut?.toString() || "0");
    }
  }, [parametresTresorerie]);

  // Mutation pour sauvegarder le solde de début
  const saveParametresMutation = useMutation({
    mutationFn: async (soldeDebut: number) => {
      const { data: existing } = await supabase
        .from("parametres_tresorerie")
        .select("id")
        .eq("annee", annee)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("parametres_tresorerie")
          .update({ solde_debut: soldeDebut })
          .eq("annee", annee);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("parametres_tresorerie")
          .insert({ annee, solde_debut: soldeDebut });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parametres-tresorerie", annee] });
      toast.success("Solde de début enregistré");
    },
    onError: () => {
      toast.error("Erreur lors de l'enregistrement");
    },
  });

  const handleSaveSolde = () => {
    const value = parseFloat(soldeDebutInput.replace(/\s/g, "").replace(",", ".")) || 0;
    saveParametresMutation.mutate(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paramétrage Trésorerie {annee}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="solde" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="solde">Solde</TabsTrigger>
            <TabsTrigger value="ventes">Ventes</TabsTrigger>
            <TabsTrigger value="achats-services">Achats Services</TabsTrigger>
            <TabsTrigger value="abonnements">Abonnements</TabsTrigger>
            <TabsTrigger value="charges">Charges</TabsTrigger>
            <TabsTrigger value="achats-generaux">Achats Gén.</TabsTrigger>
          </TabsList>

          <TabsContent value="solde" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Solde de début d'année</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="solde-debut">Solde au 1er janvier {annee} (€)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="solde-debut"
                      type="text"
                      value={soldeDebutInput}
                      onChange={(e) => setSoldeDebutInput(e.target.value)}
                      placeholder="Ex: 50000"
                    />
                    <Button onClick={handleSaveSolde} disabled={saveParametresMutation.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      Enregistrer
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Solde du compte bancaire au 1er janvier {annee}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ventes" className="mt-4">
            <PrevisionVentesForm annee={annee} />
          </TabsContent>

          <TabsContent value="achats-services" className="mt-4">
            <PrevisionAchatsServicesForm annee={annee} />
          </TabsContent>

          <TabsContent value="abonnements" className="mt-4">
            <PrevisionAbonnementsForm annee={annee} />
          </TabsContent>

          <TabsContent value="charges" className="mt-4">
            <PrevisionChargesSalarialesForm annee={annee} />
          </TabsContent>

          <TabsContent value="achats-generaux" className="mt-4">
            <PrevisionAchatsGenerauxForm annee={annee} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
