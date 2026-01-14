import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Calendar, Euro, Building, RefreshCw, Check, X } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

type EntityType = "client" | "prestataire" | "abonnement" | "fournisseur" | "declaration" | "salarie" | "fournisseur_services" | "fournisseur_etat" | "banque";

interface RapprochementSearchSectionProps {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  savedKeywords?: string;
  onMatch?: (rapprochementId: string) => void;
}

interface TransactionEnCours {
  id: string;
  numero_ligne: string;
  transaction_date: string;
  transaction_libelle: string;
  transaction_debit: number | null;
  transaction_credit: number | null;
  transaction_montant: number | null;
  statut: string;
  fichier_rapprochement_id: string;
}

export function RapprochementSearchSection({ 
  entityType, 
  entityId, 
  entityName,
  savedKeywords,
  onMatch 
}: RapprochementSearchSectionProps) {
  // IMPORTANT: certains enregistrements ont savedKeywords = '' (string vide)
  // Dans ce cas, on doit retomber sur le nom de l'entité.
  const getEffectiveKeywords = (kw?: string) => {
    const v = (kw ?? "").trim();
    return v.length > 0 ? v : (entityName || "");
  };

  const [searchKeyword, setSearchKeyword] = useState(getEffectiveKeywords(savedKeywords));
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Mettre à jour si les savedKeywords / entityName changent
  useEffect(() => {
    setSearchKeyword(getEffectiveKeywords(savedKeywords));
  }, [savedKeywords, entityName]);

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchKeyword(newValue);
  };

  // Rechercher dans la table lignes_rapprochement pour les fichiers EN_COURS
  const { data: transactionsEnCours = [], isLoading, refetch } = useQuery({
    queryKey: ["rapprochement-search", searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.trim().length < 2) return [];

      // Récupérer les fichiers en cours
      const { data: fichiers, error: fichiersError } = await supabase
        .from("fichiers_rapprochement")
        .select("id")
        .eq("statut", "EN_COURS");

      if (fichiersError) throw fichiersError;
      if (!fichiers || fichiers.length === 0) return [];

      const fichierIds = fichiers.map(f => f.id);

      // Parser la syntaxe de recherche
      // Virgule = OU, Espace = ET
      const orGroups = searchTerm.split(",").map(g => g.trim().toLowerCase()).filter(g => g.length > 0);
      
      // Récupérer les lignes de rapprochement pour ces fichiers
      const { data: lignes, error: lignesError } = await supabase
        .from("lignes_rapprochement")
        .select("*")
        .in("fichier_rapprochement_id", fichierIds)
        .in("statut", ["unmatched", "uncertain"]);

      if (lignesError) throw lignesError;
      if (!lignes) return [];

      // Filtrer les résultats selon les mots-clés
      const matchesSearch = (libelle: string): boolean => {
        const libelleLower = libelle.toLowerCase();
        
        // Pour chaque groupe OR, vérifier si TOUS les mots (AND) sont présents
        return orGroups.some(group => {
          const andWords = group.split(/\s+/).filter(w => w.length > 0);
          return andWords.every(word => libelleLower.includes(word));
        });
      };

      return lignes.filter(ligne => matchesSearch(ligne.transaction_libelle));
    },
    enabled: searchTerm.length >= 2,
  });

  const handleSearch = () => {
    setSearchTerm(searchKeyword);
    setIsSearching(true);
    refetch();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleMatch = async (ligne: TransactionEnCours) => {
    try {
      // Déterminer le type de fournisseur selon entityType
      let fournisseurType: string | null = null;
      switch (entityType) {
        case "fournisseur":
          fournisseurType = "general";
          break;
        case "fournisseur_services":
          fournisseurType = "services";
          break;
        case "fournisseur_etat":
          fournisseurType = "etat";
          break;
        case "client":
          fournisseurType = "client";
          break;
        case "banque":
          fournisseurType = "banque";
          break;
        case "prestataire":
          fournisseurType = "prestataire";
          break;
        case "salarie":
          fournisseurType = "salarie";
          break;
      }

      // Préparer les données de mise à jour
      const updateData: any = {
        statut: "uncertain", // Partenaire seul = incertain
        updated_at: new Date().toISOString(),
      };

      // Ajouter les infos selon le type d'entité
      if (entityType === "abonnement") {
        updateData.abonnement_id = entityId;
        updateData.statut = "matched"; // Abonnement = rapproché
      } else if (entityType === "declaration") {
        updateData.declaration_charge_id = entityId;
        updateData.statut = "matched"; // Déclaration = rapproché
      } else if (fournisseurType) {
        updateData.fournisseur_detecte_id = entityId;
        updateData.fournisseur_detecte_nom = entityName;
        updateData.fournisseur_detecte_type = fournisseurType;
      }

      // Mettre à jour la ligne de rapprochement
      const { error: updateError } = await supabase
        .from("lignes_rapprochement")
        .update(updateData)
        .eq("id", ligne.id);

      if (updateError) throw updateError;

      // Mettre à jour le compteur du fichier
      const { data: fichier } = await supabase
        .from("fichiers_rapprochement")
        .select("lignes_rapprochees")
        .eq("id", ligne.fichier_rapprochement_id)
        .single();

      if (fichier && updateData.statut === "matched") {
        await supabase
          .from("fichiers_rapprochement")
          .update({
            lignes_rapprochees: (fichier.lignes_rapprochees || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", ligne.fichier_rapprochement_id);
      }

      toast.success("Transaction rapprochée avec succès");
      
      if (onMatch) {
        onMatch(ligne.fichier_rapprochement_id);
      }
      
      // Rafraîchir les résultats
      refetch();
    } catch (error) {
      console.error("Erreur lors du rapprochement:", error);
      toast.error("Erreur lors du rapprochement");
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "-";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy", { locale: fr });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Search className="h-5 w-5" />
          Recherche de rapprochement bancaire
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Zone de recherche */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Mot clé à rechercher dans les libellés..."
              value={searchKeyword}
              onChange={handleKeywordChange}
              onKeyPress={handleKeyPress}
              className="w-full"
            />
          </div>
          <Button onClick={handleSearch} disabled={isLoading || searchKeyword.length < 2}>
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="ml-2">Rechercher</span>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          <strong>Syntaxe :</strong> Espace = ET (tous les mots), Virgule = OU (l'un ou l'autre). 
          Ex: <code className="bg-muted px-1 rounded">ORANGE ABONNEMENT</code> ou <code className="bg-muted px-1 rounded">ORANGE, SFR</code>
        </p>

        {/* Résultats */}
        {isSearching && (
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                Recherche en cours...
              </p>
            ) : transactionsEnCours.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                Aucune transaction trouvée pour "{searchTerm}"
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">
                    {transactionsEnCours.length} transaction(s) trouvée(s)
                  </Badge>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {transactionsEnCours.map((t, idx) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm border"
                    >
                      <div className="flex-1">
                        <div className="font-medium truncate max-w-md">
                          {t.transaction_libelle}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(t.transaction_date)}
                          {t.numero_ligne && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              Ligne: {t.numero_ligne}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.transaction_debit && t.transaction_debit > 0 ? (
                          <Badge variant="destructive">
                            -{formatCurrency(t.transaction_debit)}
                          </Badge>
                        ) : t.transaction_credit && t.transaction_credit > 0 ? (
                          <Badge variant="default" className="bg-green-600">
                            +{formatCurrency(t.transaction_credit)}
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            {formatCurrency(Math.abs(t.transaction_montant || 0))}
                          </Badge>
                        )}
                        <Badge variant={t.statut === "uncertain" ? "secondary" : "outline"}>
                          {t.statut === "uncertain" ? "Incertain" : "Non rapproché"}
                        </Badge>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleMatch(t)}
                          title="Rapprocher avec cette entité"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
