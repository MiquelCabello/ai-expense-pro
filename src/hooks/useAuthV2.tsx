import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const OWNER_EMAIL = 'info@miquelcabello.com';

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
  tax_id?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  description?: string | null;
  logo_url?: string | null;
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
  name?: string;
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
}

const AuthV2Context = createContext<AuthV2ContextType | undefined>(undefined);

export function AuthV2Provider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profileV2, setProfileV2] = useState<ProfileV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMaster, setIsMaster] = useState(false);

  async function loadUserData(currentUser: User) {
    try {
      console.log('[AuthV2] Loading user data for:', currentUser.id);

      const { data: profile, error: profileError } = await supabase
        .from('profiles_v2')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (profileError) {
        console.error('[AuthV2] Error loading profile_v2:', profileError);
      }

      console.log('[AuthV2] Profile loaded:', profile);
      setProfileV2(profile);

      const { data: memberships, error: membershipError } = await supabase
        .from('memberships')
        .select('*')
        .eq('user_id', currentUser.id);

      if (membershipError) {
        console.error('[AuthV2] Error loading memberships:', membershipError);
      }

      console.log('[AuthV2] Memberships loaded:', memberships);
      const userMembership = memberships?.[0] || null;
      setMembership(userMembership);

      if (userMembership?.company_id) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', userMembership.company_id)
          .single();

        if (companyError) {
          console.error('[AuthV2] Error loading company:', companyError);
        }

        console.log('[AuthV2] Company loaded:', companyData);
        setCompany(companyData);
      } else {
        console.log('[AuthV2] No membership found, setting company to null');
        setCompany(null);
      }

      const email = currentUser.email?.toLowerCase();
      setIsMaster(email === OWNER_EMAIL);

      console.log('[AuthV2] Data loaded successfully');
    } catch (error) {
      console.error('[AuthV2] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function syncSession(nextSession: Session | null) {
    console.log('[AuthV2] Syncing session:', nextSession ? 'authenticated' : 'unauthenticated');
    
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setCompany(null);
      setMembership(null);
      setProfileV2(null);
      setIsMaster(false);
      setLoading(false);
      return;
    }

    await loadUserData(nextSession.user);
  }

  useEffect(() => {
    console.log('[AuthV2] Initializing...');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthV2] Auth state changed:', event);
        await syncSession(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      syncSession(session);
    });

    return () => {
      console.log('[AuthV2] Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log('[AuthV2] Signing out...');
    setCompany(null);
    setMembership(null);
    setUser(null);
    setSession(null);
    setProfileV2(null);
    setIsMaster(false);
    await supabase.auth.signOut();
  };

  return (
    <AuthV2Context.Provider
      value={{
        company,
        membership,
        user,
        session,
        profileV2,
        loading,
        isMaster,
        signOut,
      }}
    >
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