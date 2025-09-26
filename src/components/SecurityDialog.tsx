import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Shield, User, Clock, Activity, Settings, Key, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SecurityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AuthLog {
  id: string;
  timestamp: string;
  event_message: any;
  level: string;
  msg: string;
  path: string;
  status: string;
}

export function SecurityDialog({ open, onOpenChange }: SecurityDialogProps) {
  const [authSettings, setAuthSettings] = useState({
    autoConfirmEmail: false,
    disableSignup: false,
    anonymousSignIn: false,
  });
  const [authLogs, setAuthLogs] = useState<AuthLog[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSecurityData();
    }
  }, [open]);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      // Récupérer les logs d'authentification via edge function
      const { data: logsData, error: logsError } = await supabase.functions.invoke('get-auth-logs');
      if (!logsError && logsData) {
        setAuthLogs(logsData.logs || []);
      }

      // Récupérer les paramètres actuels
      const { data: projectInfo, error: projectError } = await supabase.functions.invoke('get-project-info');
      if (!projectError && projectInfo) {
        setAuthSettings({
          autoConfirmEmail: projectInfo.auto_confirm_email || false,
          disableSignup: projectInfo.disable_signup || false,
          anonymousSignIn: projectInfo.external_anonymous_users_enabled || false,
        });
      }

      // Récupérer les sessions actives
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (profilesData) {
        setActiveSessions(profilesData);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des données de sécurité:', error);
      toast.error('Erreur lors du chargement des données de sécurité');
    } finally {
      setLoading(false);
    }
  };

  const saveAuthSettings = async () => {
    setSavingSettings(true);
    try {
      const { error } = await supabase.functions.invoke('configure-auth', {
        body: {
          auto_confirm_email: authSettings.autoConfirmEmail,
          disable_signup: authSettings.disableSignup,
          external_anonymous_users_enabled: authSettings.anonymousSignIn,
        },
      });

      if (error) throw error;
      toast.success('Paramètres de sécurité mis à jour');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde des paramètres');
    } finally {
      setSavingSettings(false);
    }
  };

  const getLogLevel = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'error':
        return <Badge variant="destructive">Erreur</Badge>;
      case 'warning':
        return <Badge variant="secondary">Avertissement</Badge>;
      case 'info':
        return <Badge>Info</Badge>;
      default:
        return <Badge variant="outline">{level}</Badge>;
    }
  };

  const parseEventMessage = (message: string | any) => {
    try {
      if (typeof message === 'string') {
        const parsed = JSON.parse(message);
        return parsed;
      }
      return message;
    } catch {
      return message;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gestion de la Sécurité
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Paramètres
            </TabsTrigger>
            <TabsTrigger value="sessions">
              <User className="h-4 w-4 mr-2" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="logs">
              <Activity className="h-4 w-4 mr-2" />
              Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Paramètres d'Authentification
                </CardTitle>
                <CardDescription>
                  Configurez les paramètres de sécurité de votre application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="auto-confirm">Confirmation automatique des emails</Label>
                    <p className="text-sm text-muted-foreground">
                      Les nouveaux utilisateurs n'auront pas besoin de confirmer leur email
                    </p>
                  </div>
                  <Switch
                    id="auto-confirm"
                    checked={authSettings.autoConfirmEmail}
                    onCheckedChange={(checked) =>
                      setAuthSettings((prev) => ({ ...prev, autoConfirmEmail: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="disable-signup">Désactiver les inscriptions</Label>
                    <p className="text-sm text-muted-foreground">
                      Empêcher les nouveaux utilisateurs de s'inscrire
                    </p>
                  </div>
                  <Switch
                    id="disable-signup"
                    checked={authSettings.disableSignup}
                    onCheckedChange={(checked) =>
                      setAuthSettings((prev) => ({ ...prev, disableSignup: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="anonymous">Connexions anonymes</Label>
                    <p className="text-sm text-muted-foreground">
                      Autoriser les utilisateurs à se connecter sans compte
                    </p>
                  </div>
                  <Switch
                    id="anonymous"
                    checked={authSettings.anonymousSignIn}
                    onCheckedChange={(checked) =>
                      setAuthSettings((prev) => ({ ...prev, anonymousSignIn: checked }))
                    }
                  />
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Les modifications de ces paramètres affecteront immédiatement l'accès à votre application.
                  </AlertDescription>
                </Alert>

                <Button onClick={saveAuthSettings} disabled={savingSettings} className="w-full">
                  {savingSettings ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Sessions Actives
                </CardTitle>
                <CardDescription>
                  Visualisez les utilisateurs connectés récemment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {activeSessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {session.prenom} {session.nom}
                            </span>
                            <Badge variant={session.role === 'ADMIN' ? 'destructive' : 'secondary'}>
                              {session.role}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{session.email}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {session.updated_at
                              ? format(new Date(session.updated_at), 'dd MMM yyyy HH:mm', { locale: fr })
                              : 'Jamais'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Logs d'Authentification
                </CardTitle>
                <CardDescription>
                  Historique des événements de connexion et d'authentification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {authLogs.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Aucun log disponible
                      </p>
                    ) : (
                      authLogs.map((log) => {
                        const eventData = parseEventMessage(log.event_message);
                        return (
                          <div
                            key={log.id}
                            className="p-3 rounded-lg border space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getLogLevel(log.level)}
                                <span className="text-sm font-medium">{log.msg || 'Événement'}</span>
                              </div>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {format(new Date(Number(log.timestamp) / 1000), 'dd MMM yyyy HH:mm:ss', { locale: fr })}
                              </div>
                            </div>
                            {log.path && (
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium">Path:</span> {log.path}
                              </div>
                            )}
                            {log.status && (
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium">Status:</span>{' '}
                                <Badge variant={log.status === '200' ? 'default' : 'destructive'}>
                                  {log.status}
                                </Badge>
                              </div>
                            )}
                            {eventData?.auth_event && (
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium">Action:</span> {eventData.auth_event.action}
                                {eventData.auth_event.actor_username && (
                                  <span> - {eventData.auth_event.actor_username}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}