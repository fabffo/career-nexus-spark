import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Contrat } from "@/types/contrat";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignatureContrats() {
  const { user } = useAuth();
  const [contratsActifs, setContratsActifs] = useState<Contrat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContrat, setSelectedContrat] = useState<Contrat | null>(null);
  const [adobeSignUrl, setAdobeSignUrl] = useState("");

  useEffect(() => {
    fetchContratsActifs();
  }, []);

  const fetchContratsActifs = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("contrats")
        .select(`
          *,
          client:client_id(raison_sociale),
          prestataire:prestataires(nom, prenom),
          fournisseur_services:fournisseurs_services(raison_sociale),
          fournisseur_general:fournisseurs_generaux(raison_sociale),
          fournisseur_etat_organisme:fournisseurs_etat_organismes(raison_sociale),
          client_lie:client_lie_id(raison_sociale)
        `)
        .eq("statut", "ACTIF")
        .order("date_debut", { ascending: false });

      if (error) throw error;
      setContratsActifs(data || []);
    } catch (error: any) {
      console.error("Erreur lors du chargement des contrats:", error);
      toast.error("Erreur lors du chargement des contrats");
    } finally {
      setLoading(false);
    }
  };

  const handleSendToAdobeSign = async (contrat: Contrat) => {
    if (!adobeSignUrl) {
      toast.error("Veuillez configurer l'URL Adobe Sign dans les paramètres");
      return;
    }

    // Ouvrir Adobe Sign dans un nouvel onglet
    window.open(adobeSignUrl, "_blank");
    toast.success("Ouverture d'Adobe Sign pour la signature");
  };

  const getEntityName = (contrat: Contrat) => {
    if (contrat.client) return contrat.client.raison_sociale;
    if (contrat.prestataire) return `${contrat.prestataire.nom} ${contrat.prestataire.prenom}`;
    if (contrat.fournisseur_services) return contrat.fournisseur_services.raison_sociale;
    if (contrat.fournisseur_general) return contrat.fournisseur_general.raison_sociale;
    if (contrat.fournisseur_etat_organisme) return contrat.fournisseur_etat_organisme.raison_sociale;
    return "Non spécifié";
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CLIENT: "Client",
      PRESTATAIRE: "Prestataire",
      FOURNISSEUR_SERVICES: "Fournisseur Services",
      FOURNISSEUR_GENERAL: "Fournisseur Général",
      FOURNISSEUR_ETAT_ORGANISME: "État/Organisme",
    };
    return labels[type] || type;
  };

  const handleDownload = async (contrat: Contrat) => {
    if (!contrat.piece_jointe_url) {
      toast.error("Aucun document disponible pour ce contrat");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("factures")
        .download(contrat.piece_jointe_url);

      if (error) throw error;

      const blob = new Blob([data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Contrat_${contrat.numero_contrat}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Contrat téléchargé avec succès");
    } catch (error: any) {
      console.error("Erreur lors du téléchargement:", error);
      toast.error("Erreur lors du téléchargement du contrat");
    }
  };

  const columns: ColumnDef<Contrat>[] = [
    {
      accessorKey: "numero_contrat",
      header: "N° Contrat",
      cell: ({ row }) => <span className="font-medium">{row.original.numero_contrat}</span>,
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <Badge variant="outline">{getTypeLabel(row.original.type)}</Badge>,
    },
    {
      id: "entite",
      header: "Entité",
      cell: ({ row }) => getEntityName(row.original),
    },
    {
      accessorKey: "date_debut",
      header: "Date début",
      cell: ({ row }) =>
        format(new Date(row.original.date_debut), "dd/MM/yyyy", { locale: fr }),
    },
    {
      accessorKey: "date_fin",
      header: "Date fin",
      cell: ({ row }) =>
        row.original.date_fin
          ? format(new Date(row.original.date_fin), "dd/MM/yyyy", { locale: fr })
          : "Indéterminée",
    },
    {
      accessorKey: "montant",
      header: "Montant",
      cell: ({ row }) =>
        row.original.montant ? `${row.original.montant.toLocaleString("fr-FR")} €` : "-",
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload(row.original)}
            disabled={!row.original.piece_jointe_url}
          >
            Télécharger
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              setSelectedContrat(row.original);
              handleSendToAdobeSign(row.original);
            }}
          >
            <FileSignature className="mr-2 h-4 w-4" />
            Signer
          </Button>
        </div>
      ),
      meta: { className: "text-right" },
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Signature des Contrats</h1>
          <p className="text-muted-foreground mt-2">
            Gérez la signature électronique de vos contrats actifs
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">
              <FileSignature className="mr-2 h-4 w-4" />
              Configurer Adobe Sign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configuration Adobe Sign</DialogTitle>
              <DialogDescription>
                Configurez l'intégration avec Adobe Sign pour la signature électronique
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="adobeSignUrl">URL Adobe Sign</Label>
                <Input
                  id="adobeSignUrl"
                  placeholder="https://secure.na1.adobesign.com/..."
                  value={adobeSignUrl}
                  onChange={(e) => setAdobeSignUrl(e.target.value)}
                />
              </div>
              <Button onClick={() => toast.success("Configuration enregistrée")}>
                Enregistrer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contrats Actifs à Signer</CardTitle>
          <CardDescription>
            {contratsActifs.length} contrat(s) actif(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={contratsActifs || []}
            searchPlaceholder="Rechercher un contrat..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Guide Adobe Sign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Configuration requise:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Créez un compte Adobe Sign sur <a href="https://acrobat.adobe.com/fr/fr/sign.html" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">acrobat.adobe.com</a></li>
              <li>Obtenez votre URL d'intégration depuis votre tableau de bord Adobe Sign</li>
              <li>Configurez l'URL dans le bouton "Configurer Adobe Sign" ci-dessus</li>
              <li>Téléchargez le contrat puis uploadez-le sur Adobe Sign pour signature</li>
            </ol>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Fonctionnalités Adobe Sign:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Signature électronique légalement valable</li>
              <li>Suivi en temps réel du statut de signature</li>
              <li>Rappels automatiques aux signataires</li>
              <li>Archivage sécurisé des documents signés</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
