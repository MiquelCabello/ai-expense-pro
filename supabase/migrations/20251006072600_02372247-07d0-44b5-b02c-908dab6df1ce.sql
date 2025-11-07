-- Corregir el perfil de Paula Paños (miquelfx@gmail.com)
-- Debe tener rol EMPLOYEE y estar asociada a la cuenta de infosanjo1b@gmail.com

UPDATE public.profiles
SET 
  role = 'EMPLOYEE'::user_role,
  account_id = '814127c6-3835-4569-8f0f-1259c45a23aa',
  updated_at = now()
WHERE user_id = 'eb6395d9-6ea2-4d48-b5d4-263252b03a62';

-- Verificar que el profile se actualizó correctamente
DO $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT role, account_id, name INTO v_profile
  FROM public.profiles
  WHERE user_id = 'eb6395d9-6ea2-4d48-b5d4-263252b03a62';
  
  RAISE NOTICE 'Profile actualizado: role=%, account_id=%, name=%', 
    v_profile.role, v_profile.account_id, v_profile.name;
END $$;