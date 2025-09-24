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
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const menuItems = [
  { path: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { path: '/candidats', label: 'Candidats', icon: Users },
  { path: '/clients', label: 'Clients', icon: Building2 },
  { path: '/rdv', label: 'Rendez-vous', icon: Calendar },
  { path: '/postes', label: 'Postes', icon: Briefcase },
  { path: '/recherche', label: 'Recherche', icon: Search },
  { path: '/matching', label: 'Matching IA', icon: BrainCircuit },
  { path: '/commentaires', label: 'Commentaires', icon: MessageSquare },
];

export function Sidebar() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

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

          <div className="border-t border-border p-4">
            <div className="rounded-lg bg-secondary p-3">
              <p className="text-xs text-muted-foreground">Version 1.0.0</p>
              <p className="text-xs text-muted-foreground mt-1">© 2024 Recruitment Solutions</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}