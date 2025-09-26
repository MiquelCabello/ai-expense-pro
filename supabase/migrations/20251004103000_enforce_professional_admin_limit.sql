-- Enforce a maximum of two active administrators for Professional plans when role assignment is enabled
set check_function_bodies = off;

drop trigger if exists enforce_professional_admin_cap_insert on public.profiles;
drop trigger if exists enforce_professional_admin_cap_update on public.profiles;
drop function if exists public.enforce_professional_admin_cap();

create function public.enforce_professional_admin_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_account_id uuid;
  target_plan text;
  target_can_assign_roles boolean;
  active_admins integer;
begin
  target_account_id := coalesce(new.account_id, old.account_id);

  if target_account_id is null then
    return new;
  end if;

  select plan, can_assign_roles
  into target_plan, target_can_assign_roles
  from public.accounts
  where id = target_account_id;

  if target_plan is distinct from 'PROFESSIONAL' then
    return new;
  end if;

  if coalesce(target_can_assign_roles, false) = false then
    return new;
  end if;

  if coalesce(new.status, old.status) is distinct from 'ACTIVE' then
    return new;
  end if;

  if coalesce(new.role, old.role) is distinct from 'ADMIN' then
    return new;
  end if;

  select count(*)
  into active_admins
  from public.profiles
  where account_id = target_account_id
    and status = 'ACTIVE'
    and role = 'ADMIN'
    and id <> coalesce(new.id, old.id);

  if active_admins >= 2 then
    raise exception using message = 'ADMIN_LIMIT_REACHED';
  end if;

  return new;
end;
$$;

create trigger enforce_professional_admin_cap_insert
before insert on public.profiles
for each row
when (new.role = 'ADMIN' and new.status = 'ACTIVE')
execute function public.enforce_professional_admin_cap();

create trigger enforce_professional_admin_cap_update
before update on public.profiles
for each row
when ((coalesce(new.role, old.role) = 'ADMIN') and (coalesce(new.status, old.status) = 'ACTIVE'))
execute function public.enforce_professional_admin_cap();
