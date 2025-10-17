-- Actualizar el rol de Paula Paños a administradora de departamento
-- Primero asignarle el departamento de Marketing
UPDATE memberships 
SET department_id = '6be538bf-ee94-4319-a9d6-be3662438871',
    role = 'department_admin'
WHERE user_id = '066d678d-6cf7-4395-8dcb-6560a404bb12' 
  AND company_id = '70bdbd35-80fd-4c6f-ad00-7089325b7f09';