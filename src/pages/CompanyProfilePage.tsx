import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Users, ShieldCheck, Briefcase, Activity, Building2, Save, Edit, X } from 'lucide-react';
import { useAuthV2 } from '@/hooks/useAuthV2';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
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

interface CompanyInfo {
  name: string;
  tax_id: string;
  address: string;
  city: string;
  postal_code: string;
  phone: string;
  email: string;
  website: string;
  description: string;
}

export default function CompanyProfilePage() {
  const { company, membership, isMaster, profileV2, loading: authLoading } = useAuthV2();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<CompanyMetrics>({ total: 0, active: 0, inactive: 0, admins: 0, employees: 0 });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    name: '',
    tax_id: '',
    address: '',
    city: '',
    postal_code: '',
    phone: '',
    email: '',
    website: '',
    description: '',
  });

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

    const loadData = async () => {
      try {
        setLoading(true);
        
        // Cargar información completa de la empresa
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyId)
          .single();

        if (companyError) throw companyError;

        // Actualizar información de la empresa
        setCompanyInfo({
          name: companyData.name || '',
          tax_id: companyData.tax_id || '',
          address: companyData.address || '',
          city: companyData.city || '',
          postal_code: companyData.postal_code || '',
          phone: companyData.phone || '',
          email: companyData.email || '',
          website: companyData.website || '',
          description: companyData.description || '',
        });
        
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
        console.error('[CompanyProfile] unable to load data', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo cargar la información de la empresa",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [company?.id, toast]);

  const usagePercentage = useMemo(() => {
    if (!maxEmployees || maxEmployees === 0) return 100;
    if (metrics.active === 0) return 0;
    return Math.min(100, Math.round((metrics.active / maxEmployees) * 100));
  }, [metrics.active, maxEmployees]);

  const handleSaveCompanyInfo = async () => {
    if (!company?.id) return;

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('companies')
        .update({
          name: companyInfo.name,
          tax_id: companyInfo.tax_id,
          address: companyInfo.address,
          city: companyInfo.city,
          postal_code: companyInfo.postal_code,
          phone: companyInfo.phone,
          email: companyInfo.email,
          website: companyInfo.website,
          description: companyInfo.description,
        })
        .eq('id', company.id);

      if (error) throw error;

      toast({
        title: "Información actualizada",
        description: "Los datos de la empresa se han guardado correctamente",
      });
      setIsEditing(false);
    } catch (error) {
      console.error('[CompanyProfile] Error saving company info:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar la información de la empresa",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Restaurar valores originales
    setCompanyInfo({
      name: company?.name || '',
      tax_id: (company as any)?.tax_id || '',
      address: (company as any)?.address || '',
      city: (company as any)?.city || '',
      postal_code: (company as any)?.postal_code || '',
      phone: (company as any)?.phone || '',
      email: (company as any)?.email || '',
      website: (company as any)?.website || '',
      description: (company as any)?.description || '',
    });
    setIsEditing(false);
  };

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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{companyInfo.name || company.name}</h1>
              <p className="text-sm text-muted-foreground">Información de la empresa</p>
            </div>
          </div>
          {isAdmin && !isEditing && (
            <Button onClick={() => setIsEditing(true)} variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Editar información
            </Button>
          )}
        </div>

        {/* Información de la empresa */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Datos de la empresa</CardTitle>
                <CardDescription>
                  {isAdmin && isEditing 
                    ? 'Modifica la información de tu empresa' 
                    : 'Información general de la organización'}
                </CardDescription>
              </div>
              {isAdmin && isEditing && (
                <div className="flex gap-2">
                  <Button onClick={handleCancelEdit} variant="outline" size="sm" disabled={isSaving}>
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveCompanyInfo} size="sm" disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la empresa</Label>
                {isAdmin && isEditing ? (
                  <Input
                    id="name"
                    value={companyInfo.name}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                    placeholder="Nombre de la empresa"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{companyInfo.name || 'No especificado'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_id">CIF/NIF</Label>
                {isAdmin && isEditing ? (
                  <Input
                    id="tax_id"
                    value={companyInfo.tax_id}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, tax_id: e.target.value })}
                    placeholder="B12345678"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{companyInfo.tax_id || 'No especificado'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email de contacto</Label>
                {isAdmin && isEditing ? (
                  <Input
                    id="email"
                    type="email"
                    value={companyInfo.email}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })}
                    placeholder="contacto@empresa.com"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{companyInfo.email || 'No especificado'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                {isAdmin && isEditing ? (
                  <Input
                    id="phone"
                    value={companyInfo.phone}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })}
                    placeholder="+34 123 456 789"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{companyInfo.phone || 'No especificado'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                {isAdmin && isEditing ? (
                  <Input
                    id="address"
                    value={companyInfo.address}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                    placeholder="Calle Principal 123"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{companyInfo.address || 'No especificado'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Ciudad</Label>
                {isAdmin && isEditing ? (
                  <Input
                    id="city"
                    value={companyInfo.city}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, city: e.target.value })}
                    placeholder="Madrid"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{companyInfo.city || 'No especificado'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="postal_code">Código postal</Label>
                {isAdmin && isEditing ? (
                  <Input
                    id="postal_code"
                    value={companyInfo.postal_code}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, postal_code: e.target.value })}
                    placeholder="28001"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{companyInfo.postal_code || 'No especificado'}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Sitio web</Label>
                {isAdmin && isEditing ? (
                  <Input
                    id="website"
                    value={companyInfo.website}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, website: e.target.value })}
                    placeholder="https://www.empresa.com"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{companyInfo.website || 'No especificado'}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Descripción</Label>
                {isAdmin && isEditing ? (
                  <Textarea
                    id="description"
                    value={companyInfo.description}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, description: e.target.value })}
                    placeholder="Descripción breve de la empresa..."
                    rows={4}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{companyInfo.description || 'No especificado'}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <CompanySummaryCard
          account={accountAdapter as any}
          profile={profileAdapter as any}
          planDisplay={planDisplay}
          activeEmployees={metrics.active}
          maxEmployees={maxEmployees}
        />

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
