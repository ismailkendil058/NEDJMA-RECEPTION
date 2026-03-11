import { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

// Lazy load pages for better performance
const Index = lazy(() => import("./pages/Index"));
const LoginAccueil = lazy(() => import("./pages/LoginAccueil"));
const LoginManager = lazy(() => import("./pages/LoginManager"));
const Accueil = lazy(() => import("./pages/Accueil"));
const Client = lazy(() => import("./pages/Client"));
const Manager = lazy(() => import("./pages/Manager"));
const TV = lazy(() => import("./pages/TV"));
const NotFound = lazy(() => import("./pages/NotFound"));

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const queryClient = new QueryClient();

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) {
  const { user, loading, userRole } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) {
    if (requiredRole === 'manager') return <Navigate to="/manager/login" replace />;
    if (requiredRole === 'receptionist') return <Navigate to="/accueil/login" replace />;
    return <Navigate to="/" replace />;
  }

  // If we need a role but it's not loaded yet, wait
  if (requiredRole && userRole === null) return <LoadingScreen />;

  if (requiredRole && userRole !== requiredRole) {
    if (userRole === 'manager') return <Navigate to="/manager" replace />;
    if (userRole === 'receptionist') return <Navigate to="/accueil" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/accueil/login" element={<LoginAccueil />} />
              <Route path="/manager/login" element={<LoginManager />} />
              <Route path="/client" element={<Client />} />
              <Route path="/tv" element={<TV />} />
              <Route path="/accueil" element={
                <ProtectedRoute requiredRole="receptionist"><Accueil /></ProtectedRoute>
              } />
              <Route path="/manager" element={
                <ProtectedRoute requiredRole="manager"><Manager /></ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
