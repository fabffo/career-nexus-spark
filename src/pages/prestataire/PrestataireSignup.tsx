import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function PrestataireSignup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [salarieData, setSalarieData] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });

  const token = searchParams.get('token');

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      toast({
        title: 'Token manquant',
        description: 'Le lien d\'invitation est invalide',
        variant: 'destructive',
      });
      setTimeout(() => navigate('/auth'), 2000);
      return;
    }

    try {
      // Vérifier le token et récupérer les données du salarié
      const { data, error } = await supabase
        .from('salaries')
        .select('*')
        .eq('invitation_token', token)
        .eq('role', 'PRESTATAIRE')
        .single();

      if (error || !data) {
        toast({
          title: 'Token invalide',
          description: 'Le lien d\'invitation est invalide ou a expiré',
          variant: 'destructive',
        });
        setTimeout(() => navigate('/auth'), 2000);
        return;
      }

      // Vérifier si l'utilisateur existe déjà
      if (data.user_id) {
        toast({
          title: 'Compte déjà créé',
          description: 'Vous avez déjà créé votre compte. Veuillez vous connecter.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      setSalarieData(data);
    } catch (error) {
      console.error('Error validating token:', error);
      toast({
        title: 'Erreur',
        description: 'Une erreur est survenue lors de la validation',
        variant: 'destructive',
      });
      setTimeout(() => navigate('/auth'), 2000);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'Erreur',
        description: 'Les mots de passe ne correspondent pas',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: 'Erreur',
        description: 'Le mot de passe doit contenir au moins 6 caractères',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Créer le compte utilisateur
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: salarieData.email,
        password: formData.password,
        options: {
          data: {
            nom: salarieData.nom,
            prenom: salarieData.prenom,
            role: 'PRESTATAIRE',
            invitation_token: token,
            type: 'SALARIE_PRESTATAIRE'
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error('Erreur lors de la création du compte');
      }

      // Mettre à jour le salarié avec l'user_id
      const { error: updateError } = await supabase
        .from('salaries')
        .update({ 
          user_id: authData.user.id,
          invitation_token: null,
          invitation_sent_at: null
        })
        .eq('id', salarieData.id);

      if (updateError) throw updateError;

      // Créer l'entrée dans la table prestataires
      const { error: prestataireError } = await supabase
        .from('prestataires')
        .insert({
          nom: salarieData.nom,
          prenom: salarieData.prenom,
          email: salarieData.email,
          telephone: salarieData.telephone,
          user_id: authData.user.id
        });

      if (prestataireError && prestataireError.code !== '23505') { // Ignorer si le prestataire existe déjà
        console.error('Error creating prestataire:', prestataireError);
      }

      toast({
        title: 'Compte créé avec succès',
        description: 'Bienvenue sur votre espace prestataire !',
      });

      // Se connecter automatiquement
      navigate('/prestataire');
    } catch (error: any) {
      console.error('Error creating account:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Une erreur est survenue lors de la création du compte',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!salarieData) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Créer votre espace prestataire</CardTitle>
          <CardDescription>
            Bienvenue {salarieData.prenom} {salarieData.nom}, veuillez créer votre mot de passe pour accéder à votre espace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={salarieData.email}
                disabled
                className="bg-muted"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  placeholder="Minimum 6 caractères"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                placeholder="Confirmez votre mot de passe"
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création en cours...
                </>
              ) : (
                'Créer mon compte'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}