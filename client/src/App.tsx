import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Tasks from "@/pages/tasks";
import Projects from "@/pages/projects";
import Categories from "@/pages/categories";
import Departments from "@/pages/departments";
import Settings from "@/pages/settings";
import AuthPage from "@/pages/auth-page";
import { Sidebar } from "@/components/sidebar";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      <ProtectedRoute path="/" component={() => (
        <AppLayout>
          <Dashboard />
        </AppLayout>
      )} />
      
      <ProtectedRoute path="/tasks" component={() => (
        <AppLayout>
          <Tasks />
        </AppLayout>
      )} />
      
      <ProtectedRoute path="/projects" component={() => (
        <AppLayout>
          <Projects />
        </AppLayout>
      )} />
      
      <ProtectedRoute path="/categories" component={() => (
        <AppLayout>
          <Categories />
        </AppLayout>
      )} />
      
      <ProtectedRoute path="/departments" component={() => (
        <AppLayout>
          <Departments />
        </AppLayout>
      )} />
      
      <ProtectedRoute path="/settings" component={() => (
        <AppLayout>
          <Settings />
        </AppLayout>
      )} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
