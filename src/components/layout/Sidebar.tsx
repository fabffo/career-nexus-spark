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
  ChevronDown,
  ChevronRight,
  Handshake,
  Activity,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export function Sidebar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const { profile, signOut } = useAuth();

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Structure hiérarchique pour l'administrateur et recruteurs
  const adminStructuredMenu = [
    {
      label: 'Partenaires',
      icon: Handshake,
      category: 'partenaires',
      items: [
        { path: '/candidats', label: 'Candidats', icon: Users },
        { path: '/clients', label: 'Clients', icon: Building2 },
        { path: '/prestataires', label: 'Prestataires', icon: UserCheck },
        { path: '/salaries', label: 'Salariés', icon: Users },
        { path: '/fournisseurs-generaux', label: 'Fournisseurs Généraux', icon: Building2 },
        { path: '/fournisseurs-services', label: 'Fournisseurs Services', icon: Building2 },
        { path: '/fournisseurs-etat-organismes', label: 'Fournisseurs État & organismes sociaux', icon: Building2 },
      ]
    },
    {
      label: 'Contrats',
      icon: FileText,
      category: 'contrats',
      items: [
        { path: '/contrats', label: 'Tous les contrats', icon: FileText },
        { path: '/contrats-clients', label: 'Contrats Clients', icon: FileText },
        { path: '/contrats-fournisseurs', label: 'Contrats Fournisseurs', icon: FileText },
      ]
    },
    {
      label: 'Missions',
      icon: Briefcase,
      category: 'missions',
      items: [
        { path: '/missions', label: 'Toutes les missions', icon: Briefcase },
        { path: '/missions-clients', label: 'Missions Clients', icon: Briefcase },
        { path: '/missions-fournisseurs', label: 'Missions Fournisseurs', icon: Briefcase },
      ]
    },
    {
      label: 'Actions',
      icon: Activity,
      category: 'actions',
      items: [
        { path: '/rdv', label: 'Rendez-vous', icon: Calendar },
        { path: '/postes', label: 'Postes', icon: Briefcase },
      ]
    },
    {
      label: 'Finances',
      icon: FileText,
      category: 'finances',
      items: [
        { path: '/factures', label: 'Toutes les factures', icon: FileText },
        { path: '/factures-ventes', label: 'Factures de vente', icon: FileText },
        { path: '/factures-achats', label: 'Factures d\'achat', icon: FileText },
        { path: '/rapprochement-bancaire', label: 'Rapprochement bancaire', icon: FileText },
        { path: '/tva-mensuel', label: 'TVA Mensuel', icon: FileText },
        { path: '/fiscalite', label: 'Gestion Fiscale SASU', icon: FileText },
      ]
    },
    {
      label: 'Expertises',
      icon: Sparkles,
      category: 'expertises',
      items: [
        { path: '/recherche', label: 'Recherche', icon: Search },
        { path: '/matching', label: 'Matching IA', icon: BrainCircuit },
      ]
    },
  ];

  // Ajout du menu Administration uniquement pour les admins
  if (profile?.role === 'ADMIN') {
    adminStructuredMenu.push({
      label: 'Administration',
      icon: ShieldCheck,
      category: 'administration',
      items: [
        { path: '/admin', label: 'Paramètres', icon: ShieldCheck },
      ]
    });
  }

  // Navigation pour les candidats
  const candidatMenuItems = [
    { path: '/candidat/dashboard', label: 'Mon Espace', icon: User },
  ];

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

          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            {/* Tableau de bord - toujours visible */}
            {profile?.role !== 'CANDIDAT' && (
              <Link
                to="/"
                onClick={() => setIsOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 mb-4',
                  location.pathname === '/'
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <LayoutDashboard className="h-5 w-5" />
                Tableau de bord
              </Link>
            )}

            {/* Menu pour candidats */}
            {profile?.role === 'CANDIDAT' ? (
              candidatMenuItems.map((item) => {
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
              })
            ) : (
              /* Menu structuré pour admin et recruteurs */
              adminStructuredMenu.map((category) => {
                const CategoryIcon = category.icon;
                const isExpanded = expandedCategories.includes(category.category);
                const hasActiveChild = category.items.some(item => location.pathname === item.path);
                
                return (
                  <div key={category.category} className="space-y-1">
                    <button
                      onClick={() => toggleCategory(category.category)}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                        hasActiveChild || isExpanded
                          ? 'text-foreground bg-secondary/50'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <CategoryIcon className="h-5 w-5" />
                        {category.label}
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    
                    {isExpanded && (
                      <div className="ml-2 space-y-1">
                        {category.items.map((item) => {
                          const ItemIcon = item.icon;
                          const isActive = location.pathname === item.path;
                          
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              onClick={() => setIsOpen(false)}
                              className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 pl-11',
                                isActive
                                  ? 'bg-primary text-primary-foreground shadow-md'
                                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                              )}
                            >
                              <ItemIcon className="h-4 w-4" />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
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