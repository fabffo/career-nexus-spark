import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, Printer } from "lucide-react";
import type { Facture, FactureLigne } from "@/pages/Factures";

interface ViewFactureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facture: Facture;
}

export default function ViewFactureDialog({ 
  open, 
  onOpenChange, 
  facture 
}: ViewFactureDialogProps) {
  const [lignes, setLignes] = useState<FactureLigne[]>([]);
  const [societeInterne, setSocieteInterne] = useState<any>(null);

  useEffect(() => {
    if (open && facture) {
      fetchLignes();
      fetchSocieteInterne();
    }
  }, [open, facture]);

  const fetchLignes = async () => {
    try {
      const { data, error } = await supabase
        .from('facture_lignes')
        .select('*')
        .eq('facture_id', facture.id)
        .order('ordre');

      if (error) throw error;
      // Mapper les données avec les valeurs par défaut pour les colonnes manquantes
      const lignesWithDefaults = (data || []).map((ligne: any) => ({
        ...ligne,
        quantite: ligne.quantite || 1,
        prix_unitaire_ht: ligne.prix_unitaire_ht || ligne.prix_ht || 0
      }));
      setLignes(lignesWithDefaults);
    } catch (error) {
      console.error('Erreur lors du chargement des lignes:', error);
    }
  };

  const fetchSocieteInterne = async () => {
    try {
      const { data } = await supabase
        .from('societe_interne')
        .select('*')
        .single();
      setSocieteInterne(data);
    } catch (error) {
      console.error('Erreur lors du chargement de la société:', error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    try {
      // Pour les factures d'achat, télécharger le fichier depuis le storage
      if (facture.type_facture === 'ACHATS') {
        if (!facture.reference_societe) {
          alert('Aucun fichier n\'a été uploadé pour cette facture d\'achat.');
          return;
        }
        
        console.log('Téléchargement facture achat, chemin:', facture.reference_societe);
        
        let bucket = 'factures';
        let filePath = facture.reference_societe;
        
        // Gérer les anciens formats d'URL (URL complète dans candidats-files)
        if (filePath.includes('candidats-files')) {
          bucket = 'candidats-files';
          // Extraire le chemin depuis l'URL
          const match = filePath.match(/candidats-files\/(.+)$/);
          if (match) {
            filePath = match[1];
          }
        }
        
        console.log('Téléchargement depuis bucket:', bucket, 'chemin:', filePath);
        
        // Télécharger directement depuis le bucket
        const { data, error } = await supabase.storage
          .from(bucket)
          .download(filePath);

        if (error) {
          console.error('Erreur storage download:', error);
          throw error;
        }
        if (!data) throw new Error('Aucune donnée reçue');

        // Créer un blob et télécharger
        const downloadUrl = window.URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = downloadUrl;
        
        // Extraire l'extension du fichier original
        const extension = filePath.split('.').pop() || 'pdf';
        link.download = `facture_${facture.numero_facture}.${extension}`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        // Pour les factures de vente, générer le PDF via l'edge function
        console.log('Génération PDF pour facture vente ID:', facture.id);
        
        const { data: { session } } = await supabase.auth.getSession();
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        
        const response = await fetch(
          `${supabaseUrl}/functions/v1/generate-facture-pdf`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ facture_id: facture.id }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Erreur lors de la génération du PDF:', errorText);
          throw new Error('Erreur lors de la génération du PDF');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `facture_${facture.numero_facture}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      alert('Erreur lors du téléchargement du fichier. Veuillez réessayer.');
    }
  };

  const getStatutColor = (statut: string) => {
    const colors = {
      BROUILLON: 'bg-gray-100 text-gray-800',
      VALIDEE: 'bg-blue-100 text-blue-800',
      PAYEE: 'bg-green-100 text-green-800',
      ANNULEE: 'bg-red-100 text-red-800',
    };
    return colors[statut as keyof typeof colors] || '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:m-0 print:p-8">
        <DialogHeader className="print:hidden">
          <DialogTitle>Facture {facture.numero_facture}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Actions */}
          <div className="flex justify-end gap-2 print:hidden">
            <Button 
              onClick={handleDownload} 
              variant="outline"
              disabled={facture.type_facture === 'ACHATS' && !facture.reference_societe}
            >
              <Download className="h-4 w-4 mr-2" /> 
              {facture.type_facture === 'ACHATS' && !facture.reference_societe 
                ? 'Aucun fichier' 
                : 'Télécharger'}
            </Button>
            <Button onClick={handlePrint} variant="outline">
              <Printer className="h-4 w-4 mr-2" /> Imprimer
            </Button>
          </div>

          {/* En-tête de facture */}
          <div className="border-b pb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold">
                  {facture.type_facture === 'VENTES' ? 'FACTURE' : 'FACTURE D\'ACHAT'}
                </h1>
                <p className="text-lg mt-2">N° {facture.numero_facture}</p>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatutColor(facture.statut)}`}>
                  {facture.statut}
                </span>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Date d'émission</p>
              <p className="font-medium">
                {facture.date_emission ? format(new Date(facture.date_emission), "dd MMMM yyyy", { locale: fr }) : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date d'échéance</p>
              <p className="font-medium">
                {facture.date_echeance ? format(new Date(facture.date_echeance), "dd MMMM yyyy", { locale: fr }) : '-'}
              </p>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">Émetteur</h3>
              <div className="p-4 border rounded-lg bg-muted/20">
                <p className="font-medium">{facture.emetteur_nom}</p>
                {facture.emetteur_adresse && (
                  <p className="text-sm mt-1">{facture.emetteur_adresse}</p>
                )}
                {facture.emetteur_telephone && (
                  <p className="text-sm">Tél: {facture.emetteur_telephone}</p>
                )}
                {facture.emetteur_email && (
                  <p className="text-sm">Email: {facture.emetteur_email}</p>
                )}
                {facture.type_facture === 'VENTES' && societeInterne?.siren && (
                  <p className="text-sm">SIREN: {societeInterne.siren}</p>
                )}
                {facture.type_facture === 'VENTES' && societeInterne?.tva && (
                  <p className="text-sm">N° TVA: {societeInterne.tva}</p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-lg">Destinataire</h3>
              <div className="p-4 border rounded-lg bg-muted/20">
                <p className="font-medium">{facture.destinataire_nom}</p>
                {facture.destinataire_adresse && (
                  <p className="text-sm mt-1">{facture.destinataire_adresse}</p>
                )}
                {facture.destinataire_telephone && (
                  <p className="text-sm">Tél: {facture.destinataire_telephone}</p>
                )}
                {facture.destinataire_email && (
                  <p className="text-sm">Email: {facture.destinataire_email}</p>
                )}
                {facture.type_facture === 'ACHATS' && societeInterne?.siren && (
                  <p className="text-sm">SIREN: {societeInterne.siren}</p>
                )}
                {facture.type_facture === 'ACHATS' && societeInterne?.tva && (
                  <p className="text-sm">N° TVA: {societeInterne.tva}</p>
                )}
              </div>
            </div>
          </div>

          {/* Lignes de facture */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Détail de la facture</h3>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3">Description</th>
                    <th className="text-right p-3">Quantité</th>
                    <th className="text-right p-3">Prix unitaire HT</th>
                    <th className="text-right p-3">Montant HT</th>
                    <th className="text-right p-3">TVA %</th>
                    <th className="text-right p-3">Montant TVA</th>
                    <th className="text-right p-3">Montant TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((ligne, index) => {
                    const montantTva = (ligne.montant_tva || 0);
                    const prixTtc = (ligne.prix_ttc || 0);
                    
                    return (
                      <tr key={index} className="border-t">
                        <td className="p-3">{ligne.description}</td>
                        <td className="text-right p-3">{(ligne.quantite || 1).toFixed(2)}</td>
                        <td className="text-right p-3">{(ligne.prix_unitaire_ht || 0).toFixed(2)} €</td>
                        <td className="text-right p-3">{(ligne.prix_ht || 0).toFixed(2)} €</td>
                        <td className="text-right p-3">{(ligne.taux_tva || 0).toFixed(2)} %</td>
                        <td className="text-right p-3">{montantTva.toFixed(2)} €</td>
                        <td className="text-right p-3 font-medium">{prixTtc.toFixed(2)} €</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totaux */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between py-2 border-b">
                <span>Total HT</span>
                <span className="font-medium">{(facture.total_ht || 0).toFixed(2)} €</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span>Total TVA</span>
                <span className="font-medium">{(facture.total_tva || 0).toFixed(2)} €</span>
              </div>
              <div className="flex justify-between py-2 text-lg font-bold">
                <span>Total TTC</span>
                <span>{(facture.total_ttc || 0).toFixed(2)} €</span>
              </div>
            </div>
          </div>

          {/* Informations bancaires de la société (pour factures de vente) */}
          {facture.type_facture === 'VENTES' && societeInterne && (societeInterne.iban || societeInterne.bic) && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Coordonnées bancaires</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {societeInterne.etablissement_bancaire && (
                  <div>
                    <span className="text-muted-foreground">Banque: </span>
                    <span>{societeInterne.etablissement_bancaire}</span>
                  </div>
                )}
                {societeInterne.iban && (
                  <div>
                    <span className="text-muted-foreground">IBAN: </span>
                    <span className="font-mono">{societeInterne.iban}</span>
                  </div>
                )}
                {societeInterne.bic && (
                  <div>
                    <span className="text-muted-foreground">BIC: </span>
                    <span className="font-mono">{societeInterne.bic}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}