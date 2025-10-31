import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Smartphone, Trash2, Calendar, Clock, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TrustedDevice {
  id: string;
  device_name: string;
  device_fingerprint: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
}

export default function TrustedDevices() {
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceToRevoke, setDeviceToRevoke] = useState<string | null>(null);
  const [showRevokeAll, setShowRevokeAll] = useState(false);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('get-trusted-devices', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setDevices(data.devices || []);
    } catch (error) {
      console.error('Error loading devices:', error);
      toast.error('Erreur lors du chargement des appareils');
    } finally {
      setLoading(false);
    }
  };

  const revokeDevice = async (deviceId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase.functions.invoke('revoke-trusted-device', {
        body: { deviceId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast.success('Appareil révoqué avec succès');
      loadDevices();
    } catch (error) {
      console.error('Error revoking device:', error);
      toast.error('Erreur lors de la révocation');
    }
    setDeviceToRevoke(null);
  };

  const revokeAllDevices = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase.functions.invoke('revoke-trusted-device', {
        body: { revokeAll: true },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast.success('Tous les appareils ont été révoqués');
      loadDevices();
    } catch (error) {
      console.error('Error revoking all devices:', error);
      toast.error('Erreur lors de la révocation');
    }
    setShowRevokeAll(false);
  };

  return (
    <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Appareils de confiance</h1>
              <p className="text-muted-foreground mt-2">
                Gérez les appareils autorisés à accéder à votre compte sans vérification 2FA
              </p>
            </div>
            {devices.length > 0 && (
              <Button
                variant="destructive"
                onClick={() => setShowRevokeAll(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Révoquer tous
              </Button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Chargement...</p>
            </div>
          ) : devices.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Smartphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Aucun appareil de confiance enregistré
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Lors de votre prochaine connexion, vous pourrez marquer votre appareil comme "de confiance"
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {devices.map((device) => (
                <Card key={device.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Smartphone className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{device.device_name}</CardTitle>
                          <CardDescription className="mt-1">
                            ID: {device.device_fingerprint.substring(0, 16)}...
                          </CardDescription>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeviceToRevoke(device.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-muted-foreground">Ajouté</p>
                          <p className="font-medium">
                            {formatDistanceToNow(new Date(device.created_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-muted-foreground">Dernière utilisation</p>
                          <p className="font-medium">
                            {formatDistanceToNow(new Date(device.last_used_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-muted-foreground">Expire</p>
                          <p className="font-medium">
                            {formatDistanceToNow(new Date(device.expires_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

      {/* Revoke single device dialog */}
      <AlertDialog open={!!deviceToRevoke} onOpenChange={() => setDeviceToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer cet appareil ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cet appareil devra être authentifié à nouveau lors de la prochaine connexion.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deviceToRevoke && revokeDevice(deviceToRevoke)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Révoquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke all devices dialog */}
      <AlertDialog open={showRevokeAll} onOpenChange={setShowRevokeAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer tous les appareils ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous vos appareils de confiance seront révoqués et devront être authentifiés
              à nouveau. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={revokeAllDevices}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Révoquer tous
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    );
  }
