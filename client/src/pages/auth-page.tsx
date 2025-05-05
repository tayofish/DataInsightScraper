import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { FaMicrosoft } from "react-icons/fa";

// Login form schema
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

// Registration form schema
const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  avatar: z.string().nullable().optional(),
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [location] = useLocation();
  const search = useSearch();
  const { user, loginMutation, registerMutation } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("login");
  const [authError, setAuthError] = useState<string | null>(null);

  // Get error message from URL if present
  useEffect(() => {
    const params = new URLSearchParams(search);
    const error = params.get('error');
    
    if (error) {
      const errorMessages: Record<string, string> = {
        'microsoft_auth_error': 'An error occurred during Microsoft authentication. Please try again.',
        'microsoft_auth_failed': 'Microsoft authentication failed. Please try again or use another login method.',
        'microsoft_login_error': 'Unable to log you in with Microsoft account. Please try again later.'
      };
      
      setAuthError(errorMessages[error] || 'An authentication error occurred.');
    }
  }, [search]);

  // Redirect if already logged in
  if (user) {
    window.location.href = "/";
    return null;
  }

  // Login form
  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Registration form
  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      name: "",
      avatar: null,
    },
  });

  // Handle login form submission
  const onLoginSubmit = (values: LoginValues) => {
    loginMutation.mutate(values);
  };

  // Handle register form submission
  const onRegisterSubmit = (values: RegisterValues) => {
    registerMutation.mutate(values);
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Left side - Form */}
      <div className="flex flex-col justify-center flex-1 px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="w-full max-w-md mx-auto lg:w-96">
          <div className="mb-8">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
              Welcome to Task Manager
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {activeTab === "login" ? "Sign in to your account" : "Create a new account"}
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Login</CardTitle>
                  <CardDescription>
                    Enter your credentials to access your account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Logging in...
                          </>
                        ) : (
                          "Sign in"
                        )}
                      </Button>

                      {/* Error Alert */}
                      {authError && (
                        <Alert variant="destructive" className="mt-3">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{authError}</AlertDescription>
                        </Alert>
                      )}

                      {/* Separator */}
                      <div className="relative mt-6">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-gray-300 dark:border-gray-700" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                            Or continue with
                          </span>
                        </div>
                      </div>

                      {/* Microsoft Login Button */}
                      <a 
                        href="/api/auth/entra" 
                        className="inline-block w-full mt-4"
                      >
                        <Button 
                          variant="outline"
                          className="w-full flex items-center justify-center gap-2 border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                          type="button"
                        >
                          <FaMicrosoft className="h-4 w-4 text-[#0078d4]" />
                          Sign in with Microsoft
                        </Button>
                      </a>
                    </form>
                  </Form>
                </CardContent>
                <CardFooter className="flex justify-center">
                  <Button
                    variant="link"
                    onClick={() => setActiveTab("register")}
                  >
                    Don't have an account? Sign up
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Create an account</CardTitle>
                  <CardDescription>
                    Enter your information to create a new account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="johndoe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          "Sign up"
                        )}
                      </Button>

                      {/* Error Alert */}
                      {authError && (
                        <Alert variant="destructive" className="mt-3">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{authError}</AlertDescription>
                        </Alert>
                      )}

                      {/* Separator */}
                      <div className="relative mt-6">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-gray-300 dark:border-gray-700" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                            Or continue with
                          </span>
                        </div>
                      </div>

                      {/* Microsoft Login Button */}
                      <a 
                        href="/api/auth/entra" 
                        className="inline-block w-full mt-4"
                      >
                        <Button 
                          variant="outline"
                          className="w-full flex items-center justify-center gap-2 border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                          type="button"
                        >
                          <FaMicrosoft className="h-4 w-4 text-[#0078d4]" />
                          Sign up with Microsoft
                        </Button>
                      </a>
                    </form>
                  </Form>
                </CardContent>
                <CardFooter className="flex justify-center">
                  <Button
                    variant="link"
                    onClick={() => setActiveTab("login")}
                  >
                    Already have an account? Sign in
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right side - Hero */}
      <div className="relative hidden w-0 flex-1 lg:block">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-700 flex flex-col justify-center p-12">
          <div className="max-w-2xl mx-auto text-white">
            <h1 className="text-4xl font-bold mb-6">Streamline Your Workflow</h1>
            <p className="text-xl mb-8">
              Track tasks, collaborate with team members, and boost productivity with our intuitive task management platform.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
                <h3 className="font-semibold text-lg mb-2">Organize Tasks</h3>
                <p>Categorize and prioritize tasks to stay on top of your workload</p>
              </div>
              <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
                <h3 className="font-semibold text-lg mb-2">Track Progress</h3>
                <p>Monitor task status and deadlines in real-time</p>
              </div>
              <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
                <h3 className="font-semibold text-lg mb-2">Team Collaboration</h3>
                <p>Assign tasks and communicate with team members</p>
              </div>
              <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
                <h3 className="font-semibold text-lg mb-2">Custom Categories</h3>
                <p>Create department-specific categories for better organization</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}