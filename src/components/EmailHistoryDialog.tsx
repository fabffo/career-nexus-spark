import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Mail, AlertCircle, CheckCircle, Clock, Filter, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EmailHistory {
  id: string;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  email_type: string;
  status: string;
  error_message?: string;
  metadata?: any;
  created_at: string;
}

interface EmailHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailHistoryDialog({ open, onOpenChange }: EmailHistoryDialogProps) {
  const [emails, setEmails] = useState<EmailHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const { toast } = useToast();

  const fetchEmailHistory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('email_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEmails(data || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de charger l'historique des emails",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchEmailHistory();
    }
  }, [open, filter]);

  const getEmailTypeLabel = (type: string) => {
    switch (type) {
      case 'invitation_user':
        return 'Invitation Utilisateur';
      case 'invitation_candidat':
        return 'Invitation Candidat';
      case 'teams_invitation':
        return 'Invitation Teams';
      default:
        return type;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusVariant = (status: string): "default" | "destructive" | "outline" | "secondary" => {
    switch (status) {
      case 'sent':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'pending':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Historique des Emails
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="sent">Envoyés</SelectItem>
                <SelectItem value="failed">Échoués</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchEmailHistory}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        <ScrollArea className="h-[500px] w-full rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Destinataire</TableHead>
                <TableHead>Sujet</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Détails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {loading ? 'Chargement...' : 'Aucun email trouvé'}
                  </TableCell>
                </TableRow>
              ) : (
                emails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(email.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getEmailTypeLabel(email.email_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{email.recipient_email}</div>
                        {email.recipient_name && (
                          <div className="text-sm text-muted-foreground">{email.recipient_name}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{email.subject}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(email.status)}
                        <Badge variant={getStatusVariant(email.status)}>
                          {email.status === 'sent' ? 'Envoyé' : 
                           email.status === 'failed' ? 'Échoué' : 
                           email.status === 'pending' ? 'En attente' : email.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {email.error_message && (
                        <div className="text-sm text-red-500">{email.error_message}</div>
                      )}
                      {email.metadata && (
                        <div className="text-sm text-muted-foreground">
                          {email.metadata.candidat_id && <div>Candidat ID: {email.metadata.candidat_id}</div>}
                          {email.metadata.rdv_id && <div>RDV ID: {email.metadata.rdv_id}</div>}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}