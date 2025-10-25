import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthV2 } from '@/hooks/useAuthV2';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { 
  Users, 
  UserPlus, 
  Search, 
  Mail,
  MapPin,
  Briefcase,
  MoreHorizontal,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';

interface Employee {
  id: string;
  user_id: string;
  email: string;
  role: 'owner' | 'company_admin' | 'department_admin' | 'employee';
  department_id?: string | null;
  created_at: string;
  company_id: string;
}

interface Department {
  id: string;
  name: string;
  company_id: string;
}

export default function EmployeesPage() {
  const { membership, company, isMaster, user } = useAuthV2();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    role: 'employee' as 'owner' | 'company_admin' | 'department_admin' | 'employee',
    department: '',
    country: '',
    city: '',
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [showInvitationDialog, setShowInvitationDialog] = useState(false);

  const accountId = company?.id ?? null;
  const maxEmployees = company?.max_employees ?? null;
  const canAssignRoles = true; // Always allow assigning roles in new system
  const canAssignDepartment = company?.plan === 'enterprise'; // Solo enterprise puede asignar departamentos
  const canAssignRegion = false; // Deprecated in new system
  const planLabel = company?.plan ?? 'free';
  const planNameMap: Record<string, string> = { free: 'Starter', pro: 'Professional', enterprise: 'Enterprise' };
  const planName = planNameMap[planLabel] ?? planLabel;
  const activeEmployeesCount = employees.length; // All memberships are active by default
  const isAtEmployeeLimit = typeof maxEmployees === 'number' && activeEmployeesCount >= maxEmployees;

  // Determinar si el usuario es administrador (cualquier tipo)
  const isAdmin = isMaster || 
    membership?.role === 'owner' || 
    membership?.role === 'company_admin' || 
    membership?.role === 'department_admin';
  
  // Determinar el tipo de administrador
  const isDepartmentAdmin = membership?.role === 'department_admin';
  const isGlobalAdmin = membership?.role === 'company_admin' || 
                        membership?.role === 'owner' ||
                        isMaster;

  useEffect(() => {
    setNewEmployee(prev => ({
      ...prev,
      role: canAssignRoles ? prev.role : 'employee',
      department: canAssignDepartment ? prev.department : ''
    }));
  }, [canAssignRoles, canAssignDepartment]);

  const fetchEmployees = useCallback(async () => {
    if (!accountId) {
      setEmployees([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Use RPC function to get employees with profile info
      const { data, error } = await supabase
        .rpc('get_company_employees', { p_company_id: accountId });

      if (error) throw error;

      // Filter employees based on role
      let filteredData = data ?? [];

      // Excluir al owner de la lista
      if (company?.owner_user_id) {
        filteredData = filteredData.filter((emp: any) => emp.user_id !== company.owner_user_id);
      }
      
      // Excluir al usuario actual si es department_admin (no debe verse a sí mismo)
      if (isDepartmentAdmin && user?.id) {
        filteredData = filteredData.filter((emp: any) => emp.user_id !== user.id);
      }

      // Si es admin de departamento, solo ver empleados de su departamento
      if (isDepartmentAdmin && membership?.department_id) {
        filteredData = filteredData.filter((emp: any) => emp.department_id === membership.department_id);
      }

      // Transform to Employee format
      const resolvedEmployees: Employee[] = filteredData.map((emp: any) => ({
        id: emp.user_id,
        user_id: emp.user_id,
        email: emp.email || 'Sin email',
        role: emp.role,
        department_id: emp.department_id,
        created_at: emp.created_at,
        company_id: emp.company_id,
      }));

      setEmployees(resolvedEmployees);
    } catch (error) {
      console.error('[Employees] fetch failed', error);
      toast.error('Error cargando empleados');
    } finally {
      setLoading(false);
    }
  }, [accountId, isDepartmentAdmin, membership?.department_id, company?.owner_user_id, user?.id]);

  const fetchDepartments = useCallback(async () => {
    if (!accountId || !canAssignDepartment) {
      setDepartments([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('company_id', accountId)
        .order('name');

      if (error) throw error;

      setDepartments(data ?? []);
    } catch (error) {
      console.error('[Employees] fetch departments failed', error);
      toast.error('Error cargando departamentos');
    }
  }, [accountId, canAssignDepartment]);

  useEffect(() => {
    if (isAdmin) {
      fetchEmployees();
      fetchDepartments();
    }
  }, [isAdmin, accountId, fetchEmployees, fetchDepartments]);


  const handleCreateEmployee = async () => {
    if (!accountId || !isGlobalAdmin) {
      toast.error('No tienes permisos para crear empleados');
      return;
    }

    if (!newEmployee.name.trim()) {
      toast.error('El nombre del empleado es obligatorio');
      return;
    }

    const email = newEmployee.email.trim();
    const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;
    if (!emailRegex.test(email)) {
      toast.error('Introduce un correo electrónico válido');
      return;
    }

    if (isAtEmployeeLimit) {
      toast.error('Has alcanzado el número máximo de usuarios para tu plan');
      return;
    }

    try {
      const sanitizedRole = canAssignRoles ? newEmployee.role : 'employee';
      const sanitizedDepartment = canAssignDepartment ? newEmployee.department.trim() : '';

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('SESSION_NOT_FOUND');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          name: newEmployee.name.trim(),
          email,
          role: sanitizedRole,
          department: canAssignDepartment ? sanitizedDepartment || null : null,
          country: newEmployee.country.trim() || null,
          city: newEmployee.city.trim() || null,
          companyId: accountId
        })
      });

      if (!response.ok) {
        let message = 'Error creando empleado';
        try {
          const payload = await response.json();
          message = payload?.message || payload?.error || message;
        } catch {}
        throw new Error(message);
      }

      const result = await response.json();
      
      // Show invitation URL
      if (result.invitation_url) {
        setInvitationUrl(result.invitation_url);
        setShowInvitationDialog(true);
      }

      toast.success('Invitación creada exitosamente');
      setIsCreateDialogOpen(false);
      setNewEmployee({
        name: '',
        email: '',
        role: 'employee',
        department: '',
        country: '',
        city: '',
      });
      fetchEmployees();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error creando empleado';
      toast.error(message === 'EMPLOYEE_LIMIT_REACHED' ? 'Has alcanzado el número máximo de usuarios para tu plan' : message);
    }
  };

  // Status functionality removed - memberships don't have status field
  // All memberships are considered active

  const handleOpenEditDialog = (employee: Employee) => {
    setEditingEmployee(employee);
    setEditForm({
      name: employee.email, // Use email as name
      newPassword: '',
      confirmPassword: ''
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee || !accountId) return;

    if (!editForm.name.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    if (editForm.newPassword && editForm.newPassword !== editForm.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (editForm.newPassword && editForm.newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-employee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          action: 'update',
          employeeUserId: editingEmployee.user_id,
          name: editForm.name.trim(),
          password: editForm.newPassword || undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error actualizando empleado');
      }

      toast.success('Empleado actualizado correctamente');
      setIsEditDialogOpen(false);
      setEditingEmployee(null);
      fetchEmployees();
    } catch (error) {
      console.error('Error updating employee:', error);
      toast.error(error instanceof Error ? error.message : 'Error actualizando empleado');
    }
  };

  const handleDeleteEmployee = async () => {
    if (!editingEmployee || !accountId) return;

    if (!confirm(`¿Estás seguro de que quieres eliminar a ${editingEmployee.email}? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-employee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          action: 'delete',
          employeeUserId: editingEmployee.user_id
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error eliminando empleado');
      }

      toast.success('Empleado eliminado correctamente');
      setIsEditDialogOpen(false);
      setEditingEmployee(null);
      fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error(error instanceof Error ? error.message : 'Error eliminando empleado');
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'owner') {
      return (
        <Badge variant="default" className="gap-1 bg-gradient-primary">
          <UserCheck className="h-3 w-3" />
          Propietario
        </Badge>
      );
    }
    if (role === 'company_admin') {
      return (
        <Badge variant="default" className="gap-1">
          <UserCheck className="h-3 w-3" />
          Admin Global
        </Badge>
      );
    }
    if (role === 'department_admin') {
      return (
        <Badge variant="outline" className="gap-1 border-primary text-primary">
          <Briefcase className="h-3 w-3" />
          Admin Departamento
        </Badge>
      );
    }
    if (role === 'global_admin') {
      return (
        <Badge variant="default" className="gap-1 bg-gradient-primary">
          <UserCheck className="h-3 w-3" />
          Admin Sistema
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <Users className="h-3 w-3" />
        Empleado
      </Badge>
    );
  };


  const filteredEmployees = employees.filter(employee => {
    const searchLower = searchTerm.toLowerCase();
    const emailMatch = employee.email.toLowerCase().includes(searchLower);
    
    // Find department name if department_id exists
    let departmentName = '';
    if (employee.department_id) {
      const dept = departments.find(d => d.id === employee.department_id);
      departmentName = dept?.name ?? '';
    }
    
    const departmentMatch = departmentName.toLowerCase().includes(searchLower);
    
    return emailMatch || departmentMatch;
  });

  // Check if current user is admin (cualquier tipo)
  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">Acceso Restringido</h3>
            <p className="text-muted-foreground">
              Solo los administradores pueden acceder a la gestión de empleados.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando empleados...</p>
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
            <h2 className="text-3xl font-bold mb-2">
              {isDepartmentAdmin ? 'Empleados de mi Departamento' : 'Gestión de Empleados'}
            </h2>
            <p className="text-muted-foreground">
              {isDepartmentAdmin 
                ? 'Visualiza los empleados de tu departamento' 
                : 'Administra usuarios y permisos del sistema'}
            </p>
            {/* Solo mostrar información de planes a global admins */}
            {isGlobalAdmin && maxEmployees && (
              <p className={`text-sm mt-1 ${isAtEmployeeLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                Plan {planName} · {maxEmployees ? `${activeEmployeesCount}/${maxEmployees} usuarios activos` : `${activeEmployeesCount} usuarios activos`}
              </p>
            )}
          </div>
          {/* Solo administradores globales pueden crear empleados */}
          {isGlobalAdmin && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="bg-gradient-primary hover:opacity-90 gap-2"
                  disabled={isAtEmployeeLimit}
                  title={isAtEmployeeLimit ? 'Has alcanzado el límite de usuarios de tu plan' : undefined}
                >
                  <UserPlus className="h-4 w-4" />
                  Nuevo Empleado
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Empleado</DialogTitle>
                <DialogDescription>
                  Agrega un nuevo empleado al sistema
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo *</Label>
                  <Input
                    id="name"
                    placeholder="Juan Pérez"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="juan@empresa.com"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  />
                </div>

                {canAssignRoles && (
                  <div className="space-y-2">
                    <Label htmlFor="role">Rol *</Label>
                    <Select
                      value={newEmployee.role}
                      onValueChange={(value: any) => setNewEmployee({ ...newEmployee, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Empleado</SelectItem>
                        <SelectItem value="department_admin">Admin de Departamento</SelectItem>
                        <SelectItem value="company_admin">Admin Global</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {canAssignDepartment && (
                  <div className="space-y-2">
                    <Label htmlFor="department">Departamento</Label>
                    <Select
                      value={newEmployee.department}
                      onValueChange={(value) => setNewEmployee({ ...newEmployee, department: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un departamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sin departamento</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.name}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="country">País</Label>
                  <Input
                    id="country"
                    placeholder="España"
                    value={newEmployee.country}
                    onChange={(e) => setNewEmployee({ ...newEmployee, country: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad</Label>
                  <Input
                    id="city"
                    placeholder="Barcelona"
                    value={newEmployee.city}
                    onChange={(e) => setNewEmployee({ ...newEmployee, city: e.target.value })}
                  />
                </div>

                {(!canAssignRoles || !canAssignDepartment) && (
                  <p className="text-xs text-muted-foreground">
                    {!canAssignRoles && "• No puedes asignar roles personalizados. "}
                    {!canAssignDepartment && "• Los departamentos solo están disponibles en el plan Enterprise. "}
                    Los empleados recibirán acceso estándar.
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateEmployee} className="bg-gradient-primary hover:opacity-90">
                    Crear Empleado
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>
        {isAtEmployeeLimit && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Has alcanzado el máximo de usuarios incluidos en tu plan {planName}. Actualiza de plan para invitar a más empleados.
          </div>
        )}

        {/* Search */}
        <Card className="bg-gradient-card border-0 shadow-md">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empleados por nombre, departamento o región..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Employees List */}
        <Card className="bg-gradient-card border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Empleados ({filteredEmployees.length})
            </CardTitle>
            <CardDescription>
              Lista completa de usuarios registrados en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredEmployees.length > 0 ? (
              <div className="space-y-4">
                {filteredEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between p-4 bg-background/50 rounded-lg border hover:bg-background/70 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold">{employee.email}</h4>
                        {getRoleBadge(employee.role)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {employee.department_id && (() => {
                          const dept = departments.find(d => d.id === employee.department_id);
                          return dept && (
                            <div className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              <span>{dept.name}</span>
                            </div>
                          );
                        })()}
                        <div className="flex items-center gap-1">
                          <span>📅</span>
                          <span>Registrado: {new Date(employee.created_at).toLocaleDateString('es-ES')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditDialog(employee)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">
                  {searchTerm ? 'No se encontraron empleados' : 'No hay empleados registrados'}
                </h3>
                <p className="mb-4">
                  {searchTerm 
                    ? 'Intenta con otros términos de búsqueda'
                    : 'Agrega el primer empleado al sistema'
                  }
                </p>
                {!searchTerm && (
                  <Button 
                    className="bg-gradient-primary hover:opacity-90"
                    onClick={() => setIsCreateDialogOpen(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Agregar Primer Empleado
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Employee Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Empleado</DialogTitle>
              <DialogDescription>
                Modifica los datos de {editingEmployee?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre Completo</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Nombre del empleado"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">Nueva Contraseña (opcional)</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                  placeholder="Dejar vacío para mantener la actual"
                />
              </div>
              {editForm.newPassword && (
                <div className="space-y-2">
                  <Label htmlFor="edit-confirm-password">Confirmar Nueva Contraseña</Label>
                  <Input
                    id="edit-confirm-password"
                    type="password"
                    value={editForm.confirmPassword}
                    onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                    placeholder="Confirmar contraseña"
                  />
                </div>
              )}
              <div className="flex justify-between gap-2 pt-4">
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteEmployee}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdateEmployee} className="bg-gradient-primary hover:opacity-90">
                    Guardar Cambios
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Invitation URL Dialog */}
        <Dialog open={showInvitationDialog} onOpenChange={setShowInvitationDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Link de Invitación Generado</DialogTitle>
              <DialogDescription>
                Copia este enlace y envíalo al nuevo empleado. El enlace no expira hasta que el usuario establezca su contraseña.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Input
                  readOnly
                  value={invitationUrl || ''}
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (invitationUrl) {
                      navigator.clipboard.writeText(invitationUrl);
                      toast.success('Link copiado al portapapeles');
                    }
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>El empleado podrá usar este enlace para crear su contraseña y acceder a la plataforma.</p>
              </div>
              <Button
                onClick={() => {
                  setShowInvitationDialog(false);
                  setInvitationUrl(null);
                }}
                className="w-full"
              >
                Cerrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
