import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const OWNER_EMAIL = 'info@miquelcabello.com';

const isOwnerEmail = (email?: string | null) => (email ?? '').toLowerCase() === OWNER_EMAIL;

// Tipos del nuevo sistema
export interface Company {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  owner_user_id: string;
  max_employees: number | null;
  monthly_expense_limit: number | null;
  category_limit: number | null;
  global_admin_limit: number | null;
  department_admin_limit: number | null;
}

export interface Membership {
  user_id: string;
  company_id: string;
  role: 'owner' | 'employee' | 'company_admin' | 'department_admin' | 'global_admin';
  department_id: string | null;
  created_at: string;
}

export interface ProfileV2 {
  user_id: string;
  email: string;
}

interface AuthV2ContextType {
  company: Company | null;
  membership: Membership | null;
  user: User | null;
  session: Session | null;
  profileV2: ProfileV2 | null;
  loading: boolean;
  isMaster: boolean;
  signOut: () => Promise<void>;
  
  // Flags para debugging
  usingNewSystem: boolean;
}

const AuthV2Context = createContext<AuthV2ContextType | undefined>(undefined);

export function AuthV2Provider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profileV2, setProfileV2] = useState<ProfileV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingNewSystem, setUsingNewSystem] = useState(false);

  useEffect(() => {
    let mounted = true;

    const clearState = () => {
      if (!mounted) return;
      setCompany(null);
      setMembership(null);
      setProfileV2(null);
      setUsingNewSystem(false);
    };

    const loadNewSystemData = async (currentUser: User) => {
      try {
        // 1. Intentar cargar profile_v2
        const { data: profile, error: profileError } = await supabase
          .from('profiles_v2')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (profileError) {
          console.warn('[AuthV2] No profile_v2 found, falling back to old system');
          return null;
        }

        // 2. Intentar cargar membership + company
        const { data: membershipData, error: membershipError } = await supabase
          .from('memberships')
          .select(`
            *,
            companies (
              id,
              name,
              plan,
              owner_user_id,
              max_employees,
              monthly_expense_limit,
              category_limit,
              global_admin_limit,
              department_admin_limit
            )
          `)
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (membershipError || !membershipData) {
          console.warn('[AuthV2] No membership found, falling back to old system');
          return null;
        }

        // Datos cargados exitosamente del nuevo sistema
        const companyData = (membershipData as any).companies;
        if (!companyData) {
          console.warn('[AuthV2] Membership exists but no company found');
          return null;
        }

        console.log('[AuthV2] Successfully loaded data from new system');
        
        return {
          profileV2: profile,
          membership: {
            user_id: membershipData.user_id,
            company_id: membershipData.company_id,
            role: membershipData.role,
            department_id: membershipData.department_id,
            created_at: membershipData.created_at,
          } as Membership,
          company: companyData as Company,
        };
      } catch (error) {
        console.error('[AuthV2] Error loading new system data:', error);
        return null;
      }
    };

    const loadOldSystemData = async (currentUser: User) => {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select(`
            *,
            accounts (
              id,
              name,
              plan,
              owner_user_id,
              max_employees,
              monthly_expense_limit
            )
          `)
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (profileError || !profile) {
          console.warn('[AuthV2] No profile found in old system');
          return null;
        }

        const accountData = (profile as any).accounts;
        if (!accountData) {
          console.warn('[AuthV2] Profile exists but no account found');
          return null;
        }

        console.log('[AuthV2] Using data from old system (fallback)');

        // Transformar al formato nuevo
        const mappedCompany: Company = {
          id: accountData.id,
          name: accountData.name,
          plan: accountData.plan.toLowerCase() as 'free' | 'pro' | 'enterprise',
          owner_user_id: accountData.owner_user_id,
          max_employees: accountData.max_employees,
          monthly_expense_limit: accountData.monthly_expense_limit,
          category_limit: null,
          global_admin_limit: null,
          department_admin_limit: null,
        };

        const mappedMembership: Membership = {
          user_id: profile.user_id,
          company_id: accountData.id,
          role: profile.role === 'ADMIN' ? 'owner' : 'employee',
          department_id: null,
          created_at: profile.created_at,
        };

        const mappedProfile: ProfileV2 = {
          user_id: currentUser.id,
          email: currentUser.email ?? '',
        };

        return {
          profileV2: mappedProfile,
          membership: mappedMembership,
          company: mappedCompany,
        };
      } catch (error) {
        console.error('[AuthV2] Error loading old system data:', error);
        return null;
      }
    };

    const syncSession = async (nextSession: Session | null) => {
      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      const activeUser = nextSession?.user;
      if (!activeUser) {
        clearState();
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Intentar cargar del nuevo sistema primero
        const newSystemData = await loadNewSystemData(activeUser);

        if (newSystemData) {
          // Usar datos del nuevo sistema
          setProfileV2(newSystemData.profileV2);
          setMembership(newSystemData.membership);
          setCompany(newSystemData.company);
          setUsingNewSystem(true);
        } else {
          // Fallback al sistema antiguo
          const oldSystemData = await loadOldSystemData(activeUser);

          if (oldSystemData) {
            setProfileV2(oldSystemData.profileV2);
            setMembership(oldSystemData.membership);
            setCompany(oldSystemData.company);
            setUsingNewSystem(false);
          } else {
            // No hay datos en ningún sistema
            clearState();
          }
        }
      } catch (error) {
        console.error('[AuthV2] Failed to sync session', error);
        clearState();
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const authListener = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession);
    });
    const subscription = authListener?.data?.subscription;

    const initializeSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) throw error;

        await syncSession(data.session ?? null);
      } catch (error) {
        console.error('[AuthV2] Failed to initialize session', error);
        if (!mounted) return;

        clearState();
        setSession(null);
        setUser(null);
        setLoading(false);

        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.warn('[AuthV2] Failed to sign out after initialization error', signOutError);
        }
      }
    };

    void initializeSession();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setCompany(null);
    setMembership(null);
    setProfileV2(null);
    setSession(null);
    setUser(null);
    setUsingNewSystem(false);
    setLoading(false);
  };

  const isMaster = isOwnerEmail(user?.email);

  const value = {
    company,
    membership,
    user,
    session,
    profileV2,
    loading,
    isMaster,
    usingNewSystem,
    signOut,
  };

  return (
    <AuthV2Context.Provider value={value}>
      {children}
    </AuthV2Context.Provider>
  );
}

export function useAuthV2() {
  const context = useContext(AuthV2Context);
  if (context === undefined) {
    throw new Error('useAuthV2 must be used within an AuthV2Provider');
  }
  return context;
}
