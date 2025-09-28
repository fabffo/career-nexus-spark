import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, UserCheck } from "lucide-react";

export default function CandidatSignup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [candidat, setCandidat] = useState<any>(null);
  const [prestataire, setPrestataire] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const token = searchParams.get("token");
  const type = searchParams.get("type"); // CANDIDAT ou PRESTATAIRE

  useEffect(() => {
    if (!token) {
      toast({
        title: "Erreur",
        description: "Token d'invitation manquant",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (type === "PRESTATAIRE") {
      loadPrestataireData();
    } else {
      loadCandidatData();
    }
  }, [token, type]);

  const loadCandidatData = async () => {
    try {
      const { data, error } = await supabase
        .from("candidats")
        .select("*")
        .eq("invitation_token", token)
        .single();

      if (error) throw error;

      if (!data) {
        toast({
          title: "Erreur",
          description: "Token d'invitation invalide ou expiré",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      setCandidat(data);
    } catch (error) {
      console.error("Error loading candidat:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive",
      });
      navigate("/auth");
    }
  };

  const loadPrestataireData = async () => {
    try {
      const { data, error } = await supabase
        .from("prestataires")
        .select("*")
        .eq("invitation_token", token)
        .single();

      if (error) throw error;

      if (!data) {
        toast({
          title: "Erreur",
          description: "Token d'invitation invalide ou expiré",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      setPrestataire(data);
    } catch (error) {
      console.error("Error loading prestataire:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive",
      });
      navigate("/auth");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 6 caractères",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const userData = type === "PRESTATAIRE" ? prestataire : candidat;
    const userRole = type === "PRESTATAIRE" ? "PRESTATAIRE" : "CANDIDAT";
    const redirectUrl = type === "PRESTATAIRE" ? "/prestataire/dashboard" : "/candidat/dashboard";

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: userData.email,
        password,
        options: {
          data: {
            invitation_token: token,
            nom: userData.nom,
            prenom: userData.prenom,
            role: userRole,
            type: type || 'CANDIDAT',
          },
        },
      });

      if (signUpError) throw signUpError;

      toast({
        title: "Compte créé avec succès",
        description: "Vous allez être redirigé vers votre espace",
      });

      // Attendre un peu pour que le trigger se déclenche
      setTimeout(() => {
        navigate(redirectUrl);
      }, 2000);
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const userData = type === "PRESTATAIRE" ? prestataire : candidat;
  
  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  const userTypeLabel = type === "PRESTATAIRE" ? "prestataire" : "candidat";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary-foreground flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">
            Bienvenue {userData.prenom} {userData.nom}
          </CardTitle>
          <CardDescription className="text-center">
            Créez votre mot de passe pour accéder à votre espace {userTypeLabel}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={userData.email}
                disabled
                className="bg-muted"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmez votre mot de passe"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Création en cours..." : "Créer mon compte"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}