import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Users, ShieldCheck, Briefcase, Activity, Building2 } from 'lucide-react';
import { useAuthV2 } from '@/hooks/useAuthV2';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import CompanySummaryCard from '@/components/CompanySummaryCard';

interface CompanyMetrics {
  total: number;
  active: number;
  inactive: number;
  admins: number;
  employees: number;
}

const PLAN_FEATURES: Record<'FREE' | 'PROFESSIONAL' | 'ENTERPRISE', string[]> = {
  FREE: [
    'Hasta 2 usuarios activos',
    'Subida ilimitada de tickets',
    'Panel de gastos en tiempo real',
    'Exportación básica en CSV'
  ],
  PROFESSIONAL: [
    'Hasta 25 usuarios activos',
    'Flujos de aprobación multi-nivel',
    'Centros de coste y regiones personalizadas',
    'Integración con ERP y contabilidad'
  ],
  ENTERPRISE: [
    'Usuarios ilimitados',
    'SSO & SCIM empresarial',
    'Soporte dedicado 24/7',
    'Automatizaciones avanzadas con IA'
  ],
};

const PLAN_LABEL: Record<'FREE' | 'PROFESSIONAL' | 'ENTERPRISE', string> = {
  FREE: 'Starter',
  PROFESSIONAL: 'Professional',
  ENTERPRISE: 'Enterprise',
};

export default function CompanyProfilePage() {
  const { company, membership, isMaster, profileV2, loading: authLoading } = useAuthV2();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<CompanyMetrics>({ total: 0, active: 0, inactive: 0, admins: 0, employees: 0 });
  const [loading, setLoading] = useState(true);

  const isAdmin = membership?.role !== 'employee' || isMaster;
  const planKey = (company?.plan?.toUpperCase() ?? 'FREE') as 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE';
  const planLabel = PLAN_LABEL[planKey];
  const maxEmployees = company?.max_employees ?? (planKey === 'FREE' ? 2 : planKey === 'PROFESSIONAL' ? 25 : null);

  useEffect(() => {
    const companyId = company?.id;
    if (!companyId) {
      setLoading(false);
      return;
    }

    const loadMetrics = async () => {
      try {
        setLoading(true);
        
        // Cargar métricas de membresías (nuevo sistema)
        const { data: membershipsData, error: membershipsError } = await supabase
          .from('memberships')
          .select('role')
          .eq('company_id', companyId);

        if (membershipsError) throw membershipsError;

        const initial: CompanyMetrics = { total: 0, active: 0, inactive: 0, admins: 0, employees: 0 };
        const aggregated = (membershipsData ?? []).reduce((acc, row) => {
          acc.total += 1;
          acc.active += 1; // En el nuevo sistema, todos los memberships son activos
          if (row.role === 'owner' || row.role === 'company_admin' || row.role === 'global_admin') acc.admins += 1;
          if (row.role === 'employee') acc.employees += 1;
          return acc;
        }, initial);

        setMetrics(aggregated);
      } catch (error) {
        console.error('[CompanyProfile] unable to load metrics', error);
      } finally {
        setLoading(false);
      }
    };

    void loadMetrics();
  }, [company?.id]);

  const usagePercentage = useMemo(() => {
    if (!maxEmployees || maxEmployees === 0) return 100;
    if (metrics.active === 0) return 0;
    return Math.min(100, Math.round((metrics.active / maxEmployees) * 100));
  }, [metrics.active, maxEmployees]);

  if (authLoading) {
    return (
      <AppLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando información de la empresa...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!company) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Sin información de empresa
              </CardTitle>
              <CardDescription>
                No hemos podido cargar los detalles de la cuenta. Inicia sesión con un usuario asociado a una empresa.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const planDisplay = `Plan ${PLAN_LABEL[planKey]}`;
  const planFeatures = PLAN_FEATURES[planKey];

  // Adaptar datos al formato esperado por CompanySummaryCard
  const accountAdapter = {
    id: company.id,
    name: company.name,
    plan: planKey,
    owner_user_id: company.owner_user_id,
    max_employees: company.max_employees,
    monthly_expense_limit: company.monthly_expense_limit,
  };

  const profileAdapter = {
    user_id: profileV2?.user_id ?? '',
    email: profileV2?.email ?? '',
    name: profileV2?.name ?? '',
    role: isAdmin ? 'ADMIN' : 'EMPLOYEE',
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{company.name}</h1>
            <p className="text-sm text-muted-foreground">Información de la empresa</p>
          </div>
        </div>

        <CompanySummaryCard
          account={accountAdapter as any}
          profile={profileAdapter as any}
          planDisplay={planDisplay}
          activeEmployees={metrics.active}
          maxEmployees={maxEmployees}
        />
        
        {isAdmin && (
          <Button className="self-start" variant="outline" onClick={() => navigate('/configuracion')}>
            Configurar empresa
          </Button>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Usuarios activos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.active}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {maxEmployees ? `${metrics.active} de ${maxEmployees} disponibles` : 'Usuarios ilimitados'}
              </p>
              {maxEmployees && (
                <div className="mt-3">
                  <Progress value={usagePercentage} />
                  <p className="text-xs text-muted-foreground mt-1">{usagePercentage}% de la capacidad</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Distribución de roles</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-lg font-semibold">{metrics.admins}</div>
                  <p className="text-xs text-muted-foreground">Administradores</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-lg font-semibold">{metrics.employees}</div>
                  <p className="text-xs text-muted-foreground">Empleados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Estado de actividad</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-success" />
                <div>
                  <div className="text-lg font-semibold">{metrics.active}</div>
                  <p className="text-xs text-muted-foreground">Activos</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-lg font-semibold">{metrics.inactive}</div>
                  <p className="text-xs text-muted-foreground">Inactivos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Resumen del plan {planLabel}</CardTitle>
            <CardDescription>
              Características disponibles actualmente para tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {planFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Configuración rápida</CardTitle>
              <CardDescription>
                Accesos directos para administrar tu organización
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => navigate('/configuracion')}>
                Ajustes generales
              </Button>
              <Button variant="outline" onClick={() => navigate('/empleados')}>
                Gestionar usuarios
              </Button>
              <Button variant="outline" onClick={() => navigate('/upload')}>
                Subir documento
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
