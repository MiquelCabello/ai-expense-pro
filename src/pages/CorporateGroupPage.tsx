import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthV2 } from '@/hooks/useAuthV2';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { 
  Building2, 
  Users, 
  Euro, 
  TrendingUp,
  BarChart3,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

interface CompanyStats {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  employeeCount: number;
  totalExpenses: number;
  pendingExpenses: number;
}

export default function CorporateGroupPage() {
  const { isGroupAdmin, account, managedCompanies, setSelectedCompanyId, loading: authLoading } = useAuthV2();
  const navigate = useNavigate();
  const [companiesStats, setCompaniesStats] = useState<CompanyStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isGroupAdmin) {
      navigate('/dashboard');
      return;
    }

    if (!authLoading && managedCompanies.length === 0) {
      navigate('/dashboard');
      return;
    }

    if (!authLoading && managedCompanies.length > 0) {
      loadCompaniesStats();
    }
  }, [authLoading, isGroupAdmin, managedCompanies, navigate]);

  const loadCompaniesStats = async () => {
    try {
      setLoading(true);
      const stats: CompanyStats[] = [];

      for (const company of managedCompanies) {
        // Load employee count
        const { data: memberships } = await supabase
          .from('memberships')
          .select('user_id')
          .eq('company_id', company.id);

        // Load expenses
        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount_gross, status')
          .eq('company_id', company.id);

        const totalExpenses = expenses?.reduce((sum, exp) => {
          const amount = typeof exp.amount_gross === 'string' 
            ? parseFloat(exp.amount_gross) 
            : exp.amount_gross;
          return sum + (amount || 0);
        }, 0) || 0;

        const pendingExpenses = expenses?.filter(e => e.status === 'PENDING').length || 0;

        stats.push({
          id: company.id,
          name: company.name,
          plan: company.plan,
          employeeCount: memberships?.length || 0,
          totalExpenses,
          pendingExpenses
        });
      }

      setCompaniesStats(stats);
    } catch (error) {
      console.error('[CorporateGroup] Error loading stats:', error);
      toast.error('Error cargando estadísticas del grupo');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getPlanBadge = (plan: string) => {
    const variants = {
      free: 'secondary' as const,
      pro: 'default' as const,
      enterprise: 'default' as const
    };
    const labels = {
      free: 'Starter',
      pro: 'Professional',
      enterprise: 'Enterprise'
    };
    return (
      <Badge variant={variants[plan as keyof typeof variants]}>
        {labels[plan as keyof typeof labels]}
      </Badge>
    );
  };

  const handleViewCompany = (companyId: string) => {
    setSelectedCompanyId(companyId);
    navigate('/dashboard');
  };

  const totalEmployees = companiesStats.reduce((sum, c) => sum + c.employeeCount, 0);
  const totalExpenses = companiesStats.reduce((sum, c) => sum + c.totalExpenses, 0);
  const totalPending = companiesStats.reduce((sum, c) => sum + c.pendingExpenses, 0);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando dashboard de grupo...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Dashboard Grupo Empresarial</h2>
          <p className="text-muted-foreground">
            {account?.name || 'Grupo Corporativo'} - Gestión de {managedCompanies.length} empresas
          </p>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-card border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Empleados</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{totalEmployees}</div>
              <p className="text-xs text-muted-foreground">En {managedCompanies.length} empresas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gastos Totales</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{formatCurrency(totalExpenses)}</div>
              <p className="text-xs text-muted-foreground">Consolidado</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{totalPending}</div>
              <p className="text-xs text-muted-foreground">Gastos por aprobar</p>
            </CardContent>
          </Card>
        </div>

        {/* Companies List */}
        <Card className="bg-gradient-card border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Empresas del Grupo
            </CardTitle>
            <CardDescription>
              Gestiona y visualiza el estado de cada empresa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {companiesStats.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between p-4 bg-background/50 rounded-lg border hover:bg-background/80 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      <h4 className="font-semibold">{company.name}</h4>
                      {getPlanBadge(company.plan)}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{company.employeeCount} empleados</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Euro className="h-4 w-4" />
                        <span>{formatCurrency(company.totalExpenses)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        <span>{company.pendingExpenses} pendientes</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleViewCompany(company.id)}
                    className="bg-gradient-primary hover:opacity-90"
                  >
                    Ver Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
