import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  Users, 
  TrendingUp, 
  Shield, 
  Globe, 
  Mail, 
  Phone,
  MapPin,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useAuthV2 } from '@/hooks/useAuthV2';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface CompanyMetrics {
  total: number;
  active: number;
  inactive: number;
  admins: number;
  employees: number;
}

const PLAN_LABEL: Record<'FREE' | 'PROFESSIONAL' | 'ENTERPRISE', string> = {
  FREE: 'Starter',
  PROFESSIONAL: 'Professional',
  ENTERPRISE: 'Enterprise',
};

export default function CompanyProfilePage() {
  const { company, membership, isMaster, loading: authLoading } = useAuthV2();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<CompanyMetrics>({ 
    total: 0, 
    active: 0, 
    inactive: 0, 
    admins: 0, 
    employees: 0 
  });
  const [loading, setLoading] = useState(true);

  const isAdmin = membership?.role !== 'employee' || isMaster;
  const planKey = (company?.plan?.toUpperCase() ?? 'FREE') as 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE';

  useEffect(() => {
    const companyId = company?.id;
    if (!companyId) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        
        const { data: membershipsData, error: membershipsError } = await supabase
          .from('memberships')
          .select('role')
          .eq('company_id', companyId);

        if (membershipsError) throw membershipsError;

        const initial: CompanyMetrics = { total: 0, active: 0, inactive: 0, admins: 0, employees: 0 };
        const aggregated = (membershipsData ?? []).reduce((acc, row) => {
          acc.total += 1;
          acc.active += 1;
          if (row.role === 'owner' || row.role === 'company_admin') acc.admins += 1;
          if (row.role === 'department_admin') acc.admins += 1; // department_admin también es admin
          if (row.role === 'employee') acc.employees += 1;
          return acc;
        }, initial);

        setMetrics(aggregated);
      } catch (error) {
        console.error('[CompanyProfile] unable to load data', error);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [company?.id]);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando información...</p>
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
            <CardContent className="pt-6 text-center">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Sin información de empresa</h3>
              <p className="text-sm text-muted-foreground">
                No hemos podido cargar los detalles de la cuenta.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-primary opacity-5"></div>
          <div className="relative px-6 py-16 md:py-24">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              {company.logo_url ? (
                <div className="flex justify-center mb-6">
                  <img 
                    src={company.logo_url} 
                    alt={company.name}
                    className="h-24 w-24 object-contain rounded-2xl shadow-lg"
                  />
                </div>
              ) : (
                <div className="flex justify-center mb-6">
                  <div className="h-24 w-24 bg-gradient-primary rounded-2xl shadow-lg flex items-center justify-center">
                    <Building2 className="h-12 w-12 text-primary-foreground" />
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                <Badge variant="secondary" className="text-sm px-4 py-1">
                  <Sparkles className="h-3 w-3 mr-2" />
                  Plan {PLAN_LABEL[planKey]}
                </Badge>
                <h1 className="text-4xl md:text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  {company.name}
                </h1>
                {company.description && (
                  <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                    {company.description}
                  </p>
                )}
              </div>

              {isAdmin && (
                <Button 
                  size="lg"
                  onClick={() => navigate('/configuracion')}
                  className="mt-6 bg-gradient-primary hover:opacity-90"
                >
                  Configurar empresa
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="px-6 py-12 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="hover-scale">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{metrics.active}</p>
                    <p className="text-sm text-muted-foreground">Usuarios activos</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-scale">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{metrics.admins}</p>
                    <p className="text-sm text-muted-foreground">Administradores</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-scale">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{metrics.employees}</p>
                    <p className="text-sm text-muted-foreground">Empleados</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-scale">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{metrics.total}</p>
                    <p className="text-sm text-muted-foreground">Total miembros</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Company Info Section */}
        <section className="px-6 py-12 max-w-6xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-6">Información de contacto</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {company.email && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">{company.email}</p>
                    </div>
                  </div>
                )}

                {company.phone && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Teléfono</p>
                      <p className="text-sm text-muted-foreground">{company.phone}</p>
                    </div>
                  </div>
                )}

                {company.address && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Dirección</p>
                      <p className="text-sm text-muted-foreground">
                        {company.address}
                        {company.city && `, ${company.city}`}
                        {company.postal_code && ` ${company.postal_code}`}
                      </p>
                    </div>
                  </div>
                )}

                {company.website && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Globe className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Sitio web</p>
                      <a 
                        href={company.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {company.website}
                      </a>
                    </div>
                  </div>
                )}

                {company.tax_id && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">CIF/NIF</p>
                      <p className="text-sm text-muted-foreground">{company.tax_id}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Quick Actions */}
        <section className="px-6 py-12 max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Acciones rápidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="h-auto py-6 flex-col gap-2"
              onClick={() => navigate('/upload')}
            >
              <TrendingUp className="h-6 w-6" />
              <span className="font-medium">Subir gasto</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="h-auto py-6 flex-col gap-2"
              onClick={() => navigate('/gastos')}
            >
              <Building2 className="h-6 w-6" />
              <span className="font-medium">Ver gastos</span>
            </Button>

            {isAdmin && (
              <Button 
                variant="outline" 
                className="h-auto py-6 flex-col gap-2"
                onClick={() => navigate('/empleados')}
              >
                <Users className="h-6 w-6" />
                <span className="font-medium">Gestionar equipo</span>
              </Button>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
