import { useMemo, useState } from 'react';
import { useAuthV2 } from '@/hooks/useAuthV2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  FileText,
  Upload,
  PieChart,
  Users,
  Settings,
  Search,
  Plus,
  Bell,
  Building2,
  Database
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Sidebar() {
  const { user, company, membership, isMaster, signOut, profileV2, loading } = useAuthV2();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  // Para usuarios secundarios, mostrar el rol en lugar del plan
  const displayLabel = useMemo(() => {
    if (isMaster) return 'Master';
    
    // Si es owner, mostrar el plan de la empresa
    if (membership?.role === 'owner') {
      if (!company?.plan) return 'Sin plan';
      const map: Record<'free' | 'pro' | 'enterprise', string> = {
        free: 'Starter',
        pro: 'Professional',
        enterprise: 'Enterprise',
      };
      return `Plan ${map[company.plan]}`;
    }
    
    // Para otros usuarios, mostrar su rol
    if (membership?.role) {
      const roleMap: Record<string, string> = {
        'company_admin': 'Admin. Global',
        'global_admin': 'Admin. Global',
        'department_admin': 'Admin. de Departamento',
        'employee': 'Empleado'
      };
      return roleMap[membership.role] || 'Empleado';
    }
    
    return 'Empleado';
  }, [company?.plan, isMaster, membership?.role]);

  const isAdmin = membership?.role !== 'employee' || isMaster;
  const companyName = company?.name || 'Mi Empresa';
  // Obtener el nombre del usuario desde profiles (sistema antiguo)
  const userName = profileV2?.name || user?.email?.split('@')[0] || 'Usuario';
  const userEmail = profileV2?.email || user?.email || '';
  const logoUrl = company?.logo_url;

  // No mostrar menús admin hasta que termine de cargar
  const navigation = useMemo(() => {
    // Si está cargando, solo mostrar menús básicos
    if (loading) {
      return [
        {
          name: 'Dashboard',
          href: '/dashboard',
          icon: BarChart3,
          current: location.pathname === '/dashboard'
        },
        {
          name: 'Gastos',
          href: '/gastos',
          icon: FileText,
          current: location.pathname === '/gastos'
        },
        {
          name: 'Subir Ticket',
          href: '/upload',
          icon: Upload,
          current: location.pathname === '/upload'
        },
        {
          name: 'Análisis',
          href: '/analisis',
          icon: PieChart,
          current: location.pathname === '/analisis'
        },
        {
          name: 'Mi Empresa',
          href: '/empresa',
          icon: Building2,
          current: location.pathname === '/empresa'
        }
      ];
    }

    // Cuando ya cargó, mostrar menús según rol
    return [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: BarChart3,
        current: location.pathname === '/dashboard'
      },
      {
        name: 'Gastos',
        href: '/gastos',
        icon: FileText,
        current: location.pathname === '/gastos'
      },
      {
        name: 'Subir Ticket',
        href: '/upload',
        icon: Upload,
        current: location.pathname === '/upload'
      },
      {
        name: 'Análisis',
        href: '/analisis',
        icon: PieChart,
        current: location.pathname === '/analisis'
      },
      {
        name: 'Mi Empresa',
        href: '/empresa',
        icon: Building2,
        current: location.pathname === '/empresa'
      },
      ...(isAdmin
        ? [{
          name: 'Empleados',
          href: '/empleados',
          icon: Users,
          current: location.pathname === '/empleados'
        }]
        : []),
      ...(isAdmin
        ? [{
          name: 'Configuración',
          href: '/configuracion',
          icon: Settings,
          current: location.pathname === '/configuracion'
        }, {
          name: 'Test Migración',
          href: '/migration-test',
          icon: Database,
          current: location.pathname === '/migration-test'
        }]
        : [])
    ];
  }, [location.pathname, isAdmin, loading]);

  return (
    <>
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          {logoUrl ? (
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
              <img 
                src={logoUrl} 
                alt={companyName}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="bg-gradient-primary rounded-lg p-2 flex-shrink-0">
              <BarChart3 className="h-6 w-6 text-primary-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{companyName}</h1>
            <p className="text-xs text-muted-foreground truncate">Gestión de Gastos</p>
            <Badge variant="secondary" className="mt-1">
              {displayLabel}
            </Badge>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar gastos, comercios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button className="w-full mt-3 bg-gradient-primary hover:opacity-90" onClick={() => navigate('/upload')}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Gasto
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.name}
              variant={item.current ? "default" : "ghost"}
              className={`w-full justify-start ${
                item.current 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-accent hover:text-accent-foreground"
              }`}
              onClick={() => navigate(item.href)}
            >
              <Icon className="h-4 w-4 mr-3" />
              {item.name}
              {item.name === 'Gastos' && (
                <Badge variant="secondary" className="ml-auto">
                  3
                </Badge>
              )}
            </Button>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-sm font-medium text-primary-foreground">
              {userName?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={signOut}
        >
          Cerrar Sesión
        </Button>
      </div>
    </>
  );
}
