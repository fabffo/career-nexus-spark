import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { generateDeviceFingerprint, getDeviceName } from '@/lib/deviceFingerprint';
import { Shield, Clock, RotateCw } from 'lucide-react';

export default function TwoFactorVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, email } = location.state || {};

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(3);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [canResend, setCanResend] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);

  useEffect(() => {
    if (!userId || !email) {
      navigate('/auth');
      return;
    }

    // Send initial code
    sendCode();
  }, [userId, email]);

  useEffect(() => {
    // Countdown for resend button
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendCountdown]);

  const sendCode = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('send-2fa-code', {
        body: { email, userId },
      });

      if (error) throw error;

      if (data.expiresAt) {
        setExpiresAt(new Date(data.expiresAt));
      }

      toast.success('Code envoyé à votre email');
      setResendCountdown(60);
      setCanResend(false);
    } catch (error) {
      console.error('Error sending code:', error);
      toast.error('Erreur lors de l\'envoi du code');
    }
  };

  const handleResend = async () => {
    setLoading(true);
    await sendCode();
    setCode('');
    setRemainingAttempts(3);
    setLoading(false);
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error('Veuillez saisir un code à 6 chiffres');
      return;
    }

    setLoading(true);

    try {
      // Verify the code
      const { data, error } = await supabase.functions.invoke('verify-2fa-code', {
        body: { userId, code },
      });

      if (error || !data.success) {
        if (data?.remainingAttempts !== undefined) {
          setRemainingAttempts(data.remainingAttempts);
        }
        toast.error(data?.error || 'Code incorrect');
        setCode('');
        setLoading(false);
        return;
      }

      // If user wants to trust this device
      if (trustDevice) {
        const fingerprint = await generateDeviceFingerprint();
        const deviceName = getDeviceName();

        await supabase.functions.invoke('add-trusted-device', {
          body: {
            userId,
            deviceFingerprint: fingerprint,
            deviceName,
            email,
          },
        });
      }

      toast.success('Authentification réussie');
      
      // Redirect based on user role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profile?.role === 'CANDIDAT') {
        navigate('/candidat/dashboard');
      } else if (profile?.role === 'PRESTATAIRE') {
        navigate('/prestataire/dashboard');
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      toast.error('Erreur lors de la vérification');
      setLoading(false);
    }
  };

  const getTimeRemaining = () => {
    if (!expiresAt) return '';
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    if (diff <= 0) return 'Expiré';
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Vérification en deux étapes</CardTitle>
          <CardDescription>
            Un code de vérification a été envoyé à <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col items-center space-y-4">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(value) => setCode(value)}
                disabled={loading}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{getTimeRemaining()}</span>
                </div>
                <div className="h-4 w-px bg-border" />
                <span>{remainingAttempts} tentative{remainingAttempts > 1 ? 's' : ''} restante{remainingAttempts > 1 ? 's' : ''}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="trust"
                checked={trustDevice}
                onCheckedChange={(checked) => setTrustDevice(checked as boolean)}
              />
              <label
                htmlFor="trust"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Faire confiance à cet appareil pendant 30 jours
              </label>
            </div>

            <Button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="w-full"
              size="lg"
            >
              {loading ? 'Vérification...' : 'Vérifier le code'}
            </Button>

            <div className="text-center">
              <Button
                variant="ghost"
                onClick={handleResend}
                disabled={!canResend || loading}
                className="text-sm"
              >
                <RotateCw className="w-4 h-4 mr-2" />
                {canResend
                  ? 'Renvoyer le code'
                  : `Renvoyer dans ${resendCountdown}s`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
