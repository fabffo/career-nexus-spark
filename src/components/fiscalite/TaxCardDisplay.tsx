import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import * as LucideIcons from "lucide-react";

interface TaxCardField {
  id: string;
  label: string;
  value: string;
  display_order: number;
}

interface TaxCard {
  id: string;
  code: string;
  title: string;
  subtitle: string | null;
  frequency: string;
  organism: string | null;
  icon: string;
  color: string;
  display_order: number;
  fields?: TaxCardField[];
}

interface TaxCardDisplayProps {
  taxCard: TaxCard;
}

export default function TaxCardDisplay({ taxCard }: TaxCardDisplayProps) {
  const getIcon = (iconName: string) => {
    // Convertir kebab-case en PascalCase
    const pascalCase = iconName
      .split("-")
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");
    const IconComponent = (LucideIcons as any)[pascalCase];
    return IconComponent || LucideIcons.FileText;
  };

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case "MENSUEL": return "Mensuel";
      case "TRIMESTRIEL": return "Trimestriel";
      case "ANNUEL": return "Annuel";
      case "PONCTUEL": return "Ponctuel";
      default: return frequency;
    }
  };

  const getFrequencyVariant = (frequency: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (frequency) {
      case "MENSUEL": return "default";
      case "TRIMESTRIEL": return "secondary";
      case "ANNUEL": return "outline";
      case "PONCTUEL": return "destructive";
      default: return "secondary";
    }
  };

  const Icon = getIcon(taxCard.icon);
  const sortedFields = taxCard.fields?.sort((a, b) => a.display_order - b.display_order) || [];

  return (
    <Card className="hover:shadow-lg transition-shadow h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: `${taxCard.color}20` }}
          >
            <Icon 
              className="h-6 w-6" 
              style={{ color: taxCard.color }}
            />
          </div>
          <Badge variant={getFrequencyVariant(taxCard.frequency)}>
            {getFrequencyLabel(taxCard.frequency)}
          </Badge>
        </div>
        <CardTitle className="mt-4 text-lg">{taxCard.title}</CardTitle>
        {taxCard.subtitle && (
          <p className="text-sm text-muted-foreground">{taxCard.subtitle}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sortedFields.map((field) => (
            <div key={field.id} className="text-sm">
              <span className="font-medium">{field.label}:</span>{" "}
              <span className="text-muted-foreground">{field.value}</span>
            </div>
          ))}
          
          {taxCard.organism && (
            <div className="pt-2 mt-2 border-t">
              <span className="text-xs text-muted-foreground">
                Organisme: {taxCard.organism}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
