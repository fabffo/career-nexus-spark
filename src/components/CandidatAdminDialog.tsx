import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Send, Shield, Clock, CheckCircle } from 'lucide-react';

interface CandidatAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

interface CandidatWithAccess {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  user_id: string | null;
  invitation_token: string | null;
  invitation_sent_at: string | null;
}

export function CandidatAdminDialog({ open, onOpenChange, onUpdate }: CandidatAdminDialogProps) {
  const [candidats, setCandidats] = useState<CandidatWithAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadCandidats();
    }
  }, [open]);

  const loadCandidats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidats')
        .select('id, nom, prenom, email, user_id, invitation_token, invitation_sent_at')
        .order('nom', { ascending: true });

      if (error) throw error;
      setCandidats(data || []);
    } catch (error: any) {
      console.error('Error loading candidats:', error);
      toast.error('Erreur lors du chargement des candidats');
    } finally {
      setLoading(false);
    }
  };

  const toggleAccess = async (candidat: CandidatWithAccess) => {
    try {
      if (candidat.user_id) {
        // Revoke access
        const { error } = await supabase
          .from('candidats')
          .update({ user_id: null })
          .eq('id', candidat.id);

        if (error) throw error;
        toast.success(`Accès révoqué pour ${candidat.prenom} ${candidat.nom}`);
      } else {
        // Grant access (requires sending invitation)
        await sendInvitation(candidat);
      }
      
      loadCandidats();
      onUpdate();
    } catch (error: any) {
      console.error('Error toggling access:', error);
      toast.error('Erreur lors de la modification des droits');
    }
  };

  const sendInvitation = async (candidat: CandidatWithAccess) => {
    setSendingInvite(candidat.id);
    try {
      // Utiliser l'URL correcte pour l'environnement
      const baseUrl = window.location.origin;
      console.log('Sending invitation with baseUrl:', baseUrl);
      
      const { error } = await supabase.functions.invoke('send-candidat-invitation', {
        body: { candidatId: candidat.id, baseUrl }
      });

      if (error) throw error;
      toast.success(`Invitation envoyée à ${candidat.email}`);
      loadCandidats();
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      toast.error(error.message || "Impossible d'envoyer l'invitation");
    } finally {
      setSendingInvite(null);
    }
  };

  const getStatusBadge = (candidat: CandidatWithAccess) => {
    if (candidat.user_id) {
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          Accès actif
        </Badge>
      );
    } else if (candidat.invitation_sent_at) {
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Invitation envoyée
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline">
          Pas d'accès
        </Badge>
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gestion des accès candidats
          </DialogTitle>
          <DialogDescription>
            Gérez les droits d'accès et envoyez des invitations aux candidats
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[500px] space-y-3 mt-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement...
            </div>
          ) : candidats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun candidat trouvé
            </div>
          ) : (
            candidats.map((candidat) => (
              <div
                key={candidat.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium">
                      {candidat.prenom} {candidat.nom}
                    </p>
                    {getStatusBadge(candidat)}
                  </div>
                  <p className="text-sm text-muted-foreground">{candidat.email}</p>
                  {candidat.invitation_sent_at && !candidat.user_id && (
                    <p className="text-xs text-muted-foreground">
                      Invitation envoyée le {new Date(candidat.invitation_sent_at).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`access-${candidat.id}`} className="text-sm">
                      Accès
                    </Label>
                    <Switch
                      id={`access-${candidat.id}`}
                      checked={!!candidat.user_id}
                      onCheckedChange={() => toggleAccess(candidat)}
                      disabled={sendingInvite === candidat.id}
                    />
                  </div>
                  
                  {!candidat.user_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendInvitation(candidat)}
                      disabled={sendingInvite === candidat.id}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      {candidat.invitation_sent_at ? 'Renvoyer' : 'Envoyer'}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}