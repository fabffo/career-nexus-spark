import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, Building, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RapprochementSearchSection } from './RapprochementSearchSection';
import { MatchingHistorySection } from './MatchingHistorySection';
import { supabase } from '@/integrations/supabase/client';

interface ViewPrestataireDialogProps {
  prestataire: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewPrestataireDialog({ prestataire, open, onOpenChange }: ViewPrestataireDialogProps) {
  const [typesPrestataire, setTypesPrestataire] = useState<{code: string, libelle: string}[]>([]);

  useEffect(() => {
    if (open) {
      loadTypesPrestataire();
    }
  }, [open]);

  const loadTypesPrestataire = async () => {
    try {
      const { data, error } = await supabase
        .from('param_type_prestataire' as any)
        .select('code, libelle')
        .eq('is_active', true);
      
      if (error) throw error;
      setTypesPrestataire((data as any) || []);
    } catch (error) {
      console.error('Erreur lors du chargement des types:', error);
    }
  };

  if (!prestataire) return null;

  const entityName = `${prestataire.prenom} ${prestataire.nom}`;
  const typeInfo = typesPrestataire.find(t => t.code === prestataire.type_prestataire);
  const typeLibelle = typeInfo?.libelle || prestataire.type_prestataire || 'Non défini';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {entityName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informations générales */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">Type</h3>
              <Badge variant={prestataire.type_prestataire === 'SOCIETE' ? 'default' : prestataire.type_prestataire === 'SALARIE' ? 'outline' : 'secondary'}>
                {typeLibelle}
              </Badge>
            </div>
            {prestataire.fournisseur_services && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Société</h3>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span>{prestataire.fournisseur_services.raison_sociale}</span>
                </div>
              </div>
            )}
            {prestataire.email && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Email</h3>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{prestataire.email}</span>
                </div>
              </div>
            )}
            {prestataire.telephone && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Téléphone</h3>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{prestataire.telephone}</span>
                </div>
              </div>
            )}
          </div>

          {/* CV et Recommandation */}
          <div className="flex gap-4">
            {prestataire.cv_url && (
              <Button variant="outline" size="sm" onClick={() => window.open(prestataire.cv_url, '_blank')}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger CV
              </Button>
            )}
            {prestataire.recommandation_url && (
              <Button variant="outline" size="sm" onClick={() => window.open(prestataire.recommandation_url, '_blank')}>
                <FileText className="h-4 w-4 mr-2" />
                Recommandation
              </Button>
            )}
          </div>

          {/* Statut */}
          <div className="flex gap-2">
            <Badge variant={prestataire.actif !== false ? 'default' : 'secondary'}>
              {prestataire.actif !== false ? 'Actif' : 'Inactif'}
            </Badge>
            {prestataire.user_id ? (
              <Badge variant="default">Compte créé</Badge>
            ) : prestataire.invitation_sent_at ? (
              <Badge variant="secondary">Invité</Badge>
            ) : (
              <Badge variant="outline">En attente</Badge>
            )}
          </div>

          {/* Recherche de rapprochement */}
          <RapprochementSearchSection
            entityType="prestataire"
            entityId={prestataire.id}
            entityName={entityName}
          />

          {/* Historique des matchings */}
          <MatchingHistorySection
            entityType="prestataire"
            entityId={prestataire.id}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
