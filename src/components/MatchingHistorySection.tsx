import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2, Calendar, Euro, FileText, Building } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type EntityType = "abonnement" | "fournisseur" | "declaration";

interface MatchingHistorySectionProps {
  entityType: EntityType;
  entityId: string;
  entityName: string;
}

interface RapprochementMatch {
  id: string;
  transaction_date: string;
  transaction_libelle: string;
  transaction_montant: number;
  transaction_debit: number | null;
  transaction_credit: number | null;
  numero_ligne: string;
  created_at: string;
}

interface FactureMatch {
  id: string;
  numero_facture: string;
  date_emission: string;
  total_ttc: number | null;
  emetteur_nom: string;
  destinataire_nom: string;
  type_facture: string;
}

export function MatchingHistorySection({ entityType, entityId, entityName }: MatchingHistorySectionProps) {
  // Récupérer les rapprochements bancaires liés à l'entité
  const { data: rapprochements = [], isLoading: loadingRapprochements } = useQuery({
    queryKey: ["matching-history", entityType, entityId, "rapprochements"],
    queryFn: async () => {
      let query = supabase
        .from("rapprochements_bancaires")
        .select("*")
        .order("transaction_date", { ascending: false });

      if (entityType === "abonnement") {
        query = query.eq("abonnement_id", entityId);
      } else if (entityType === "declaration") {
        query = query.eq("declaration_charge_id", entityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: entityType === "abonnement" || entityType === "declaration",
  });

  // Pour les fournisseurs généraux, chercher dans les factures avec le nom du fournisseur
  const { data: factures = [], isLoading: loadingFactures } = useQuery({
    queryKey: ["matching-history", entityType, entityId, "factures"],
    queryFn: async () => {
      if (entityType !== "fournisseur") return [];
      
      const { data, error } = await supabase
        .from("factures")
        .select("*")
        .or(`emetteur_nom.ilike.%${entityName}%,destinataire_nom.ilike.%${entityName}%`)
        .order("date_emission", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: entityType === "fournisseur",
  });

  // Chercher aussi les rapprochements via les factures pour les fournisseurs
  const { data: facturesRapprochements = [], isLoading: loadingFacturesRapprochements } = useQuery({
    queryKey: ["matching-history", entityType, entityId, "factures-rapprochements"],
    queryFn: async () => {
      if (entityType !== "fournisseur" || factures.length === 0) return [];
      
      const factureIds = factures.map(f => f.id);
      const { data, error } = await supabase
        .from("rapprochements_bancaires")
        .select("*")
        .in("facture_id", factureIds)
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: entityType === "fournisseur" && factures.length > 0,
  });

  // Récupérer les paiements d'abonnements
  const { data: paiementsAbonnements = [], isLoading: loadingPaiements } = useQuery({
    queryKey: ["matching-history", "paiements-abonnements", entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paiements_abonnements")
        .select("*, rapprochement:rapprochements_bancaires(*)")
        .eq("abonnement_id", entityId)
        .order("date_paiement", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: entityType === "abonnement",
  });

  // Récupérer les paiements de déclarations
  const { data: paiementsDeclarations = [], isLoading: loadingPaiementsDecl } = useQuery({
    queryKey: ["matching-history", "paiements-declarations", entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paiements_declarations_charges")
        .select("*, rapprochement:rapprochements_bancaires(*)")
        .eq("declaration_charge_id", entityId)
        .order("date_paiement", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: entityType === "declaration",
  });

  const isLoading = loadingRapprochements || loadingFactures || loadingFacturesRapprochements || loadingPaiements || loadingPaiementsDecl;

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

  // Combiner tous les matchings
  const allRapprochements = entityType === "fournisseur" 
    ? facturesRapprochements 
    : rapprochements;

  const hasData = allRapprochements.length > 0 || factures.length > 0 || paiementsAbonnements.length > 0 || paiementsDeclarations.length > 0;

  if (isLoading) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5" />
            Historique des matchings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  if (!hasData) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5" />
            Historique des matchings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Aucun matching trouvé pour cette entité.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="h-5 w-5" />
          Historique des matchings
          <Badge variant="secondary" className="ml-2">
            {allRapprochements.length + factures.length + paiementsAbonnements.length + paiementsDeclarations.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rapprochements bancaires */}
        {allRapprochements.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Building className="h-4 w-4" />
              Transactions bancaires rapprochées
            </h4>
            <div className="space-y-2">
              {allRapprochements.slice(0, 10).map((r: RapprochementMatch) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm"
                >
                  <div className="flex-1">
                    <div className="font-medium truncate max-w-md">
                      {r.transaction_libelle}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(r.transaction_date)}
                      <span className="text-muted-foreground">•</span>
                      Ligne: {r.numero_ligne}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.transaction_debit && r.transaction_debit > 0 ? (
                      <Badge variant="destructive">
                        -{formatCurrency(r.transaction_debit)}
                      </Badge>
                    ) : r.transaction_credit && r.transaction_credit > 0 ? (
                      <Badge variant="default" className="bg-green-600">
                        +{formatCurrency(r.transaction_credit)}
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        {formatCurrency(Math.abs(r.transaction_montant))}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {allRapprochements.length > 10 && (
                <p className="text-xs text-muted-foreground text-center">
                  + {allRapprochements.length - 10} autres transactions
                </p>
              )}
            </div>
          </div>
        )}

        {/* Factures liées (pour fournisseurs) */}
        {factures.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Factures associées
            </h4>
            <div className="space-y-2">
              {factures.slice(0, 10).map((f: FactureMatch) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm"
                >
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      {f.numero_facture}
                      <Badge variant="outline" className="text-xs">
                        {f.type_facture}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {f.emetteur_nom} → {f.destinataire_nom}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(f.date_emission)}
                    </span>
                    <Badge variant="secondary">
                      {formatCurrency(f.total_ttc)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Paiements d'abonnements */}
        {paiementsAbonnements.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Euro className="h-4 w-4" />
              Paiements enregistrés
            </h4>
            <div className="space-y-2">
              {paiementsAbonnements.slice(0, 10).map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm"
                >
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {formatDate(p.date_paiement)}
                      {p.notes && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <span className="truncate max-w-xs">{p.notes}</span>
                        </>
                      )}
                    </div>
                    {p.rapprochement && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Transaction: {p.rapprochement.transaction_libelle?.substring(0, 50)}...
                      </div>
                    )}
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    {formatCurrency(p.montant)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Paiements de déclarations */}
        {paiementsDeclarations.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Euro className="h-4 w-4" />
              Paiements enregistrés
            </h4>
            <div className="space-y-2">
              {paiementsDeclarations.slice(0, 10).map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm"
                >
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {formatDate(p.date_paiement)}
                      {p.notes && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <span className="truncate max-w-xs">{p.notes}</span>
                        </>
                      )}
                    </div>
                    {p.rapprochement && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Transaction: {p.rapprochement.transaction_libelle?.substring(0, 50)}...
                      </div>
                    )}
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    {formatCurrency(p.montant)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
