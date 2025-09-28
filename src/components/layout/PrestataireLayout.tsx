import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Briefcase, Home, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function PrestataireLayout() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/auth");
      toast({
        title: "Déconnexion réussie",
        description: "Vous avez été déconnecté avec succès",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Sidebar */}
        <div className="hidden md:flex h-screen w-64 flex-col fixed left-0 top-0 border-r bg-card">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-primary">Espace Prestataire</h2>
          </div>
          <nav className="flex-1 space-y-2 p-4">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => navigate("/prestataire/dashboard")}
            >
              <Home className="mr-2 h-4 w-4" />
              Tableau de bord
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => navigate("/prestataire/contrats")}
            >
              <Briefcase className="mr-2 h-4 w-4" />
              Mes contrats
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => navigate("/prestataire/profil")}
            >
              <User className="mr-2 h-4 w-4" />
              Mon profil
            </Button>
          </nav>
          <div className="p-4 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 md:ml-64">
          <div className="md:hidden p-4 border-b">
            <SidebarTrigger />
          </div>
          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}