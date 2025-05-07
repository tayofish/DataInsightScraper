import { useAuth } from "@/hooks/use-auth";
import { Loader2, ShieldAlert } from "lucide-react";
import { Redirect, Route } from "wouter";
import { ComponentType } from "react";

interface AdminRouteProps {
  path: string;
  component: ComponentType;
}

export function AdminRoute({ path, component: Component }: AdminRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  // First check if user is logged in
  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Then check if user is an admin
  if (!user.isAdmin) {
    return (
      <Route path={path}>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <ShieldAlert className="h-16 w-16 text-red-500" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">You do not have permission to access this page.</p>
          <a href="/" className="text-blue-600 hover:underline">Return to Dashboard</a>
        </div>
      </Route>
    );
  }

  // If user is logged in and is an admin, render the component
  return (
    <Route path={path}>
      <Component />
    </Route>
  );
}