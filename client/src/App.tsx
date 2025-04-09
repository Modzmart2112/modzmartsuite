import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import DashboardLayout from "@/components/layout/dashboard-layout";
import Dashboard from "@/pages/dashboard";
import Products from "@/pages/products";
import Suppliers from "@/pages/suppliers";
import SaleManagement from "@/pages/sale-management";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import { AuthProvider } from "@/lib/authContext";
import { PrivateRoute } from "@/components/auth/PrivateRoute";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        <PrivateRoute>
          <Dashboard />
        </PrivateRoute>
      </Route>
      <Route path="/products">
        <PrivateRoute>
          <Products />
        </PrivateRoute>
      </Route>
      <Route path="/suppliers">
        <PrivateRoute>
          <Suppliers />
        </PrivateRoute>
      </Route>
      <Route path="/sales">
        <PrivateRoute>
          <SaleManagement />
        </PrivateRoute>
      </Route>
      <Route path="/settings">
        <PrivateRoute>
          <Settings />
        </PrivateRoute>
      </Route>
      <Route>
        <PrivateRoute>
          <NotFound />
        </PrivateRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route>
            <DashboardLayout>
              <Router />
            </DashboardLayout>
          </Route>
        </Switch>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
