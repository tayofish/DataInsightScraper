import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Tasks from "@/pages/tasks";
import Projects from "@/pages/projects";
import ProjectDetailPage from "@/pages/project-detail";
import ProjectTeam from "@/pages/project-team";
import Reports from "@/pages/reports";
import Categories from "@/pages/categories";
import Departments from "@/pages/departments";
import Teams from "@/pages/teams";
import Settings from "@/pages/settings";
import AdminPage from "@/pages/admin";
import AuthPage from "@/pages/auth-page";
import NotificationsPage from "@/pages/notifications";
import ChannelsPage from "@/pages/channels";
import DirectMessagesPage from "@/pages/direct-messages";
import { Sidebar } from "@/components/sidebar";
import { NotificationDropdown } from "@/components/notification-dropdown";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { AdminRoute } from "@/lib/admin-route";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 border-b border-gray-200 bg-white/60 backdrop-blur-sm z-10">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold gradient-heading">Task Management System</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" className="rounded-full hover:bg-primary/10 shadow-sm">
              <span className="mr-2">🎯</span> Quick Add
            </Button>
            <div className="bg-primary/10 rounded-full px-3 py-1.5 flex items-center text-xs font-medium shadow-inner text-primary">
              <span className="mr-1">✨</span> Modern UI activated
            </div>
            <NotificationDropdown />
          </div>
        </header>
        <main className="flex-1 relative overflow-y-auto focus:outline-none custom-scrollbar">
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
      
      <ProtectedRoute path="/projects/:id" component={() => (
        <AppLayout>
          <ProjectDetailPage />
        </AppLayout>
      )} />
      
      <ProtectedRoute path="/projects/:id/team" component={() => (
        <AppLayout>
          <ProjectTeam />
        </AppLayout>
      )} />
      
      {/* Admin-only routes */}
      <AdminRoute path="/categories" component={() => (
        <AppLayout>
          <Categories />
        </AppLayout>
      )} />
      
      <AdminRoute path="/departments" component={() => (
        <AppLayout>
          <Departments />
        </AppLayout>
      )} />
      
      <AdminRoute path="/teams" component={() => (
        <AppLayout>
          <Teams />
        </AppLayout>
      )} />

      <AdminRoute path="/admin" component={() => (
        <AppLayout>
          <AdminPage />
        </AppLayout>
      )} />
      
      {/* Routes accessible to all users */}
      <ProtectedRoute path="/settings" component={() => (
        <AppLayout>
          <Settings />
        </AppLayout>
      )} />
      
      <ProtectedRoute path="/reports" component={() => (
        <AppLayout>
          <Reports />
        </AppLayout>
      )} />
      
      <ProtectedRoute path="/notifications" component={() => (
        <AppLayout>
          <NotificationsPage />
        </AppLayout>
      )} />
      
      {/* Collaboration Routes */}
      <ProtectedRoute path="/channels" component={() => (
        <AppLayout>
          <ChannelsPage />
        </AppLayout>
      )} />
      
      <ProtectedRoute path="/direct-messages" component={() => (
        <AppLayout>
          <DirectMessagesPage />
        </AppLayout>
      )} />
      
      <ProtectedRoute path="/direct-messages/:id" component={() => (
        <AppLayout>
          <DirectMessagesPage />
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
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
