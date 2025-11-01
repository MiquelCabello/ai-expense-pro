-- Eliminar el constraint restrictivo y crear uno nuevo que permita DEPARTMENT_ADMIN
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role = ANY (ARRAY['ADMIN'::user_role, 'EMPLOYEE'::user_role, 'DEPARTMENT_ADMIN'::user_role]));

-- Ahora corregir el rol de Paula Paños a DEPARTMENT_ADMIN
UPDATE profiles 
SET role = 'DEPARTMENT_ADMIN'
WHERE user_id = '066d678d-6cf7-4395-8dcb-6560a404bb12';

-- Actualizar también las invitaciones pendientes
UPDATE invitations
SET role = 'DEPARTMENT_ADMIN'
WHERE email = 'elartedelosencillo@gmail.com' 
  AND used_at IS NULL;