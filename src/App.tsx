import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import LoginAccueil from "./pages/LoginAccueil";
import LoginManager from "./pages/LoginManager";
import Accueil from "./pages/Accueil";
import Client from "./pages/Client";
import Manager from "./pages/Manager";
import TV from "./pages/TV";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) {
  const { user, loading, userRole } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) {
    if (requiredRole === 'manager') return <Navigate to="/manager/login" replace />;
    if (requiredRole === 'receptionist') return <Navigate to="/accueil/login" replace />;
    return <Navigate to="/" replace />;
  }

  // If we need a role but it's not loaded yet, wait
  if (requiredRole && userRole === null) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
