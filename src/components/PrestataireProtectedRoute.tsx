import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PrestataireProtectedRouteProps {
  children: React.ReactNode;
}

export default function PrestataireProtectedRoute({ children }: PrestataireProtectedRouteProps) {
  const { user, loading } = useAuth();
  const [isPrestataire, setIsPrestataire] = useState<boolean | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) {
        setCheckingRole(false);
        return;
      }

      try {
        // Vérifier si l'utilisateur est un prestataire
        const { data, error } = await supabase
          .from("prestataires")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!error && data) {
          setIsPrestataire(true);
        } else {
          // Vérifier aussi dans les profiles au cas où
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

          if (!profileError && profile?.role === "PRESTATAIRE") {
            setIsPrestataire(true);
          } else {
            setIsPrestataire(false);
          }
        }
      } catch (error) {
        console.error("Error checking prestataire role:", error);
        setIsPrestataire(false);
      } finally {
        setCheckingRole(false);
      }
    };

    checkUserRole();
  }, [user]);

  if (loading || checkingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (isPrestataire === false) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}