# QA Manual: Límites de administradores por plan

## Requisitos previos
- Workspace con la última versión de la aplicación desplegada.
- Acceso a Supabase con privilegios para modificar cuentas y perfiles.
- Dos cuentas de correo de prueba para aceptar invitaciones.

## Plan Professional
1. **Invitación del primer administrador**
   - Configura una cuenta en el plan Professional con `can_assign_roles = true`.
   - Inicia sesión como administrador activo.
   - Invita a un nuevo usuario seleccionando el rol **Administrador**.
   - Verifica que la invitación se envía correctamente y que el nuevo perfil queda registrado como `ADMIN` y `ACTIVE` tras aceptar.
2. **Invitación del segundo administrador**
   - Repite el proceso de invitación con una segunda dirección de correo.
   - Confirma que la invitación se procesa con éxito y que el conteo de administradores activos pasa a 2/2.
3. **Bloqueo del tercer administrador**
   - Intenta invitar a un tercer administrador.
   - Comprueba que la interfaz muestra el mensaje de cupo agotado y que la Edge Function responde con `ADMIN_LIMIT_REACHED`.
   - Verifica en la base de datos que no se insertó un nuevo perfil `ADMIN`.
4. **Liberación de cupo**
   - Desactiva (`status = 'INACTIVE'`) uno de los administradores existentes.
   - Invita nuevamente a un administrador y valida que ahora sí se permite la operación.
   - Reactiva al administrador inactivo para asegurarte de que no se excede el límite.

## Plan Enterprise
1. **Invitaciones ilimitadas**
   - Cambia la cuenta a plan Enterprise o utiliza la cuenta Enterprise por defecto.
   - Invita al menos a tres usuarios como administradores.
   - Confirma que todas las invitaciones se crean correctamente y que los perfiles quedan con `role = 'ADMIN'` y `status = 'ACTIVE'`.
2. **Validación de interfaz**
   - Abre el modal de creación de empleado y verifica que el selector de roles aparece siempre disponible.
   - Comprueba que no se muestran mensajes de cupo limitado.

## Reglas de la base de datos
- Intenta insertar manualmente un tercer administrador activo en la tabla `profiles` para una cuenta Professional.
- Asegúrate de que el trigger `enforce_professional_admin_cap` rechaza la operación con el error `ADMIN_LIMIT_REACHED`.

## Reversión / Limpieza
- Revierte cualquier cambio manual en la base de datos realizado durante la prueba.
- Elimina o desactiva las cuentas de prueba creadas.
