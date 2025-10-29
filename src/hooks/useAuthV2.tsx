import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface Account {
  id: string;
  name: string;
  owner_user_id: string;
}

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
  account_id?: string | null;
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
  isDataReady: boolean;
  isMaster: boolean;
  isGroupAdmin: boolean;
  account: Account | null;
  managedCompanies: Company[];
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
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
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [managedCompanies, setManagedCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const isDataReady = useMemo(() => {
    if (loading) return false;
    if (!user) return true; // No user = data is "ready" (empty state)
    
    // If user is master, they don't need membership/company
    if (isMaster) return true;
    
    // For regular users, ensure critical data is loaded
    return membership !== null || company !== null;
  }, [loading, user, isMaster, membership, company]);

  async function loadUserData(currentUser: User) {
    try {
      console.log('[AuthV2] Loading user data for:', currentUser.id);

      // Execute independent queries in parallel for better performance
      const [
        { data: profile, error: profileError },
        { data: accountMembership, error: accountMembershipError },
        { data: memberships, error: membershipError },
        { data: isMasterData, error: masterError }
      ] = await Promise.all([
        supabase.from('profiles_v2').select('*').eq('user_id', currentUser.id).maybeSingle(),
        supabase.from('account_memberships').select('*, accounts(*)').eq('user_id', currentUser.id).maybeSingle(),
        supabase.from('memberships').select('*').eq('user_id', currentUser.id),
        supabase.rpc('is_global_admin')
      ]);

      // Handle errors
      if (profileError) {
        console.error('[AuthV2] Error loading profile_v2:', profileError);
      }
      if (accountMembershipError) {
        console.error('[AuthV2] Error loading account membership:', accountMembershipError);
      }
      if (membershipError) {
        console.error('[AuthV2] Error loading memberships:', membershipError);
      }
      if (masterError) {
        console.error('[AuthV2] Error checking master status:', masterError);
      }

      // Set profile
      console.log('[AuthV2] Profile loaded:', profile);
      setProfileV2(profile);

      // Set master status
      setIsMaster(isMasterData || false);

      // Handle account memberships (group admin)
      console.log('[AuthV2] Account membership loaded:', accountMembership);
      if (accountMembership) {
        setIsGroupAdmin(true);
        setAccount(accountMembership.accounts as Account);

        // Load all companies for this account
        const { data: accountCompanies, error: companiesError } = await supabase
          .from('companies')
          .select('*')
          .eq('account_id', accountMembership.account_id);

        if (companiesError) {
          console.error('[AuthV2] Error loading account companies:', companiesError);
        } else {
          console.log('[AuthV2] Account companies loaded:', accountCompanies);
          setManagedCompanies(accountCompanies || []);
          
          // If multiple companies, set first as selected by default
          if (accountCompanies && accountCompanies.length > 0) {
            setSelectedCompanyId(accountCompanies[0].id);
          }
        }
      }

      // Handle memberships
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

      console.log('[AuthV2] Data loaded successfully');
    } catch (error) {
      console.error('[AuthV2] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  const syncSession = useCallback(async (nextSession: Session | null) => {
    console.log('[AuthV2] Syncing session:', nextSession ? 'authenticated' : 'unauthenticated');
    
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setCompany(null);
      setMembership(null);
      setProfileV2(null);
      setIsMaster(false);
      setIsGroupAdmin(false);
      setAccount(null);
      setManagedCompanies([]);
      setSelectedCompanyId(null);
      setLoading(false);
      return;
    }

    // Defer Supabase calls to avoid deadlock
    setTimeout(() => {
      loadUserData(nextSession.user);
    }, 0);
  }, []);

  useEffect(() => {
    console.log('[AuthV2] Initializing...');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[AuthV2] Auth state changed:', event);
        syncSession(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      syncSession(session);
    });

    return () => {
      console.log('[AuthV2] Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, [syncSession]);

  const signOut = async () => {
    console.log('[AuthV2] Signing out...');
    setCompany(null);
    setMembership(null);
    setUser(null);
    setSession(null);
    setProfileV2(null);
    setIsMaster(false);
    setIsGroupAdmin(false);
    setAccount(null);
    setManagedCompanies([]);
    setSelectedCompanyId(null);
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
        isDataReady,
        isMaster,
        isGroupAdmin,
        account,
        managedCompanies,
        selectedCompanyId,
        setSelectedCompanyId,
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