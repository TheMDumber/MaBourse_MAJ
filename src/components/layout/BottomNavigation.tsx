import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  HomeIcon, 
  BarChartIcon, 
  WalletIcon, 
  ArrowDownUpIcon, 
  BookOpenIcon,
  SettingsIcon,
  ShieldAlertIcon 
} from 'lucide-react';

interface BottomNavigationProps {
  className?: string;
}

export function BottomNavigation({ className = '' }: BottomNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activePath, setActivePath] = useState('/');

  useEffect(() => {
    // Mise à jour de l'élément actif en fonction du chemin actuel
    const path = location.pathname;
    setActivePath(path);
  }, [location]);

  const navItems = [
    { path: '/', icon: HomeIcon, label: 'Accueil' },
    { path: '/accounts', icon: WalletIcon, label: 'Comptes' },
    { path: '/transactions', icon: ArrowDownUpIcon, label: 'Opérations' },
    { path: '/statistics', icon: BarChartIcon, label: 'Statistiques' },
    { path: '/journal', icon: BookOpenIcon, label: 'Journal' },
    { path: '/settings', icon: SettingsIcon, label: 'Réglages' },
    { path: '/admin', icon: ShieldAlertIcon, label: 'Admin' }
  ];

  return (
    <nav className={`bottom-nav ${className}`}>
      {navItems.map((item) => (
        <button
          key={item.path}
          className={`bottom-nav-item ${activePath === item.path ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
          aria-label={item.label}
        >
          <item.icon size={24} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

export default BottomNavigation;
