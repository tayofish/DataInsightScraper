import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
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
import DatabaseErrorPage from "@/pages/database-error";
import { Sidebar } from "@/components/sidebar";
import { NotificationDropdown } from "@/components/notification-dropdown";
import { GlobalSearch } from "@/components/global-search";
import { OfflineModeIndicator } from "@/components/offline-mode-indicator";
import { AuthProvider } from "@/hooks/use-auth";
import { WebSocketProvider } from "@/hooks/websocket-provider";
import { ProtectedRoute } from "@/lib/protected-route";
import { AdminRoute } from "@/lib/admin-route";
import { useEffect, useState } from "react";

function AppLayout({ children }: { children: React.ReactNode }) {
  // Fetch app name
  const { data: appNameSetting } = useQuery({
    queryKey: ["/api/app-settings/app-name"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/app-settings/app-name");
        if (res.status === 404) {
          return { value: "Task Management System" }; // Default name
        }
        if (!res.ok) throw new Error("Failed to fetch app name");
        return res.json();
      } catch (error) {
        return { value: "Task Management System" }; // Default name
      }
    }
  });

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col w-0 flex-1">
        <header className="h-16 flex items-center justify-between px-6 border-b border-gray-200 bg-white/60 backdrop-blur-sm z-10">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold gradient-heading">
              {appNameSetting?.value || "Task Management System"}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <GlobalSearch />
            <NotificationDropdown />
          </div>
        </header>
        <main className="flex-1 relative overflow-auto focus:outline-none p-6">
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
      
      <ProtectedRoute path="/tasks/new" component={() => (
        <AppLayout>
          <Tasks showNewTaskForm={true} />
        </AppLayout>
      )} />
      
      <ProtectedRoute path="/tasks/:id" component={() => (
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
        <WebSocketProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
            {/* Add offline mode indicator for database connectivity issues */}
            <OfflineModeIndicator />
          </TooltipProvider>
        </WebSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
