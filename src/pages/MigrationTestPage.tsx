import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { AuthV2Provider, useAuthV2 } from '@/hooks/useAuthV2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, Database, DatabaseBackup } from 'lucide-react';

function ComparisonContent() {
  // Sistema antiguo
  const oldSystem = useAuth();

  return (
    <AuthV2Provider>
      <ComparisonView oldSystem={oldSystem} />
    </AuthV2Provider>
  );
}

function ComparisonView({ oldSystem }: { oldSystem: ReturnType<typeof useAuth> }) {
  // Sistema nuevo
  const newSystem = useAuthV2();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test de Migración</h1>
          <p className="text-muted-foreground">
            Comparación entre sistema antiguo y nuevo
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
        {/* Sistema Antiguo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseBackup className="h-5 w-5" />
              Sistema Legacy (Actual)
            </CardTitle>
            <CardDescription>
              Tablas: accounts, profiles, user_roles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Estado</h4>
              <Badge variant={oldSystem.loading ? "secondary" : "default"}>
                {oldSystem.loading ? "Cargando..." : "Cargado"}
              </Badge>
            </div>

            {!oldSystem.loading && (
              <>
                <Separator />
                
                <div>
                  <h4 className="text-sm font-semibold mb-2">Usuario</h4>
                  <p className="text-sm text-muted-foreground">
                    {oldSystem.user?.email ?? 'N/A'}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Perfil</h4>
                  {oldSystem.profile ? (
                    <div className="space-y-1 text-sm">
                      <p><strong>Nombre:</strong> {oldSystem.profile.name}</p>
                      <p><strong>Rol:</strong> {oldSystem.profile.role}</p>
                      <p><strong>Estado:</strong> {oldSystem.profile.status}</p>
                      <p><strong>Account ID:</strong> {oldSystem.profile.account_id ?? 'N/A'}</p>
                    </div>
                  ) : (
                    <Badge variant="destructive">No encontrado</Badge>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Cuenta</h4>
                  {oldSystem.account ? (
                    <div className="space-y-1 text-sm">
                      <p><strong>Nombre:</strong> {oldSystem.account.name}</p>
                      <p><strong>Plan:</strong> {oldSystem.account.plan}</p>
                      <p><strong>Max empleados:</strong> {oldSystem.account.max_employees ?? 'Ilimitado'}</p>
                    </div>
                  ) : (
                    <Badge variant="destructive">No encontrado</Badge>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Es Master</h4>
                  {oldSystem.isMaster ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle className="h-3 w-3" /> Sí
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <XCircle className="h-3 w-3" /> No
                    </Badge>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sistema Nuevo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Sistema Nuevo (Migración)
            </CardTitle>
            <CardDescription>
              Tablas: companies, memberships, profiles_v2
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Estado</h4>
              <div className="flex gap-2">
                <Badge variant={newSystem.loading ? "secondary" : "default"}>
                  {newSystem.loading ? "Cargando..." : "Cargado"}
                </Badge>
                <Badge variant={newSystem.usingNewSystem ? "default" : "secondary"}>
                  {newSystem.usingNewSystem ? "Datos del nuevo sistema" : "Fallback a legacy"}
                </Badge>
              </div>
            </div>

            {!newSystem.loading && (
              <>
                <Separator />
                
                <div>
                  <h4 className="text-sm font-semibold mb-2">Usuario</h4>
                  <p className="text-sm text-muted-foreground">
                    {newSystem.user?.email ?? 'N/A'}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Profile V2</h4>
                  {newSystem.profileV2 ? (
                    <div className="space-y-1 text-sm">
                      <p><strong>Email:</strong> {newSystem.profileV2.email}</p>
                      <p><strong>User ID:</strong> {newSystem.profileV2.user_id.substring(0, 8)}...</p>
                    </div>
                  ) : (
                    <Badge variant="destructive">No encontrado</Badge>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Membership</h4>
                  {newSystem.membership ? (
                    <div className="space-y-1 text-sm">
                      <p><strong>Rol:</strong> {newSystem.membership.role}</p>
                      <p><strong>Company ID:</strong> {newSystem.membership.company_id.substring(0, 8)}...</p>
                      <p><strong>Department ID:</strong> {newSystem.membership.department_id?.substring(0, 8) ?? 'N/A'}</p>
                    </div>
                  ) : (
                    <Badge variant="destructive">No encontrado</Badge>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Company</h4>
                  {newSystem.company ? (
                    <div className="space-y-1 text-sm">
                      <p><strong>Nombre:</strong> {newSystem.company.name}</p>
                      <p><strong>Plan:</strong> {newSystem.company.plan}</p>
                      <p><strong>Max empleados:</strong> {newSystem.company.max_employees ?? 'Ilimitado'}</p>
                    </div>
                  ) : (
                    <Badge variant="destructive">No encontrado</Badge>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Es Master</h4>
                  {newSystem.isMaster ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle className="h-3 w-3" /> Sí
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <XCircle className="h-3 w-3" /> No
                    </Badge>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Verificación de consistencia */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Verificación de Consistencia</CardTitle>
          <CardDescription>
            Comparación entre datos del sistema antiguo y nuevo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <ConsistencyCheck
              label="Usuario cargado"
              oldValue={!!oldSystem.user}
              newValue={!!newSystem.user}
            />
            <ConsistencyCheck
              label="Email coincide"
              oldValue={oldSystem.user?.email}
              newValue={newSystem.user?.email}
            />
            <ConsistencyCheck
              label="Es Master"
              oldValue={oldSystem.isMaster}
              newValue={newSystem.isMaster}
            />
            <ConsistencyCheck
              label="Plan de empresa"
              oldValue={oldSystem.account?.plan}
              newValue={newSystem.company?.plan}
              transform={(val) => val?.toLowerCase()}
            />
          </div>
        </CardContent>
      </Card>
      </div>
    </AppLayout>
  );
}

function ConsistencyCheck({ 
  label, 
  oldValue, 
  newValue,
  transform
}: { 
  label: string;
  oldValue: any;
  newValue: any;
  transform?: (val: any) => any;
}) {
  const transformedOld = transform ? transform(oldValue) : oldValue;
  const transformedNew = transform ? transform(newValue) : newValue;
  const matches = transformedOld === transformedNew;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <Badge variant={matches ? "default" : "destructive"} className="gap-1">
          {matches ? (
            <>
              <CheckCircle className="h-3 w-3" />
              Coincide
            </>
          ) : (
            <>
              <XCircle className="h-3 w-3" />
              No coincide
            </>
          )}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Old: {String(oldValue)} | New: {String(newValue)}
        </span>
      </div>
    </div>
  );
}

export default ComparisonContent;
