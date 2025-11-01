import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthV2Provider, useAuthV2 } from "@/hooks/useAuthV2";
import { ThemeProvider } from "@/components/ThemeProvider";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import RegistrationConfirmationPage from "./pages/RegistrationConfirmationPage";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import CompanyProfilePage from "./pages/CompanyProfilePage";
import Dashboard from "./pages/Dashboard";
import ExpensesPage from "./pages/ExpensesPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import EmployeesPage from "./pages/EmployeesPage";
import ConfigurationPage from "./pages/ConfigurationPage";
import UploadPage from "./pages/UploadPage";
import CorporateGroupPage from "./pages/CorporateGroupPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected Route Wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isDataReady } = useAuthV2();

  if (loading || (user && !isDataReady)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto"></div>
          <div>
            <p className="text-lg font-medium text-foreground">Cargando tu espacio de trabajo</p>
            <p className="text-sm text-muted-foreground mt-2">Obteniendo datos de la empresa...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <>{children}</>;
}

// Public Route Wrapper (redirects if authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthV2();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Dashboard />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light">
      <TooltipProvider>
        <AuthV2Provider>
          <Toaster />
          <Sonner />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Routes>
                <Route path="/" element={
                  <PublicRoute>
                    <LandingPage />
                  </PublicRoute>
                } />
                <Route path="/auth" element={
                  <PublicRoute>
                    <AuthPage />
                  </PublicRoute>
                } />
                <Route path="/registro-confirmacion" element={<RegistrationConfirmationPage />} />
                <Route path="/accept-invite" element={<AcceptInvitePage />} />
                <Route path="/empresa" element={
                  <ProtectedRoute>
                    <CompanyProfilePage />
                  </ProtectedRoute>
                } />
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/gastos" element={
                  <ProtectedRoute>
                    <ExpensesPage />
                  </ProtectedRoute>
                } />
                <Route path="/analisis" element={
                  <ProtectedRoute>
                    <AnalyticsPage />
                  </ProtectedRoute>
                } />
                <Route path="/empleados" element={
                  <ProtectedRoute>
                    <EmployeesPage />
                  </ProtectedRoute>
                } />
                <Route path="/configuracion" element={
                  <ProtectedRoute>
                    <ConfigurationPage />
                  </ProtectedRoute>
                } />
                <Route path="/upload" element={
                  <ProtectedRoute>
                    <UploadPage />
                  </ProtectedRoute>
                } />
                <Route path="/grupo" element={
                  <ProtectedRoute>
                    <CorporateGroupPage />
                  </ProtectedRoute>
                } />
                <Route path="/grupo/empresas" element={
                  <ProtectedRoute>
                    <CorporateGroupPage />
                  </ProtectedRoute>
                } />
                <Route path="/grupo/analytics" element={
                  <ProtectedRoute>
                    <CorporateGroupPage />
                  </ProtectedRoute>
                } />
                <Route path="/grupo/config" element={
                  <ProtectedRoute>
                    <CorporateGroupPage />
                  </ProtectedRoute>
                } />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthV2Provider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
