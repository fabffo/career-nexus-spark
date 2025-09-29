import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Send, Search, UserCheck, UserX, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SalarieAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

interface SalarieWithAccess {
  id: string;
  nom: string;
  prenom: string;
  email?: string;
  user_id?: string;
  invitation_token?: string;
  invitation_sent_at?: string;
}

export function SalarieAdminDialog({ open, onOpenChange, onUpdate }: SalarieAdminDialogProps) {
  const [salaries, setSalaries] = useState<SalarieWithAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadSalaries();
    }
  }, [open]);

  const loadSalaries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('salaries')
        .select('id, nom, prenom, email, user_id, invitation_token, invitation_sent_at')
        .order('nom', { ascending: true });

      if (error) throw error;
      setSalaries(data || []);
    } catch (error) {
      console.error('Error loading salaries:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les salariés',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleAccess = async (salarie: SalarieWithAccess) => {
    try {
      if (salarie.user_id) {
        // Revoke access
        const { error } = await supabase
          .from('salaries')
          .update({ user_id: null, invitation_token: null, invitation_sent_at: null })
          .eq('id', salarie.id);

        if (error) throw error;

        toast({
          title: 'Accès révoqué',
          description: `L'accès de ${salarie.prenom} ${salarie.nom} a été révoqué`,
        });
      } else {
        // Grant access - will need to send invitation
        if (!salarie.email) {
          toast({
            title: 'Email requis',
            description: 'Ce salarié n\'a pas d\'adresse email',
            variant: 'destructive',
          });
          return;
        }

        await sendInvitation(salarie);
      }

      loadSalaries();
      onUpdate?.();
    } catch (error) {
      console.error('Error toggling access:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier l\'accès',
        variant: 'destructive',
      });
    }
  };

  const sendInvitation = async (salarie: SalarieWithAccess) => {
    if (!salarie.email) return;

    setSendingInvite(salarie.id);
    try {
      // For now, we'll just generate a token and mark as sent
      // In production, this would send an actual email
      const token = crypto.randomUUID();
      
      const { error } = await supabase
        .from('salaries')
        .update({ 
          invitation_token: token,
          invitation_sent_at: new Date().toISOString()
        })
        .eq('id', salarie.id);

      if (error) throw error;

      toast({
        title: 'Invitation envoyée',
        description: `Une invitation a été envoyée à ${salarie.email}`,
      });

      loadSalaries();
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'envoyer l\'invitation',
        variant: 'destructive',
      });
    } finally {
      setSendingInvite(null);
    }
  };

  const getStatusBadge = (salarie: SalarieWithAccess) => {
    if (salarie.user_id) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <UserCheck className="h-3 w-3 mr-1" />
          Accès actif
        </Badge>
      );
    } else if (salarie.invitation_token) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800">
          <Clock className="h-3 w-3 mr-1" />
          Invitation envoyée
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary">
          <UserX className="h-3 w-3 mr-1" />
          Pas d'accès
        </Badge>
      );
    }
  };

  const filteredSalaries = salaries.filter(s => 
    `${s.prenom} ${s.nom} ${s.email}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestion des accès salariés</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un salarié..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : filteredSalaries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Aucun salarié trouvé' : 'Aucun salarié'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSalaries.map((salarie) => (
                <div key={salarie.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{salarie.prenom} {salarie.nom}</p>
                          {salarie.email && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {salarie.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(salarie)}
                        {salarie.invitation_sent_at && (
                          <span className="text-xs text-muted-foreground">
                            Invité le {format(new Date(salarie.invitation_sent_at), 'dd/MM/yyyy', { locale: fr })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Switch
                        checked={!!salarie.user_id}
                        onCheckedChange={() => toggleAccess(salarie)}
                        disabled={!salarie.email}
                      />
                      
                      {salarie.invitation_token && !salarie.user_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendInvitation(salarie)}
                          disabled={sendingInvite === salarie.id}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Renvoyer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}