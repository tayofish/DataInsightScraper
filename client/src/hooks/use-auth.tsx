import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User as SelectUser, userInsertSchema } from "@shared/schema";
import { z } from "zod";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, RegisterData>;
};

// Login only requires username and password
type LoginData = {
  username: string;
  password: string;
};

// Registration requires all fields from the user schema
type RegisterData = z.infer<typeof userInsertSchema>;

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    // Handle offline scenarios by falling back to cached user data
    onError: (error) => {
      console.error("Error fetching user data:", error);
      // Try to load user from cache
      try {
        const cachedUser = localStorage.getItem('cached_user');
        if (cachedUser) {
          console.log("Using cached user data due to API error");
          const parsedUser = JSON.parse(cachedUser);
          queryClient.setQueryData(["/api/user"], parsedUser);
        }
      } catch (cacheError) {
        console.error("Failed to load cached user:", cacheError);
      }
    }
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      
      // Cache the user data for offline access
      try {
        localStorage.setItem('cached_user', JSON.stringify(user));
        console.log("User data cached for offline access");
      } catch (cacheError) {
        console.error("Failed to cache user data:", cacheError);
      }
      
      toast({
        title: "Logged in successfully",
        description: `Welcome back, ${user.name}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
      
      // Check if there's cached user data for offline login
      try {
        const cachedUser = localStorage.getItem('cached_user');
        if (cachedUser) {
          console.log("Using cached credentials for offline login");
          const parsedUser = JSON.parse(cachedUser);
          
          // Only use cache if username matches
          if (parsedUser.username === credentials.username) {
            toast({
              title: "Offline mode activated",
              description: "Using cached credentials for offline access",
            });
            queryClient.setQueryData(["/api/user"], parsedUser);
          }
        }
      } catch (cacheError) {
        console.error("Failed to check cached credentials:", cacheError);
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", userData);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Registration successful",
        description: `Welcome, ${user.name}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message || "Could not create account",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}