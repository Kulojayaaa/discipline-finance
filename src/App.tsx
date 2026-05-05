import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CurrencyProvider } from "@/hooks/CurrencyContext";
import { ThemeProvider } from "@/hooks/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { useFinanceSync } from "@/hooks/useFinanceSync";
import { FullPageLoader } from "@/components/ui/FullPageLoader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazy, Suspense } from "react";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Goals = lazy(() => import("./pages/Goals"));
const Habits = lazy(() => import("./pages/Habits"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Products = lazy(() => import("./pages/Products"));
const BillsPage = lazy(() => import("./pages/Bills"));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const Notes = lazy(() => import("./pages/Notes"));
const Reminders = lazy(() => import("./pages/Reminders"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Vault = lazy(() => import("./pages/Vault"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  useFinanceSync(user?.id);
  if (loading) return <FullPageLoader label="Checking your session..." />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader label="Loading authentication..." />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CurrencyProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<FullPageLoader label="Loading module..." />}>
                <Routes>
                  <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
                  <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                  <Route path="/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
                  <Route path="/habits" element={<ProtectedRoute><Habits /></ProtectedRoute>} />
                  <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
                  <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
                  <Route path="/bills" element={<ProtectedRoute><BillsPage /></ProtectedRoute>} />
                  <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
                  <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
                  <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/vault" element={<ProtectedRoute><Vault /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
