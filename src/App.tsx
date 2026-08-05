import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/components/MainLayout";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Companies from "./pages/Companies";
import Attendance from "./pages/Attendance";
import Salaries from "./pages/Salaries";
import Advances from "./pages/Advances";
import Invoices from "./pages/Invoices";
import Accounts from "./pages/Accounts";
import Inventory from "./pages/Inventory";
import Food from "./pages/Food";
import Vendors from "./pages/Vendors";
import Maintenance from "./pages/Maintenance";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/companies" element={<Companies />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/salaries" element={<Salaries />} />
              <Route path="/advances" element={<Advances />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/food" element={<Food />} />
              <Route path="/settings" element={<ProtectedRoute requireSuperAdmin><Settings /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
