import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Users,
  Building2,
  Calendar,
  Briefcase,
  MessageSquare,
  LayoutDashboard,
  Menu,
  X,
  Search,
  BrainCircuit,
  User,
  LogOut,
  ShieldCheck,
  UserCheck,
  FileText,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export function Sidebar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { profile, signOut } = useAuth();

  // Navigation pour les recruteurs et admins
  const recruiterMenuItems = [
    { path: '/', label: 'Tableau de bord', icon: LayoutDashboard },
    { path: '/candidats', label: 'Candidats', icon: Users },
    { path: '/clients', label: 'Clients', icon: Building2 },
    { path: '/prestataires', label: 'Prestataires', icon: UserCheck },
    { path: '/contrats', label: 'Contrats', icon: FileText },
    { path: '/rdv', label: 'Rendez-vous', icon: Calendar },
    { path: '/postes', label: 'Postes', icon: Briefcase },
    { path: '/recherche', label: 'Recherche', icon: Search },
    { path: '/matching', label: 'Matching IA', icon: BrainCircuit },
    { path: '/commentaires', label: 'Commentaires', icon: MessageSquare },
  ];

  // Menu supplémentaire pour les admins
  const adminMenuItems = profile?.role === 'ADMIN' ? [
    { path: '/admin', label: 'Administration', icon: ShieldCheck },
  ] : [];

  // Navigation pour les candidats
  const candidatMenuItems = [
    { path: '/candidat/dashboard', label: 'Mon Espace', icon: User },
  ];

  const menuItems = profile?.role === 'CANDIDAT' ? candidatMenuItems : [...recruiterMenuItems, ...adminMenuItems];

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X /> : <Menu />}
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 transform bg-card border-r border-border transition-transform duration-300 md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b border-border px-6">
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              TalentWave
            </h1>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border p-4 space-y-3">
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={signOut}
            >
              <LogOut className="h-5 w-5 mr-3" />
              Déconnexion
            </Button>
            <div className="rounded-lg bg-secondary p-3">
              <p className="text-xs text-muted-foreground">
                {profile?.prenom} {profile?.nom}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {profile?.role === 'CANDIDAT' ? 'Candidat' : profile?.role}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}