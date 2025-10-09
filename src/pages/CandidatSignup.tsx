import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, UserCheck } from "lucide-react";
import { signupSchema } from "@/lib/validations";
import { z } from "zod";

export default function CandidatSignup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [candidat, setCandidat] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const token = searchParams.get("token");

  useEffect(() => {
    const checkAndLoad = async () => {
      console.log("=== CandidatSignup: Starting ===");
      console.log("Token from URL:", token);
      
      if (!token) {
        console.error("No token provided");
        toast({
          title: "Erreur",
          description: "Token d'invitation manquant dans le lien",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      // Vérifier si déjà connecté
      const { data: { session } } = await supabase.auth.getSession();
      console.log("Current session:", session ? "exists" : "none");
      
      if (session) {
        toast({
          title: "Information",
          description: "Vous êtes déjà connecté. Veuillez vous déconnecter pour créer un nouveau compte.",
          variant: "default",
        });
        navigate("/");
        return;
      }

      loadCandidatData();
    };

    checkAndLoad();
  }, [token]);

  const loadCandidatData = async () => {
    try {
      console.log("=== Loading candidat data ===");
      console.log("Token:", token);
      
      const { data, error } = await supabase
        .from("candidats")
        .select("*")
        .eq("invitation_token", token)
        .maybeSingle();

      console.log("Query result - Data:", data);
      console.log("Query result - Error:", error);

      if (error) {
        console.error("Database error:", error);
        throw error;
      }

      if (!data) {
        console.error("No candidat found with this token");
        toast({
          title: "Token invalide",
          description: "Ce lien d'invitation n'existe pas ou a expiré. Veuillez demander un nouveau lien.",
          variant: "destructive",
        });
        setTimeout(() => navigate("/auth"), 2000);
        return;
      }

      if (data.user_id) {
        console.log("Candidat already has user_id:", data.user_id);
        toast({
          title: "Compte déjà activé",
          description: "Ce compte a déjà été activé. Veuillez vous connecter.",
          variant: "default",
        });
        setTimeout(() => navigate("/auth"), 2000);
        return;
      }

      console.log("✓ Candidat loaded successfully:", data.nom, data.prenom, data.email);
      setCandidat(data);
    } catch (error: any) {
      console.error("=== Error in loadCandidatData ===");
      console.error("Error:", error);
      console.error("Error message:", error.message);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de charger les données du candidat",
        variant: "destructive",
      });
      setTimeout(() => navigate("/auth"), 2000);
    }
  };


  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!candidat) return;
    
    // Validate passwords
    try {
      signupSchema.parse({ 
        email: candidat.email, 
        password, 
        confirmPassword 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast({
          title: "Erreur de validation",
          description: firstError.message,
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: candidat.email,
        password,
        options: {
          data: {
            invitation_token: token,
            nom: candidat.nom,
            prenom: candidat.prenom,
            role: 'CANDIDAT',
            type: 'CANDIDAT',
          },
        },
      });

      if (signUpError) throw signUpError;

      toast({
        title: "Compte créé avec succès",
        description: "Vous allez être redirigé vers votre espace candidat",
      });

      // Attendre un peu pour que le trigger se déclenche
      setTimeout(() => {
        navigate("/candidat/dashboard");
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
  
  if (!candidat) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Chargement des informations...</p>
        </div>
      </div>
    );
  }

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
            Bienvenue {candidat.prenom} {candidat.nom}
          </CardTitle>
          <CardDescription className="text-center">
            Créez votre mot de passe pour accéder à votre espace candidat
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom</Label>
              <Input
                id="nom"
                type="text"
                value={candidat.nom}
                disabled
                className="bg-muted cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prenom">Prénom</Label>
              <Input
                id="prenom"
                type="text"
                value={candidat.prenom}
                disabled
                className="bg-muted cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={candidat.email}
                disabled
                className="bg-muted cursor-not-allowed"
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
                  placeholder="Minimum 8 caractères"
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
              <p className="text-xs text-muted-foreground">
                Min. 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre
              </p>
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