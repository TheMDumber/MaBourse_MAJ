
import { Home, Wallet, PiggyBank, BarChartBig, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Theme } from '@/lib/types';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  theme: Theme;
  changeTheme: (theme: Theme) => void;
  closeMobileNav?: () => void;
}

export const Sidebar = ({ theme, changeTheme, closeMobileNav }: SidebarProps) => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="h-full w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* En-tête avec logo */}
      <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
        <h1 className="text-xl font-bold text-sidebar-foreground">Ma Bourse 💰</h1>
        {closeMobileNav && (
          <Button variant="ghost" size="icon" onClick={closeMobileNav}>
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>
      
      {/* Navigation principale */}
      <nav className="flex-1 py-6 px-4">
        <ul className="space-y-2">
          <li>
            <Link to="/">
              <Button 
                variant={isActive('/') ? "default" : "ghost"} 
                className={`w-full justify-start ${isActive('/') ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
              >
                <Home className="mr-2 h-5 w-5" />
                Accueil
              </Button>
            </Link>
          </li>
          <li>
            <Link to="/accounts">
              <Button 
                variant={isActive('/accounts') ? "default" : "ghost"} 
                className={`w-full justify-start ${isActive('/accounts') ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
              >
                <Wallet className="mr-2 h-5 w-5" />
                Comptes
              </Button>
            </Link>
          </li>
          <li>
            <Link to="/transactions">
              <Button 
                variant={isActive('/transactions') ? "default" : "ghost"} 
                className={`w-full justify-start ${isActive('/transactions') ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
              >
                <PiggyBank className="mr-2 h-5 w-5" />
                Transactions
              </Button>
            </Link>
          </li>
          <li>
            <Link to="/statistics">
              <Button 
                variant={isActive('/statistics') ? "default" : "ghost"} 
                className={`w-full justify-start ${isActive('/statistics') ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
              >
                <BarChartBig className="mr-2 h-5 w-5" />
                Statistiques
              </Button>
            </Link>
          </li>
        </ul>
      </nav>
      
      {/* Pied de page */}
      <div className="p-4 border-t border-sidebar-border">
        <Link to="/settings">
          <Button 
            variant={isActive('/settings') ? "default" : "ghost"} 
            className={`w-full justify-start ${isActive('/settings') ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
          >
            <Settings className="mr-2 h-5 w-5" />
            Paramètres
          </Button>
        </Link>
      </div>
    </div>
  );
};
