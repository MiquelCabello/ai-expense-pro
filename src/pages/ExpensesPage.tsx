import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuthV2 } from '@/hooks/useAuthV2';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { 
  FileText, 
  Search, 
  Filter, 
  Download,
  Clock,
  CheckCircle,
  AlertTriangle,
  Euro,
  Calendar,
  Eye,
  Check,
  X,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

interface Expense {
  id: string;
  vendor: string;
  amount_gross: number;
  amount_net: number;
  tax_vat: number;
  expense_date: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  payment_method: string;
  currency: string;
  notes?: string;
  receipt_file_id?: string;
  employee_id: string;
  categories: { name: string } | null;
  profiles?: { name: string } | null;
  created_at: string;
  doc_type?: string;
  dropbox_path?: string;
  dropbox_url?: string;
}

export default function ExpensesPage() {
  const { company, isMaster, membership, user } = useAuthV2();
  const planMonthlyLimitMap: Record<'free' | 'pro' | 'enterprise', number | null> = {
    free: 50,
    pro: null,
    enterprise: null,
  };
  const planKey = (company?.plan ?? 'free') as 'free' | 'pro' | 'enterprise';
  const resolvedAccountId = !isMaster ? (company?.id ?? undefined) : undefined;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  const canManageExpenses = isMaster || membership?.role === 'owner' || membership?.role === 'company_admin' || membership?.role === 'department_admin';

  const fetchExpenses = useCallback(async () => {
    if (!isMaster && !resolvedAccountId) {
      console.warn('[Expenses] Missing company_id for non-master user');
      setExpenses([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      let query = supabase
        .from('expenses')
        .select(`
          *,
          categories(name)
        `)
        .order('created_at', { ascending: false });

      if (!isMaster && resolvedAccountId) {
        query = query.eq('company_id', resolvedAccountId);
      }

      // If employee, only show their expenses
      if (!isMaster && membership?.role === 'employee') {
        query = query.eq('employee_id', user?.id);
      }

      const { data: expensesData, error } = await query;
      if (error) {
        throw error;
      }

      const resolvedExpenses = expensesData ?? [];

      // Fetch profiles for employee names (if admin)
      let expensesWithProfiles = resolvedExpenses.map(exp => ({ ...exp, profiles: null }));
      const isAdmin = isMaster || membership?.role === 'owner' || membership?.role === 'company_admin' || membership?.role === 'global_admin';
      if (isAdmin && resolvedExpenses.length > 0) {
        const employeeIds = Array.from(new Set(resolvedExpenses.map(e => e.employee_id).filter(Boolean)));
        if (employeeIds.length > 0) {
          try {
            const profileQuery = supabase
              .from('profiles_v2')
              .select('user_id, email')
              .in('user_id', employeeIds);

            if (!isMaster && resolvedAccountId) {
              // profiles_v2 doesn't have account_id, skip filtering
            }

            const { data: profiles, error: profilesError } = await profileQuery;

            if (!profilesError && profiles) {
              const profilesMap = Object.fromEntries(profiles.map(p => [p.user_id, { user_id: p.user_id, name: p.email }]));
              expensesWithProfiles = resolvedExpenses.map(exp => ({
                ...exp,
                profiles: profilesMap[exp.employee_id] || null
              }));
            }
          } catch (profilesError) {
            console.warn('[Expenses] Unable to fetch employee names', profilesError);
          }
        }
      }

      setExpenses(expensesWithProfiles);
    } catch (error) {
      toast.error('Error cargando gastos');
    } finally {
      setLoading(false);
    }
  }, [membership, resolvedAccountId, isMaster, user]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.categories?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.profiles?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || expense.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleViewExpense = async (expense: Expense) => {
    setSelectedExpense(expense);
    
    // Obtener URL del recibo si existe
    if (expense.receipt_file_id) {
      try {
        // Intentar obtener storage_key desde la tabla files
        const { data: fileData } = await supabase
          .from('files')
          .select('storage_key')
          .eq('id', expense.receipt_file_id)
          .single();
        
        let storageKey = fileData?.storage_key;
        
        // Si no existe en la tabla files, usar el receipt_file_id directamente como storage_key
        if (!storageKey) {
          storageKey = expense.receipt_file_id;
        }
        
        // Obtener la URL pública del archivo
        const { data } = supabase.storage
          .from('receipts')
          .getPublicUrl(storageKey);
        
        setReceiptUrl(data.publicUrl);
      } catch (error) {
        console.error('[ExpensesPage] Error getting receipt URL:', error);
        // En caso de error, intentar usar el receipt_file_id directamente
        try {
          const { data } = supabase.storage
            .from('receipts')
            .getPublicUrl(expense.receipt_file_id);
          setReceiptUrl(data.publicUrl);
        } catch (fallbackError) {
          console.error('[ExpensesPage] Fallback error:', fallbackError);
        }
      }
    }
  };

  const handleApproveExpense = async () => {
    if (!selectedExpense) return;
    
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('expenses')
        .update({ 
          status: 'APPROVED',
          approved_at: new Date().toISOString(),
          approver_id: user?.id
        })
        .eq('id', selectedExpense.id);
      
      if (error) throw error;
      
      toast.success('Gasto aprobado correctamente');
      setSelectedExpense(null);
      setReceiptUrl(null);
      fetchExpenses();
    } catch (error) {
      console.error('[ExpensesPage] Error approving expense:', error);
      toast.error('Error al aprobar el gasto');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectExpense = async () => {
    if (!selectedExpense) return;
    
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('expenses')
        .update({ 
          status: 'REJECTED',
          approver_id: user?.id
        })
        .eq('id', selectedExpense.id);
      
      if (error) throw error;
      
      toast.success('Gasto rechazado');
      setSelectedExpense(null);
      setReceiptUrl(null);
      fetchExpenses();
    } catch (error) {
      console.error('[ExpensesPage] Error rejecting expense:', error);
      toast.error('Error al rechazar el gasto');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    setSelectedExpense(expense);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteExpense = async () => {
    if (!selectedExpense || !membership?.company_id) return;

    setActionLoading(true);
    const isOwnerOrCompanyAdmin = membership.role === "owner" || membership.role === "company_admin";

    if (isOwnerOrCompanyAdmin) {
      // Eliminación directa
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", selectedExpense.id);

      if (error) {
        console.error('[ExpensesPage] Error deleting expense:', error);
        toast.error("Error al eliminar el gasto");
      } else {
        toast.success("Gasto eliminado correctamente");
        fetchExpenses();
      }
    } else {
      // Crear solicitud de eliminación para department_admin
      const { error } = await supabase
        .from("expense_deletion_requests")
        .insert({
          expense_id: selectedExpense.id,
          company_id: membership.company_id,
          requested_by: user?.id,
          reason: deleteReason
        });

      if (error) {
        console.error('[ExpensesPage] Error creating deletion request:', error);
        toast.error("Error al crear la solicitud de eliminación");
      } else {
        toast.success("Solicitud de eliminación enviada para aprobación");
      }
    }

    setActionLoading(false);
    setDeleteDialogOpen(false);
    setDeleteReason("");
    setSelectedExpense(null);
  };

  const monthlyLimit = isMaster ? null : company?.monthly_expense_limit ?? planMonthlyLimitMap[planKey];
  const currentMonthUsage = expenses.filter(expense => {
    const date = new Date(expense.expense_date);
    const now = new Date();
    return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
  }).length;
  const remainingExpenses = typeof monthlyLimit === 'number' ? Math.max(monthlyLimit - currentMonthUsage, 0) : null;

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando gastos...</p>
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
            <h2 className="text-3xl font-bold mb-2">Gestión de Gastos</h2>
            <p className="text-muted-foreground">
              Administra y revisa todos los gastos registrados
            </p>
            {typeof monthlyLimit === 'number' && (
              <p className={`text-sm mt-1 ${remainingExpenses === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                Límite mensual: {currentMonthUsage}/{monthlyLimit} gastos registrados este mes
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button className="bg-gradient-primary hover:opacity-90 gap-2" onClick={() => window.location.href = '/upload'}>
              <FileText className="h-4 w-4" />
              Nuevo Gasto
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-gradient-card border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por proveedor, categoría o empleado..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="PENDING">Pendientes</SelectItem>
                    <SelectItem value="APPROVED">Aprobados</SelectItem>
                    <SelectItem value="REJECTED">Rechazados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenses List */}
        <Card className="bg-gradient-card border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Gastos ({filteredExpenses.length})
            </CardTitle>
            <CardDescription>
              Lista completa de gastos registrados en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredExpenses.length > 0 ? (
              <div className="space-y-4">
                {filteredExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-4 bg-background/50 rounded-lg border hover:bg-background/70 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold">{expense.vendor}</h4>
                        {getStatusBadge(expense.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          <span>{expense.categories?.name || 'Sin categoría'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(expense.expense_date).toLocaleDateString('es-ES')}</span>
                        </div>
                        {(isMaster || membership?.role === 'owner' || membership?.role === 'company_admin' || membership?.role === 'global_admin') && expense.profiles && (
                          <div className="flex items-center gap-1">
                            <span>👤</span>
                            <span>{expense.profiles.name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span>💳</span>
                          <span>{expense.payment_method}</span>
                        </div>
                      </div>
                      {expense.notes && (
                        <p className="text-sm text-muted-foreground mt-2 italic">"{expense.notes}"</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg flex items-center gap-1">
                        <Euro className="h-4 w-4" />
                        {formatCurrency(expense.amount_gross)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Neto: {formatCurrency(expense.amount_net)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        IVA: {formatCurrency(expense.tax_vat || 0)}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewExpense(expense)}
                          className="gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          Ver
                        </Button>
                        {canManageExpenses && expense.status === 'PENDING' && expense.employee_id !== user?.id && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleViewExpense(expense)}
                              className="gap-1 bg-green-600 hover:bg-green-700"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={async () => {
                                setSelectedExpense(expense);
                                await handleRejectExpense();
                              }}
                              className="gap-1"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {canManageExpenses && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteExpense(expense)}
                            disabled={actionLoading}
                            className="gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No hay gastos</h3>
                <p className="mb-4">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'No se encontraron gastos con los filtros aplicados'
                    : 'No hay gastos registrados aún'
                  }
                </p>
                <Button className="bg-gradient-primary hover:opacity-90" onClick={() => window.location.href = '/upload'}>
                  <FileText className="mr-2 h-4 w-4" />
                  Registrar Primer Gasto
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diálogo de detalles del gasto */}
        <Dialog open={!!selectedExpense} onOpenChange={() => {
          setSelectedExpense(null);
          setReceiptUrl(null);
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detalles del Gasto
              </DialogTitle>
              <DialogDescription>
                Información completa y documento adjunto
              </DialogDescription>
            </DialogHeader>

            {selectedExpense && (
              <div className="space-y-4">
                {/* Estado */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <span className="font-medium">Estado</span>
                  {getStatusBadge(selectedExpense.status)}
                </div>

                {/* Información del gasto */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Proveedor</label>
                    <p className="text-lg font-semibold">{selectedExpense.vendor}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tipo</label>
                    <p className="text-lg">{selectedExpense.doc_type === 'invoice' ? '🧾 Factura' : '🎫 Ticket'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Fecha</label>
                    <p className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(selectedExpense.expense_date).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Categoría</label>
                    <p>{selectedExpense.categories?.name || 'Sin categoría'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Método de pago</label>
                    <p>💳 {selectedExpense.payment_method}</p>
                  </div>
                  {selectedExpense.profiles && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Empleado</label>
                      <p>👤 {selectedExpense.profiles.name}</p>
                    </div>
                  )}
                </div>

                {/* Importes */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base imponible</span>
                    <span className="font-medium">{formatCurrency(selectedExpense.amount_net)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IVA</span>
                    <span className="font-medium">{formatCurrency(selectedExpense.tax_vat || 0)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total</span>
                    <span className="flex items-center gap-1">
                      <Euro className="h-5 w-5" />
                      {formatCurrency(selectedExpense.amount_gross)}
                    </span>
                  </div>
                </div>

                {/* Notas */}
                {selectedExpense.notes && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Notas</label>
                    <p className="p-3 bg-muted/50 rounded-lg italic">"{selectedExpense.notes}"</p>
                  </div>
                )}

                {/* Documento adjunto */}
                {(receiptUrl || selectedExpense?.dropbox_url) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-muted-foreground">Documento adjunto</label>
                      <div className="flex gap-2 flex-wrap">
                        {receiptUrl && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = receiptUrl;
                                link.download = `recibo-${selectedExpense?.vendor || 'documento'}.jpg`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              className="gap-1"
                            >
                              <Download className="h-3 w-3" />
                              Descargar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(receiptUrl, '_blank')}
                              className="gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Abrir en nueva pestaña
                            </Button>
                          </>
                        )}
                        {selectedExpense?.dropbox_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(selectedExpense.dropbox_url || '', '_blank')}
                            className="gap-1 bg-[#0061FF] hover:bg-[#0061FF]/90 text-white border-[#0061FF]"
                          >
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z"/>
                            </svg>
                            Ver en Dropbox
                          </Button>
                        )}
                      </div>
                    </div>
                    {selectedExpense?.dropbox_path && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z"/>
                        </svg>
                        <span>{selectedExpense.dropbox_path}</span>
                      </div>
                    )}
                    {receiptUrl && (
                      <div className="border rounded-lg overflow-hidden bg-muted/20">
                        <img 
                          src={receiptUrl} 
                          alt="Documento del gasto" 
                          className="w-full h-auto max-h-96 object-contain"
                          onError={(e) => {
                            // Si falla la carga, mostrar un placeholder
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = '<div class="flex flex-col items-center justify-center p-12 text-muted-foreground"><FileText class="h-16 w-16 mb-2" /><p>No se pudo cargar la vista previa</p></div>';
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {canManageExpenses && selectedExpense?.status === 'PENDING' && selectedExpense.employee_id !== user?.id && (
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedExpense(null);
                    setReceiptUrl(null);
                  }}
                  disabled={actionLoading}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRejectExpense}
                  disabled={actionLoading}
                  className="gap-1"
                >
                  <X className="h-4 w-4" />
                  Rechazar
                </Button>
                <Button
                  onClick={handleApproveExpense}
                  disabled={actionLoading}
                  className="gap-1 bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4" />
                  Aprobar Gasto
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmación de eliminación */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                {membership?.role === "owner" || membership?.role === "company_admin" 
                  ? "Confirmar eliminación"
                  : "Solicitar eliminación"}
              </DialogTitle>
              <DialogDescription>
                {membership?.role === "owner" || membership?.role === "company_admin"
                  ? "Esta acción eliminará el gasto permanentemente y no se puede deshacer."
                  : "Esta solicitud será enviada al administrador para su aprobación."}
              </DialogDescription>
            </DialogHeader>
            
            {selectedExpense && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium">{selectedExpense.vendor}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(selectedExpense.amount_gross)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delete-reason">
                    {membership?.role === "department_admin" ? "Motivo de la solicitud *" : "Motivo (opcional)"}
                  </Label>
                  <Textarea
                    id="delete-reason"
                    placeholder="Explica por qué se debe eliminar este gasto..."
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeleteReason("");
                  setSelectedExpense(null);
                }}
                disabled={actionLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteExpense}
                disabled={actionLoading || (membership?.role === "department_admin" && !deleteReason.trim())}
              >
                {actionLoading ? "Procesando..." : 
                  membership?.role === "owner" || membership?.role === "company_admin" 
                    ? "Eliminar gasto" 
                    : "Enviar solicitud"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
