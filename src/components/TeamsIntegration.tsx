import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Send, Users, Calendar } from 'lucide-react';
import { Rdv } from '@/types/models';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TeamsIntegrationProps {
  rdv: Rdv;
  onClose?: () => void;
}

export default function TeamsIntegration({ rdv, onClose }: TeamsIntegrationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  
  const generateMeetingInvite = () => {
    const date = format(new Date(rdv.date), 'dd MMMM yyyy à HH:mm', { locale: fr });
    const type = rdv.typeRdv === 'TEAMS' ? 'Microsoft Teams' : 
                 rdv.typeRdv === 'PRESENTIEL_CLIENT' ? 'Présentiel' : 'Téléphone';
    
    return `Bonjour,

Je vous confirme notre rendez-vous prévu le ${date}.

Type de rendez-vous : ${type}
${rdv.lieu ? `Lieu : ${rdv.lieu}` : ''}
${rdv.notes ? `\nNotes : ${rdv.notes}` : ''}

${rdv.typeRdv === 'TEAMS' ? `
Lien de la réunion Teams :
[Le lien Teams sera généré automatiquement]

Comment rejoindre la réunion :
1. Cliquez sur le lien ci-dessus
2. Rejoignez depuis votre navigateur ou l'application Teams
3. Activez votre caméra et microphone

` : ''}
Cordialement,
L'équipe de recrutement`;
  };

  const handleSendToTeams = async () => {
    try {
      // Pour l'instant, nous simulons l'envoi
      // Dans un environnement réel, cela nécessiterait l'API Microsoft Graph
      
      // Vérifier si nous avons les clés API nécessaires
      const hasTeamsIntegration = false; // À remplacer par une vraie vérification
      
      if (!hasTeamsIntegration) {
        toast.info('L\'intégration Teams nécessite une configuration avec Lovable Cloud', {
          description: 'Activez Lovable Cloud pour connecter Microsoft Teams',
          action: {
            label: 'Configurer',
            onClick: () => {
              // Trigger Lovable Cloud setup
              toast.info('Contactez votre administrateur pour configurer l\'intégration Teams');
            }
          }
        });
        return;
      }
      
      // Simulation d'envoi
      toast.success('Invitation Teams envoyée avec succès');
      setIsOpen(false);
      if (onClose) onClose();
      
    } catch (error) {
      toast.error('Erreur lors de l\'envoi de l\'invitation');
      console.error('Erreur Teams:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setMessage(generateMeetingInvite());
    }
  }, [isOpen, rdv]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Send className="h-4 w-4" />
        Envoyer via Teams
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Envoyer l'invitation Teams
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Détails du rendez-vous</span>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Date : {format(new Date(rdv.date), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
                <p>Type : {rdv.typeRdv}</p>
                {rdv.lieu && <p>Lieu : {rdv.lieu}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="message">Message d'invitation</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={12}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleSendToTeams}
              className="bg-gradient-to-r from-primary to-primary-hover"
            >
              <Send className="mr-2 h-4 w-4" />
              Envoyer l'invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}