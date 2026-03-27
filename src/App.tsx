import { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import DynamicManifest from "./components/DynamicManifest";

// Lazy load pages for better performance
import Index from "./pages/Index";
import LoginAccueil from "./pages/LoginAccueil";
const LoginManager = lazy(() => import("./pages/LoginManager"));
const LoginMedecin = lazy(() => import("./pages/LoginMedecin"));
const Accueil = lazy(() => import("./pages/Accueil"));
const Client = lazy(() => import("./pages/Client"));
const Manager = lazy(() => import("./pages/Manager"));
const TV = lazy(() => import("./pages/TV"));
const Rendezvous = lazy(() => import("./pages/Rendezvous"));
const Satisfaction = lazy(() => import("./pages/Satisfaction"));
const AvisGoogle = lazy(() => import("./pages/AvisGoogle"));
const Feedback = lazy(() => import("./pages/Feedback"));
const Merci = lazy(() => import("./pages/Merci"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Ordonnance = lazy(() => import("./pages/Ordonnance"));
const MedecinDashboard = lazy(() => import("./pages/MedecinDashboard"));

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const queryClient = new QueryClient();

function ProtectedRoute({ children, requiredRoles }: { children: React.ReactNode; requiredRoles?: string[] }) {
  const { user, loading, userRole } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) {
    if (requiredRoles?.includes('manager')) return <Navigate to="/manager/login" replace />;
    if (requiredRoles?.includes('receptionist')) return <Navigate to="/accueil/login" replace />;
    return <Navigate to="/" replace />;
  }

  if (requiredRoles && userRole === null) return <LoadingScreen />;

  if (requiredRoles && !requiredRoles.includes(userRole || '')) {
    if (userRole === 'manager') return <Navigate to="/manager" replace />;
    if (userRole === 'receptionist') return <Navigate to="/accueil" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <DynamicManifest />
      <AuthProvider>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/accueil/login" element={<LoginAccueil />} />
            <Route path="/manager/login" element={<LoginManager />} />
            <Route path="/medecin/login" element={<LoginMedecin />} />
            <Route path="/client" element={<Client />} />
            <Route path="/tv" element={<TV />} />
            <Route path="/review" element={<Satisfaction />} />
            <Route path="/avis-google" element={<AvisGoogle />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/merci" element={<Merci />} />
            <Route path="/accueil" element={
              <ProtectedRoute requiredRoles={['receptionist']}><Accueil /></ProtectedRoute>
            } />
            <Route path="/manager" element={
              <ProtectedRoute requiredRoles={['manager']}><Manager /></ProtectedRoute>
            } />
            <Route path="/rendezvous" element={
              <ProtectedRoute requiredRoles={['manager', 'receptionist']}><Rendezvous /></ProtectedRoute>
            } />
            <Route path="/ordonnance" element={<Ordonnance />} />
            <Route path="/medecin-dashboard" element={<MedecinDashboard />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;

