import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Send, Users, Calendar, Mail } from 'lucide-react';
import { Rdv } from '@/types/models';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

interface TeamsIntegrationProps {
  rdv: Rdv;
  onClose?: () => void;
}

export default function TeamsIntegration({ rdv, onClose }: TeamsIntegrationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
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
    if (!recipients.trim()) {
      toast.error('Veuillez entrer au moins une adresse email');
      return;
    }

    setIsLoading(true);
    try {
      // Parse recipient emails
      const emailList = recipients.split(',').map(email => email.trim()).filter(email => email);
      
      // Create Teams meeting if it's a Teams RDV
      if (rdv.typeRdv === 'TEAMS') {
        const { data, error } = await supabase.functions.invoke('teams-integration', {
          body: {
            action: 'create-meeting',
            data: {
              rdv: {
                ...rdv,
                candidatName: `${rdv.candidat?.prenom} ${rdv.candidat?.nom}`,
                clientName: rdv.client?.raisonSociale
              },
              // Ne pas envoyer les emails ici pour éviter les doublons
              attendeeEmails: []
            }
          }
        });

        if (error) throw error;
        
        if (data?.joinUrl) {
          toast.success('Réunion Teams créée avec succès', {
            description: 'Le lien de la réunion a été ajouté au rendez-vous'
          });
        }
      }
      
      // Send invitation email
      const { error: emailError } = await supabase.functions.invoke('teams-integration', {
        body: {
          action: 'send-invitation',
          data: {
            rdv,
            recipients: emailList,
            message
          }
        }
      });

      if (emailError) throw emailError;
      
      toast.success('Invitation envoyée avec succès');
      setIsOpen(false);
      setRecipients('');
      if (onClose) onClose();
      
    } catch (error) {
      toast.error('Erreur lors de l\'envoi de l\'invitation', {
        description: error.message
      });
      console.error('Erreur Teams:', error);
    } finally {
      setIsLoading(false);
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
              <Label htmlFor="recipients">Destinataires (emails séparés par des virgules)</Label>
              <Input
                id="recipients"
                type="text"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="email1@example.com, email2@example.com"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="message">Message d'invitation</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={10}
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
              disabled={isLoading}
              className="bg-gradient-to-r from-primary to-primary-hover"
            >
              {isLoading ? (
                <>Envoi en cours...</>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Envoyer l'invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}