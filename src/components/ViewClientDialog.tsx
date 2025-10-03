import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Building, Mail, Phone, Globe, MapPin, Briefcase, Calendar } from 'lucide-react';

interface ViewClientDialogProps {
  client: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewClientDialog({ client, open, onOpenChange }: ViewClientDialogProps) {
  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Détails du client
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Raison sociale */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" />
              {client.raison_sociale || client.raisonSociale}
            </h3>
          </div>

          {/* Secteur d'activité */}
          {(client.secteur_activite || client.secteurActivite) && (
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Briefcase className="h-4 w-4" />
                <span>Secteur d'activité</span>
              </div>
              <p className="ml-6 font-medium">{client.secteur_activite || client.secteurActivite}</p>
            </div>
          )}

          {/* Coordonnées */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Coordonnées</h4>
            
            {(client.email || client.mail) && (
              <div className="flex items-center gap-2 ml-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${client.email || client.mail}`} className="text-primary hover:underline">
                  {client.email || client.mail}
                </a>
              </div>
            )}

            {client.telephone && (
              <div className="flex items-center gap-2 ml-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${client.telephone}`} className="text-primary hover:underline">
                  {client.telephone}
                </a>
              </div>
            )}

            {client.adresse && (
              <div className="flex items-start gap-2 ml-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p className="text-sm">{client.adresse}</p>
              </div>
            )}

            {(client.site_web || client.siteWeb) && (
              <div className="flex items-center gap-2 ml-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a 
                  href={client.site_web || client.siteWeb} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {client.site_web || client.siteWeb}
                </a>
              </div>
            )}
          </div>

          {/* Délai de paiement */}
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span>Délai de paiement</span>
            </div>
            <p className="ml-6 font-medium">{client.delai_paiement_jours || 30} jours</p>
          </div>

          {/* Métadonnées */}
          {(client.created_at || client.createdAt) && (
            <div className="border-t pt-4 text-xs text-muted-foreground space-y-1">
              <p>Créé le {new Date(client.created_at || client.createdAt).toLocaleDateString('fr-FR')}</p>
              {(client.updated_at || client.updatedAt) && (
                <p>Modifié le {new Date(client.updated_at || client.updatedAt).toLocaleDateString('fr-FR')}</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}