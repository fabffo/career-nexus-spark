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
  index: number;
  transaction: {
    date: string;
    libelle: string;
    debit: number;
    credit: number;
    montant: number;
    numero_ligne?: string;
  };
  status: "matched" | "unmatched" | "uncertain";
  fichierId: string;
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

  // Rechercher dans les fichiers de rapprochement EN_COURS
  const { data: transactionsEnCours = [], isLoading, refetch } = useQuery({
    queryKey: ["rapprochement-search", searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.trim().length < 2) return [];

      // Récupérer les fichiers en cours
      const { data: fichiers, error } = await supabase
        .from("fichiers_rapprochement")
        .select("*")
        .eq("statut", "EN_COURS");

      if (error) throw error;
      if (!fichiers || fichiers.length === 0) return [];

      const results: TransactionEnCours[] = [];
      
      // Parser la syntaxe de recherche
      // Virgule = OU, Espace = ET
      const orGroups = searchTerm.split(",").map(g => g.trim().toLowerCase()).filter(g => g.length > 0);
      
      const matchesSearch = (libelle: string): boolean => {
        const libelleLower = libelle.toLowerCase();
        
        // Pour chaque groupe OR, vérifier si TOUS les mots (AND) sont présents
        return orGroups.some(group => {
          const andWords = group.split(/\s+/).filter(w => w.length > 0);
          return andWords.every(word => libelleLower.includes(word));
        });
      };

      fichiers.forEach((fichier) => {
        const fichierData = fichier.fichier_data as any;
        if (!fichierData?.rapprochements) return;

        fichierData.rapprochements.forEach((rapp: any, index: number) => {
          if (!rapp.transaction) return;
          
          const libelle = rapp.transaction.libelle || "";
          if (matchesSearch(libelle)) {
            // Ne montrer que les transactions non rapprochées
            if (rapp.status === "unmatched" || rapp.status === "uncertain") {
              results.push({
                index,
                transaction: rapp.transaction,
                status: rapp.status,
                fichierId: fichier.id,
              });
            }
          }
        });
      });

      return results;
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

  const handleMatch = async (transaction: TransactionEnCours) => {
    try {
      // Récupérer le fichier actuel
      const { data: fichier, error: fetchError } = await supabase
        .from("fichiers_rapprochement")
        .select("*")
        .eq("id", transaction.fichierId)
        .single();

      if (fetchError) throw fetchError;

      const fichierData = fichier.fichier_data as any;
      
      // Mettre à jour le rapprochement avec les infos de l'entité
      const updatedRapprochements = [...fichierData.rapprochements];
      const rapp = updatedRapprochements[transaction.index];
      
      if (rapp) {
        rapp.status = "matched";
        
        // Ajouter les infos selon le type d'entité
        switch (entityType) {
          case "abonnement":
            rapp.abonnement_info = { id: entityId, nom: entityName };
            break;
          case "declaration":
            rapp.declaration_info = { id: entityId, nom: entityName, organisme: "" };
            break;
          case "fournisseur":
            rapp.fournisseur_info = { id: entityId, nom: entityName, type: "general" };
            break;
          case "fournisseur_services":
            rapp.fournisseur_info = { id: entityId, nom: entityName, type: "services" };
            break;
          case "fournisseur_etat":
            rapp.fournisseur_info = { id: entityId, nom: entityName, type: "etat" };
            break;
          case "client":
            rapp.client_info = { id: entityId, nom: entityName };
            break;
          case "prestataire":
            rapp.prestataire_info = { id: entityId, nom: entityName };
            break;
          case "salarie":
            rapp.salarie_info = { id: entityId, nom: entityName };
            break;
        }

        // Sauvegarder
        const { error: updateError } = await supabase
          .from("fichiers_rapprochement")
          .update({
            fichier_data: {
              ...fichierData,
              rapprochements: updatedRapprochements,
            },
            lignes_rapprochees: fichier.lignes_rapprochees + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction.fichierId);

        if (updateError) throw updateError;

        toast.success("Transaction rapprochée avec succès");
        
        if (onMatch) {
          onMatch(transaction.fichierId);
        }
        
        // Rafraîchir les résultats
        refetch();
      }
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
                      key={`${t.fichierId}-${t.index}-${idx}`}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm border"
                    >
                      <div className="flex-1">
                        <div className="font-medium truncate max-w-md">
                          {t.transaction.libelle}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(t.transaction.date)}
                          {t.transaction.numero_ligne && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              Ligne: {t.transaction.numero_ligne}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.transaction.debit && t.transaction.debit > 0 ? (
                          <Badge variant="destructive">
                            -{formatCurrency(t.transaction.debit)}
                          </Badge>
                        ) : t.transaction.credit && t.transaction.credit > 0 ? (
                          <Badge variant="default" className="bg-green-600">
                            +{formatCurrency(t.transaction.credit)}
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            {formatCurrency(Math.abs(t.transaction.montant))}
                          </Badge>
                        )}
                        <Badge variant={t.status === "uncertain" ? "secondary" : "outline"}>
                          {t.status === "uncertain" ? "Incertain" : "Non rapproché"}
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
