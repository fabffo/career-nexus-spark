import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Building2, Receipt, Circle } from "lucide-react";

interface Rapprochement {
  facture?: { id: string; numero_facture?: string } | null;
  factureIds?: string[];
  abonnement_info?: { id: string; nom: string };
  declaration_info?: { id: string; nom: string; organisme?: string };
  fournisseur_info?: { id: string; nom: string; type?: string };
}

interface RapprochementTypeIndicatorProps {
  rapprochement: Rapprochement;
  showLabels?: boolean;
}

export function RapprochementTypeIndicator({ rapprochement, showLabels = false }: RapprochementTypeIndicatorProps) {
  // Déterminer si on a un rapprochement facture
  const hasFacture = Boolean(rapprochement.facture?.id || (rapprochement.factureIds && rapprochement.factureIds.length > 0));
  
  // Déterminer si on a un rapprochement partenaire (abonnement, déclaration ou fournisseur)
  const hasPartenaire = Boolean(
    rapprochement.abonnement_info?.id || 
    rapprochement.declaration_info?.id || 
    rapprochement.fournisseur_info?.id
  );
  
  // Calculer le niveau de rapprochement (0, 1 ou 2)
  const rapprochementCount = (hasFacture ? 1 : 0) + (hasPartenaire ? 1 : 0);
  
  // Déterminer la couleur du statut global
  const getStatusColor = () => {
    if (rapprochementCount === 0) return "text-red-600 bg-red-50";
    if (rapprochementCount === 1) return "text-orange-600 bg-orange-50";
    return "text-green-600 bg-green-50";
  };
  
  const getStatusBorderColor = () => {
    if (rapprochementCount === 0) return "border-red-300";
    if (rapprochementCount === 1) return "border-orange-300";
    return "border-green-300";
  };

  // Obtenir le nom du partenaire
  const getPartenaireNom = () => {
    if (rapprochement.abonnement_info) return rapprochement.abonnement_info.nom;
    if (rapprochement.declaration_info) return `${rapprochement.declaration_info.nom}${rapprochement.declaration_info.organisme ? ` (${rapprochement.declaration_info.organisme})` : ''}`;
    if (rapprochement.fournisseur_info) return rapprochement.fournisseur_info.nom;
    return null;
  };

  // Obtenir le type de partenaire
  const getPartenaireType = () => {
    if (rapprochement.abonnement_info) return "Abonnement";
    if (rapprochement.declaration_info) return "Déclaration";
    if (rapprochement.fournisseur_info) return "Fournisseur";
    return null;
  };

  // Obtenir le nombre de factures
  const getFacturesCount = () => {
    if (rapprochement.facture?.id) return 1;
    if (rapprochement.factureIds && rapprochement.factureIds.length > 0) return rapprochement.factureIds.length;
    return 0;
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {/* Indicateur de statut global */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center justify-center w-6 h-6 rounded-full border ${getStatusColor()} ${getStatusBorderColor()}`}>
              <Circle className={`h-3 w-3 fill-current`} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">
              {rapprochementCount === 0 && "Aucun rapprochement"}
              {rapprochementCount === 1 && "Rapprochement partiel (1/2)"}
              {rapprochementCount === 2 && "Rapprochement complet (2/2)"}
            </p>
          </TooltipContent>
        </Tooltip>

        {/* Badge Partenaire */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={`gap-1 text-xs cursor-default ${
                hasPartenaire 
                  ? "border-green-500 text-green-700 bg-green-50" 
                  : "border-muted text-muted-foreground"
              }`}
            >
              <Building2 className="h-3 w-3" />
              {showLabels && "Partenaire"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {hasPartenaire ? (
              <div>
                <p className="font-medium text-green-600">✓ Rapproché partenaire</p>
                <p className="text-sm">{getPartenaireType()}: {getPartenaireNom()}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">Pas de rapprochement partenaire</p>
            )}
          </TooltipContent>
        </Tooltip>

        {/* Badge Facture */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={`gap-1 text-xs cursor-default ${
                hasFacture 
                  ? "border-blue-500 text-blue-700 bg-blue-50" 
                  : "border-muted text-muted-foreground"
              }`}
            >
              <FileText className="h-3 w-3" />
              {showLabels && "Facture"}
              {hasFacture && getFacturesCount() > 1 && (
                <span className="ml-0.5">({getFacturesCount()})</span>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {hasFacture ? (
              <div>
                <p className="font-medium text-blue-600">✓ Rapproché facture</p>
                <p className="text-sm">
                  {getFacturesCount()} facture{getFacturesCount() > 1 ? 's' : ''} associée{getFacturesCount() > 1 ? 's' : ''}
                  {rapprochement.facture?.numero_facture && `: ${rapprochement.facture.numero_facture}`}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">Pas de rapprochement facture</p>
            )}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

// Composant compact pour les tableaux avec espace limité
export function RapprochementTypeIndicatorCompact({ rapprochement }: RapprochementTypeIndicatorProps) {
  const hasFacture = Boolean(rapprochement.facture?.id || (rapprochement.factureIds && rapprochement.factureIds.length > 0));
  const hasPartenaire = Boolean(
    rapprochement.abonnement_info?.id || 
    rapprochement.declaration_info?.id || 
    rapprochement.fournisseur_info?.id
  );
  
  const rapprochementCount = (hasFacture ? 1 : 0) + (hasPartenaire ? 1 : 0);
  
  const getStatusClass = () => {
    if (rapprochementCount === 0) return "bg-red-500";
    if (rapprochementCount === 1) return "bg-orange-500";
    return "bg-green-500";
  };

  const getPartenaireNom = () => {
    if (rapprochement.abonnement_info) return rapprochement.abonnement_info.nom;
    if (rapprochement.declaration_info) return rapprochement.declaration_info.nom;
    if (rapprochement.fournisseur_info) return rapprochement.fournisseur_info.nom;
    return null;
  };

  const getPartenaireType = () => {
    if (rapprochement.abonnement_info) return "Abonnement";
    if (rapprochement.declaration_info) return "Déclaration";
    if (rapprochement.fournisseur_info) return "Fournisseur";
    return null;
  };

  const getFacturesCount = () => {
    if (rapprochement.facture?.id) return 1;
    if (rapprochement.factureIds && rapprochement.factureIds.length > 0) return rapprochement.factureIds.length;
    return 0;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            {/* Point de statut global */}
            <div className={`w-2.5 h-2.5 rounded-full ${getStatusClass()}`} />
            
            {/* Indicateurs individuels */}
            <div className="flex items-center gap-0.5">
              <Building2 className={`h-3.5 w-3.5 ${hasPartenaire ? "text-green-600" : "text-muted-foreground/40"}`} />
              <FileText className={`h-3.5 w-3.5 ${hasFacture ? "text-blue-600" : "text-muted-foreground/40"}`} />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">
              {rapprochementCount === 0 && "❌ Aucun rapprochement"}
              {rapprochementCount === 1 && "⚠️ Rapprochement partiel"}
              {rapprochementCount === 2 && "✅ Rapprochement complet"}
            </p>
            <div className="text-sm space-y-0.5">
              <p className={hasPartenaire ? "text-green-600" : "text-muted-foreground"}>
                {hasPartenaire ? `✓ Partenaire: ${getPartenaireType()} - ${getPartenaireNom()}` : "○ Partenaire: non rapproché"}
              </p>
              <p className={hasFacture ? "text-blue-600" : "text-muted-foreground"}>
                {hasFacture ? `✓ Facture: ${getFacturesCount()} associée${getFacturesCount() > 1 ? 's' : ''}` : "○ Facture: non rapprochée"}
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
