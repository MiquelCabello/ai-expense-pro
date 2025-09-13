import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  TrendingDown,
  Euro,
  Calendar,
  Download,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';

interface AnalyticsData {
  totalExpenses: number;
  expenseCount: number;
  averageExpense: number;
  categoryBreakdown: { name: string; amount: number; count: number }[];
  monthlyTrend: { month: string; amount: number }[];
  statusBreakdown: { status: string; count: number; amount: number }[];
}

export default function AnalyticsPage() {
  const { profile } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalExpenses: 0,
    expenseCount: 0,
    averageExpense: 0,
    categoryBreakdown: [],
    monthlyTrend: [],
    statusBreakdown: []
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('last_6_months');

  useEffect(() => {
    fetchAnalytics();
  }, [profile, timeRange]);

  const fetchAnalytics = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case 'last_month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'last_3_months':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'last_6_months':
          startDate.setMonth(startDate.getMonth() - 6);
          break;
        case 'last_year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      let query = supabase
        .from('expenses')
        .select(`
          *,
          categories(name)
        `)
        .gte('expense_date', startDate.toISOString().split('T')[0])
        .lte('expense_date', endDate.toISOString().split('T')[0]);

      // If employee, only show their expenses
      if (profile.role === 'EMPLOYEE') {
        query = query.eq('employee_id', profile.user_id);
      }

      const { data: expenses, error } = await query;
      
      if (error) throw error;

      if (!expenses || expenses.length === 0) {
        setAnalytics({
          totalExpenses: 0,
          expenseCount: 0,
          averageExpense: 0,
          categoryBreakdown: [],
          monthlyTrend: [],
          statusBreakdown: []
        });
        return;
      }

      // Calculate analytics
      const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount_gross.toString()), 0);
      const expenseCount = expenses.length;
      const averageExpense = totalExpenses / expenseCount;

      // Category breakdown
      const categoryMap: Record<string, { amount: number; count: number }> = {};
      expenses.forEach(exp => {
        const category = exp.categories?.name || 'Sin categoría';
        const amount = parseFloat(exp.amount_gross.toString());
        if (!categoryMap[category]) {
          categoryMap[category] = { amount: 0, count: 0 };
        }
        categoryMap[category].amount += amount;
        categoryMap[category].count += 1;
      });

      const categoryBreakdown = Object.entries(categoryMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.amount - a.amount);

      // Monthly trend
      const monthlyMap: Record<string, number> = {};
      expenses.forEach(exp => {
        const date = new Date(exp.expense_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const amount = parseFloat(exp.amount_gross.toString());
        monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + amount;
      });

      const monthlyTrend = Object.entries(monthlyMap)
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // Status breakdown
      const statusMap: Record<string, { count: number; amount: number }> = {};
      expenses.forEach(exp => {
        const status = exp.status;
        const amount = parseFloat(exp.amount_gross.toString());
        if (!statusMap[status]) {
          statusMap[status] = { count: 0, amount: 0 };
        }
        statusMap[status].count += 1;
        statusMap[status].amount += amount;
      });

      const statusBreakdown = Object.entries(statusMap)
        .map(([status, data]) => ({ status, ...data }));

      setAnalytics({
        totalExpenses,
        expenseCount,
        averageExpense,
        categoryBreakdown,
        monthlyTrend,
        statusBreakdown
      });

    } catch (error) {
      toast.error('Error cargando analíticas');
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

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      PENDING: 'Pendientes',
      APPROVED: 'Aprobados',
      REJECTED: 'Rechazados'
    };
    return labels[status as keyof typeof labels] || status;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando analíticas...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">Analíticas y Reportes</h2>
            <p className="text-muted-foreground">
              Análisis detallado de gastos y tendencias financieras
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_month">Último mes</SelectItem>
                <SelectItem value="last_3_months">Últimos 3 meses</SelectItem>
                <SelectItem value="last_6_months">Últimos 6 meses</SelectItem>
                <SelectItem value="last_year">Último año</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-card border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(analytics.totalExpenses)}
              </div>
              <p className="text-xs text-muted-foreground">
                {analytics.expenseCount} gastos registrados
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Promedio por Gasto</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {formatCurrency(analytics.averageExpense)}
              </div>
              <p className="text-xs text-muted-foreground">
                Gasto medio del periodo
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Categoría</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">
                {analytics.categoryBreakdown[0]?.name || '-'}
              </div>
              <p className="text-xs text-muted-foreground">
                {analytics.categoryBreakdown[0] ? formatCurrency(analytics.categoryBreakdown[0].amount) : 'Sin datos'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tendencia</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {analytics.monthlyTrend.length > 1 ? (
                  analytics.monthlyTrend[analytics.monthlyTrend.length - 1].amount > 
                  analytics.monthlyTrend[analytics.monthlyTrend.length - 2].amount ? 
                  '↗️ Creciente' : '↘️ Decreciente'
                ) : '📊 Estable'}
              </div>
              <p className="text-xs text-muted-foreground">
                Comparación mensual
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Breakdown */}
          <Card className="bg-gradient-card border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Gastos por Categoría
              </CardTitle>
              <CardDescription>
                Distribución de gastos por categoría
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.categoryBreakdown.length > 0 ? (
                <div className="space-y-4">
                  {analytics.categoryBreakdown.slice(0, 6).map((category, index) => (
                    <div key={category.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: `hsl(${(index * 45) % 360}, 70%, 50%)` }}
                        />
                        <span className="font-medium">{category.name}</span>
                        <span className="text-sm text-muted-foreground">({category.count} gastos)</span>
                      </div>
                      <span className="font-semibold">{formatCurrency(category.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No hay datos de categorías disponibles
                </p>
              )}
            </CardContent>
          </Card>

          {/* Monthly Trend */}
          <Card className="bg-gradient-card border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Tendencia Mensual
              </CardTitle>
              <CardDescription>
                Evolución de gastos por mes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.monthlyTrend.length > 0 ? (
                <div className="space-y-4">
                  {analytics.monthlyTrend.slice(-6).map((month, index) => {
                    const maxAmount = Math.max(...analytics.monthlyTrend.map(m => m.amount));
                    const percentage = maxAmount > 0 ? (month.amount / maxAmount) * 100 : 0;
                    
                    return (
                      <div key={month.month} className="space-y-2">
                        <div className="flex justify-between">
                          <span className="font-medium">{formatMonth(month.month)}</span>
                          <span className="font-semibold">{formatCurrency(month.amount)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-gradient-primary h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No hay datos de tendencia disponibles
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status Breakdown */}
        <Card className="bg-gradient-card border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Estado de los Gastos
            </CardTitle>
            <CardDescription>
              Distribución por estado de aprobación
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.statusBreakdown.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {analytics.statusBreakdown.map((status) => (
                  <div key={status.status} className="text-center p-4 bg-background/50 rounded-lg">
                    <div className="text-2xl font-bold mb-2">
                      {status.count}
                    </div>
                    <div className="text-sm font-medium mb-1">
                      {getStatusLabel(status.status)}
                    </div>
                    <div className="text-lg font-semibold text-primary">
                      {formatCurrency(status.amount)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No hay datos de estado disponibles
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}