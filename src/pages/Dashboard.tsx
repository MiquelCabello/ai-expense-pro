// ...existing code...
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { 
  Euro, 
  Clock, 
  TrendingUp, 
  Upload, 
  Users, 
  BarChart3,
  PieChart,
  FileText,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface DashboardStats {
  totalExpenses: number;
  pendingExpenses: number;
  pendingCount: number;
  topCategory: string;
  dailyAverage: number;
  recentExpenses: any[];
}

export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalExpenses: 0,
    pendingExpenses: 0,
    pendingCount: 0,
    topCategory: '-',
    dailyAverage: 0,
    recentExpenses: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchDashboardStats();
    }
  }, [profile]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      
      // Get expenses based on user role
      let expenseQuery = supabase
        .from('expenses')
        // Removed direct 'profiles(name)' join to avoid errors if relationship not defined.
        // We'll fetch profiles separately and attach them to expenses (read-only).
        .select(`
          *,
          categories(name)
        `);

      // If employee, only show their expenses
      if (profile?.role === 'EMPLOYEE') {
        expenseQuery = expenseQuery.eq('employee_id', profile.user_id);
      }

      const { data: expenses } = await expenseQuery;
      if (!expenses) {
        setStats(s => ({ ...s, recentExpenses: [] }));
        return;
      }

      // Fetch profiles for employee_ids present in the expenses (only if needed)
      const employeeIds = Array.from(new Set(expenses.map((e: any) => e.employee_id).filter(Boolean)));
      let profilesMap: Record<string, any> = {};
      if (employeeIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', employeeIds);
        if (profiles && profiles.length > 0) {
          profilesMap = Object.fromEntries(profiles.map((p: any) => [p.user_id, p]));
        }
      }

      // Attach profiles info to expenses for backwards compatibility with UI
      const expensesWithProfiles = expenses.map((exp: any) => ({
        ...exp,
        profiles: profilesMap[exp.employee_id] || null
      }));

      // Calculate stats
      const total = expensesWithProfiles.reduce((sum: number, exp: any) => sum + (typeof exp.amount_gross === 'string' ? parseFloat(exp.amount_gross) : exp.amount_gross), 0);
      const pending = expensesWithProfiles
        .filter((exp: any) => exp.status === 'PENDING')
        .reduce((sum: number, exp: any) => sum + (typeof exp.amount_gross === 'string' ? parseFloat(exp.amount_gross) : exp.amount_gross), 0);
      const pendingCount = expensesWithProfiles.filter((exp: any) => exp.status === 'PENDING').length;
      
      // Get top category
      const categoryTotals = expensesWithProfiles.reduce((acc: Record<string, number>, exp: any) => {
        const category = exp.categories?.name || 'Otros';
        const amount = typeof exp.amount_gross === 'string' ? parseFloat(exp.amount_gross) : exp.amount_gross;
        acc[category] = (acc[category] || 0) + amount;
        return acc;
      }, {});
      
      const topCategory = Object.keys(categoryTotals).length > 0 
        ? Object.entries(categoryTotals).sort(([,a], [,b]) => b - a)[0][0]
        : '-';

      // Daily average (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentExpenses = expensesWithProfiles.filter((exp: any) => 
        new Date(exp.expense_date) >= thirtyDaysAgo
      );
      const dailyAverage = recentExpenses.length > 0 
        ? recentExpenses.reduce((sum: number, exp: any) => sum + (typeof exp.amount_gross === 'string' ? parseFloat(exp.amount_gross) : exp.amount_gross), 0) / 30
        : 0;

      // Recent expenses (last 5)
      const recent = expensesWithProfiles
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      setStats({
        totalExpenses: total,
        pendingExpenses: pending,
        pendingCount,
        topCategory,
        dailyAverage,
        recentExpenses: recent
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast.error('Error cargando estadísticas');
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

  const getStatusBadge = (status: string) => {
    const statusMap = {
      PENDING: { label: 'Pendiente', variant: 'secondary' as const, icon: Clock },
      APPROVED: { label: 'Aprobado', variant: 'default' as const, icon: CheckCircle },
      REJECTED: { label: 'Rechazado', variant: 'destructive' as const, icon: AlertTriangle }
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.PENDING;
    const Icon = statusInfo.icon;
    
    return (
      <Badge variant={statusInfo.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {statusInfo.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Dashboard Financiero</h2>
          <p className="text-muted-foreground">
            Resumen de gastos y actividad reciente
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-card border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(stats.totalExpenses)}
              </div>
              <p className="text-xs text-muted-foreground">
                Año actual
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {formatCurrency(stats.pendingExpenses)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.pendingCount} gastos por aprobar
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Categoría</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {stats.topCategory}
              </div>
              <p className="text-xs text-muted-foreground">
                Mayor gasto del periodo
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Promedio Diario</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">
                {formatCurrency(stats.dailyAverage)}
              </div>
              <p className="text-xs text-muted-foreground">
                Últimos 30 días
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Expenses */}
        <Card className="mb-8 bg-gradient-card border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Gastos Recientes
            </CardTitle>
            <CardDescription>
              Los últimos gastos registrados en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentExpenses.length > 0 ? (
              <div className="space-y-4">
                {stats.recentExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-4 bg-background/50 rounded-lg border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium">{expense.vendor}</h4>
                        {getStatusBadge(expense.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{expense.categories?.name}</span>
                        <span>•</span>
                        <span>{new Date(expense.expense_date).toLocaleDateString('es-ES')}</span>
                        {profile?.role === 'ADMIN' && (
                          <>
                            <span>•</span>
                            <span>{expense.profiles?.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(typeof expense.amount_gross === 'string' ? parseFloat(expense.amount_gross) : expense.amount_gross)}</div>
                      <div className="text-xs text-muted-foreground uppercase">{expense.currency}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay gastos registrados aún</p>
                <Button className="mt-4 bg-gradient-primary hover:opacity-90" onClick={() => window.location.href = '/upload'}>
                  <Upload className="mr-2 h-4 w-4" />
                  Subir Primer Recibo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-gradient-card border-0 shadow-md">
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
            <CardDescription>
              Funciones principales para gestionar gastos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button className="h-auto p-6 flex flex-col items-center gap-3 bg-gradient-primary hover:opacity-90" onClick={() => window.location.href = '/upload'}>
                <Upload className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-medium">Subir Recibo</div>
                  <div className="text-xs opacity-90">Captura con IA</div>
                </div>
              </Button>
              
              <Button variant="outline" className="h-auto p-6 flex flex-col items-center gap-3">
                <FileText className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-medium">Ver Gastos</div>
                  <div className="text-xs text-muted-foreground">Lista completa</div>
                </div>
              </Button>
              
              <Button variant="outline" className="h-auto p-6 flex flex-col items-center gap-3">
                <BarChart3 className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-medium">Analytics</div>
                  <div className="text-xs text-muted-foreground">Reportes detallados</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}