import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Link2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface TaxCard {
  id: string;
  code: string;
  title: string;
  color: string;
}

interface Abonnement {
  id: string;
  nom: string;
  nature: string;
  montant_mensuel: number | null;
  actif: boolean;
}

interface TaxCardAbonnement {
  id: string;
  tax_card_id: string;
  abonnement_id: string;
  tax_card?: TaxCard;
  abonnement?: Abonnement;
}

interface PaiementAbonnement {
  id: string;
  date_paiement: string;
  montant: number;
  abonnement: Abonnement;
}

interface Props {
  selectedYear: number;
}

export default function FiscaliteAbonnementsTab({ selectedYear }: Props) {
  const [taxCards, setTaxCards] = useState<TaxCard[]>([]);
  const [abonnements, setAbonnements] = useState<Abonnement[]>([]);
  const [associations, setAssociations] = useState<TaxCardAbonnement[]>([]);
  const [paiements, setPaiements] = useState<PaiementAbonnement[]>([]);
  const [selectedTaxCard, setSelectedTaxCard] = useState<string>("");
  const [selectedAbonnement, setSelectedAbonnement] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [selectedYear]);

  const loadData = async () => {
    try {
      const [taxCardsResult, abonnementsResult, associationsResult] = await Promise.all([
        supabase.from("tax_cards").select("id, code, title, color").eq("is_active", true).order("display_order"),
        supabase.from("abonnements_partenaires").select("id, nom, nature, montant_mensuel, actif").eq("actif", true).order("nom"),
        supabase.from("tax_card_abonnements").select("*, tax_card:tax_cards(*), abonnement:abonnements_partenaires(*)")
      ]);

      if (taxCardsResult.error) throw taxCardsResult.error;
      if (abonnementsResult.error) throw abonnementsResult.error;
      if (associationsResult.error) throw associationsResult.error;

      setTaxCards(taxCardsResult.data || []);
      setAbonnements(abonnementsResult.data || []);
      setAssociations(associationsResult.data || []);

      // Charger les paiements pour les abonnements associés
      const abonnementIds = (associationsResult.data || []).map(a => a.abonnement_id);
      if (abonnementIds.length > 0) {
        const startDate = `${selectedYear}-01-01`;
        const endDate = `${selectedYear}-12-31`;
        
        const { data: paiementsData, error: paiementsError } = await supabase
          .from("paiements_abonnements")
          .select("*, abonnement:abonnements_partenaires(*)")
          .in("abonnement_id", abonnementIds)
          .gte("date_paiement", startDate)
          .lte("date_paiement", endDate)
          .order("date_paiement", { ascending: false });

        if (paiementsError) throw paiementsError;
        setPaiements(paiementsData || []);
      } else {
        setPaiements([]);
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAssociation = async () => {
    if (!selectedTaxCard || !selectedAbonnement) {
      toast.error("Veuillez sélectionner un impôt et un abonnement");
      return;
    }

    // Vérifier si l'association existe déjà
    const exists = associations.some(
      a => a.tax_card_id === selectedTaxCard && a.abonnement_id === selectedAbonnement
    );
    if (exists) {
      toast.error("Cette association existe déjà");
      return;
    }

    try {
      const { error } = await supabase
        .from("tax_card_abonnements")
        .insert({
          tax_card_id: selectedTaxCard,
          abonnement_id: selectedAbonnement
        });

      if (error) throw error;

      toast.success("Association créée");
      setSelectedTaxCard("");
      setSelectedAbonnement("");
      loadData();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la création de l'association");
    }
  };

  const handleRemoveAssociation = async (id: string) => {
    try {
      const { error } = await supabase
        .from("tax_card_abonnements")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Association supprimée");
      loadData();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  // Calculer les totaux par impôt
  const totauxParImpot = associations.reduce((acc, assoc) => {
    const paiementsImpot = paiements.filter(p => p.abonnement?.id === assoc.abonnement_id);
    const total = paiementsImpot.reduce((sum, p) => sum + p.montant, 0);
    
    if (assoc.tax_card) {
      const existing = acc.find(a => a.taxCardId === assoc.tax_card_id);
      if (existing) {
        existing.total += total;
        existing.nbPaiements += paiementsImpot.length;
      } else {
        acc.push({
          taxCardId: assoc.tax_card_id,
          taxCardTitle: assoc.tax_card.title,
          taxCardColor: assoc.tax_card.color,
          total,
          nbPaiements: paiementsImpot.length
        });
      }
    }
    return acc;
  }, [] as { taxCardId: string; taxCardTitle: string; taxCardColor: string; total: number; nbPaiements: number }[]);

  if (loading) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Création d'association */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Association Impôt / Abonnement
          </CardTitle>
          <CardDescription>
            Liez un type d'impôt à un abonnement pour récupérer automatiquement les paiements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Type d'impôt</label>
              <Select value={selectedTaxCard} onValueChange={setSelectedTaxCard}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un impôt" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {taxCards.map(tc => (
                    <SelectItem key={tc.id} value={tc.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tc.color }} />
                        {tc.title}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Abonnement</label>
              <Select value={selectedAbonnement} onValueChange={setSelectedAbonnement}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un abonnement" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {abonnements.map(ab => (
                    <SelectItem key={ab.id} value={ab.id}>
                      {ab.nom} - {ab.nature} ({ab.montant_mensuel?.toLocaleString("fr-FR")} €/mois)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddAssociation}>
              <Plus className="h-4 w-4 mr-2" />
              Associer
            </Button>
          </div>

          {/* Liste des associations */}
          {associations.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium mb-3">Associations existantes</h4>
              <div className="grid gap-2">
                {associations.map(assoc => (
                  <div
                    key={assoc.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: assoc.tax_card?.color }}
                        />
                        <span className="font-medium">{assoc.tax_card?.title}</span>
                      </div>
                      <span className="text-muted-foreground">→</span>
                      <span>{assoc.abonnement?.nom}</span>
                      <Badge variant="outline">{assoc.abonnement?.nature}</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveAssociation(assoc.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Résumé des paiements par impôt */}
      <Card>
        <CardHeader>
          <CardTitle>Totaux payés par type d'impôt ({selectedYear})</CardTitle>
          <CardDescription>
            Montants récupérés depuis les paiements d'abonnements associés
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totauxParImpot.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {totauxParImpot.map(item => (
                <div
                  key={item.taxCardId}
                  className="p-4 border rounded-lg"
                  style={{ borderLeftColor: item.taxCardColor, borderLeftWidth: 4 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.taxCardColor }} />
                    <span className="font-medium">{item.taxCardTitle}</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {item.total.toLocaleString("fr-FR")} €
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.nbPaiements} paiement{item.nbPaiements > 1 ? "s" : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucun paiement trouvé pour les abonnements associés
            </div>
          )}
        </CardContent>
      </Card>

      {/* Détail des paiements */}
      <Card>
        <CardHeader>
          <CardTitle>Détail des paiements ({selectedYear})</CardTitle>
          <CardDescription>
            Historique des paiements des abonnements liés aux impôts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paiements.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Abonnement</TableHead>
                    <TableHead>Nature</TableHead>
                    <TableHead>Impôt associé</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paiements.map(paiement => {
                    const assoc = associations.find(a => a.abonnement_id === paiement.abonnement?.id);
                    return (
                      <TableRow key={paiement.id}>
                        <TableCell>
                          {format(new Date(paiement.date_paiement), "dd/MM/yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {paiement.abonnement?.nom}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{paiement.abonnement?.nature}</Badge>
                        </TableCell>
                        <TableCell>
                          {assoc?.tax_card && (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: assoc.tax_card.color }}
                              />
                              {assoc.tax_card.title}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {paiement.montant.toLocaleString("fr-FR")} €
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucun paiement trouvé pour {selectedYear}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
