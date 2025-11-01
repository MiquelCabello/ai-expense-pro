-- Actualizar cuenta de infosanjo1b@gmail.com a ENTERPRISE
UPDATE accounts 
SET plan = 'ENTERPRISE'
WHERE id = '814127c6-3835-4569-8f0f-1259c45a23aa';

-- También actualizar en el nuevo sistema (companies)
UPDATE companies
SET plan = 'enterprise'
WHERE migrated_from_account_id = '814127c6-3835-4569-8f0f-1259c45a23aa';