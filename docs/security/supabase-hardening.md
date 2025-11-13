# Supabase Security Hardening

This project now ships with repeatable migration and tooling to keep the Supabase project aligned with the security guidance that surfaced in the dashboard.

## Leaked password protection (HIBP)

1. Apply the migration `supabase/migrations/20250923120000_enable_hibp_and_version_helpers.sql` using `supabase db push` (or your existing deployment workflow). It enables the HaveIBeenPwned leaked password protection flag directly inside `auth.config` when that table is available in the project (Supabase hosted projects expose it; self-hosted forks might not).
2. Verify the status from your workstation by exporting the Supabase environment values (or relying on `.env`) and running:
   ```bash
   node scripts/security-status.js
   ```
   The script calls the new `public.is_leaked_password_protection_enabled()` helper and prints `ENABLED` once the migration is live.
3. If the flag remains disabled, double‑check that the migration ran against the correct project and that the service role key you are using has admin access. Manual toggling in the Supabase dashboard is still possible under **Authentication → Passwords**.

## Postgres patch upgrades

1. Use the same `node scripts/security-status.js` command to read the exact Postgres build returned by the `public.current_postgres_version()` helper. This function was added so the version can be monitored without opening a SQL editor in production.
2. Compare the reported version with the release notes at [Supabase Postgres upgrades](https://supabase.com/docs/guides/platform/upgrading). The security warning references `supabase-postgres-17.4.1.075`; look for a newer `17.x` patch and review the change log.
3. Schedule the upgrade from the Supabase dashboard (**Project Settings → Database → Upgrades**) or, for self‑hosted environments, follow the documented procedure linked above. Plan a small maintenance window, take a backup, and perform the upgrade in a staging project first.
4. After the upgrade completes, rerun `node scripts/security-status.js` to confirm the reported Postgres version matches the expected patched build.

Keeping the script and functions in the repo means future checks stay automated and auditable in source control.

## Inactive profile isolation

* Migration `supabase/migrations/20251015103000_enforce_get_account_id_active_profiles.sql` now restricts `public.get_account_id()` to return an account only when the latest profile is `ACTIVE`. This keeps row level security policies such as those on `profiles`, `expenses`, `files`, and `accounts` from granting access to users who have been deactivated in the UI.
* After disabling an employee from the admin panel, you can confirm the revocation from SQL by running:
  ```sql
  select public.get_account_id('<user-id>');
  ```
  The function will now yield `NULL` for inactive users, matching the behaviour enforced by the RLS policies.
