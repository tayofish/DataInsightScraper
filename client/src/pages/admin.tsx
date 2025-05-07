import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  CheckCircle2, CircleAlert, Edit, MoreVertical, Plus, RefreshCw, Trash2, 
  Users, Briefcase, Link, Link2, Link2Off, UserPlus, Mail
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs as TabsComponent, TabsContent as TabsComponentContent, TabsList as TabsComponentList, TabsTrigger as TabsComponentTrigger } from "@/components/ui/tabs";
import type { User, Project, Category, Department, ProjectAssignment } from "@shared/schema";
import SmtpConfigForm from "@/components/smtp-config-form";

// User management form schema
const userFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address").optional().nullable(),
  avatar: z.string().nullable().optional(),
  isAdmin: z.boolean().default(false)
});

type UserFormValues = z.infer<typeof userFormSchema>;

// Project assignment form schema
const projectAssignmentSchema = z.object({
  userId: z.number({
    required_error: "Please select a user",
  }),
  projectId: z.number({
    required_error: "Please select a project",
  }),
  role: z.string().min(2, "Role must be at least 2 characters").default("Member"),
});

type ProjectAssignmentFormValues = z.infer<typeof projectAssignmentSchema>;

export default function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("projects");
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Project assignment states
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Fetch project assignments
  const { data: projectAssignments, isLoading: isLoadingAssignments } = useQuery({
    queryKey: ["/api/project-assignments"],
    queryFn: async () => {
      const res = await fetch("/api/project-assignments");
      if (!res.ok) throw new Error("Failed to fetch project assignments");
      return res.json() as Promise<(ProjectAssignment & { user?: User, project?: Project })[]>;
    }
  });
  
  // Project assignment form
  const assignmentForm = useForm<ProjectAssignmentFormValues>({
    resolver: zodResolver(projectAssignmentSchema),
    defaultValues: {
      userId: 0,
      projectId: 0,
      role: "Member"
    }
  });

  // Fetch users
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<User[]>;
    }
  });

  // Fetch projects for assignments
  const { data: projects } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json() as Promise<Project[]>;
    }
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json() as Promise<Category[]>;
    }
  });

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments");
      if (!res.ok) throw new Error("Failed to fetch departments");
      return res.json() as Promise<Department[]>;
    }
  });

  // User form
  const userForm = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      password: "",
      name: "",
      avatar: null,
      isAdmin: false
    }
  });

  // Reset user form
  const resetUserForm = () => {
    userForm.reset({
      username: "",
      password: "",
      name: "",
      email: "",
      avatar: null,
      isAdmin: false
    });
    setUserToEdit(null);
  };

  // Open user dialog for creating
  const openUserCreateDialog = () => {
    resetUserForm();
    setIsUserDialogOpen(true);
  };

  // Open user dialog for editing
  const openUserEditDialog = (user: User) => {
    setUserToEdit(user);
    userForm.reset({
      username: user.username,
      password: "", // Don't prefill password
      name: user.name || "",
      email: user.email || "",
      avatar: user.avatar,
      isAdmin: user.isAdmin || false
    });
    setIsUserDialogOpen(true);
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (user: User) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: UserFormValues) => {
      const res = await apiRequest("POST", "/api/admin/users", userData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User created",
        description: "The user has been created successfully.",
      });
      setIsUserDialogOpen(false);
      resetUserForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (userData: UserFormValues & { id: number }) => {
      const { id, ...data } = userData;
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User updated",
        description: "The user has been updated successfully.",
      });
      setIsUserDialogOpen(false);
      resetUserForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User deleted",
        description: "The user has been deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle user form submission
  const onUserSubmit = (values: UserFormValues) => {
    if (userToEdit) {
      updateUserMutation.mutate({ ...values, id: userToEdit.id });
    } else {
      createUserMutation.mutate(values);
    }
  };

  // Handle user deletion
  const handleUserDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };
  
  // Reset assignment form
  const resetAssignmentForm = () => {
    assignmentForm.reset({
      userId: 0,
      projectId: 0,
      role: "Member"
    });
    setSelectedUser(null);
    setSelectedProject(null);
  };
  
  // Open assignment dialog
  const openAssignmentDialog = (project?: Project, user?: User) => {
    if (project) setSelectedProject(project);
    if (user) setSelectedUser(user);
    
    assignmentForm.reset({
      userId: user?.id || 0,
      projectId: project?.id || 0,
      role: "Member"
    });
    
    setIsAssignmentDialogOpen(true);
  };
  
  // Create project assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: async (data: ProjectAssignmentFormValues) => {
      const res = await apiRequest("POST", "/api/project-assignments", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-assignments"] });
      toast({
        title: "Project assignment created",
        description: "The user has been assigned to the project successfully.",
      });
      setIsAssignmentDialogOpen(false);
      resetAssignmentForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create project assignment",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Delete project assignment mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      const res = await apiRequest("DELETE", `/api/project-assignments/${assignmentId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-assignments"] });
      toast({
        title: "Project assignment removed",
        description: "The user has been unassigned from the project successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove project assignment",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle assignment form submission
  const onAssignmentSubmit = (values: ProjectAssignmentFormValues) => {
    createAssignmentMutation.mutate(values);
  };
  
  // Render project assignments tab
  const renderProjectAssignmentsTab = () => {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Project Assignments</h2>
          <Button onClick={() => openAssignmentDialog()}>
            <UserPlus className="mr-2 h-4 w-4" /> Assign User to Project
          </Button>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingAssignments ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : projectAssignments && projectAssignments.length > 0 ? (
                  projectAssignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={assignment.user?.avatar || undefined} alt={assignment.user?.name || "User"} />
                            <AvatarFallback>{assignment.user?.name?.substring(0, 2).toUpperCase() || "U"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{assignment.user?.name || "Unnamed User"}</p>
                            <p className="text-sm text-muted-foreground">{assignment.user?.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span>{assignment.project?.name || "Unknown Project"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{assignment.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAssignmentMutation.mutate(assignment.id)}
                          disabled={deleteAssignmentMutation.isPending}
                        >
                          {deleteAssignmentMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Link2Off className="h-4 w-4 text-red-500" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">
                      No project assignments found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {/* Project Assignment Dialog */}
        <Dialog open={isAssignmentDialogOpen} onOpenChange={setIsAssignmentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign User to Project</DialogTitle>
              <DialogDescription>
                Select a user and project to create an assignment.
              </DialogDescription>
            </DialogHeader>
            <Form {...assignmentForm}>
              <form onSubmit={assignmentForm.handleSubmit(onAssignmentSubmit)} className="space-y-4">
                <FormField
                  control={assignmentForm.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a user" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users?.map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.name || user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={assignmentForm.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects?.map((project) => (
                            <SelectItem key={project.id} value={project.id.toString()}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={assignmentForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <FormControl>
                        <Input placeholder="Member" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsAssignmentDialogOpen(false)}
                    type="button"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createAssignmentMutation.isPending}
                  >
                    {createAssignmentMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      "Assign to Project"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  // Create dashboard stats cards for admin overview
  const renderAdminOverview = () => {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <CardTitle className="h-4 w-4 text-muted-foreground">#</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <CardTitle className="h-4 w-4 text-muted-foreground">#</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <CardTitle className="h-4 w-4 text-muted-foreground">#</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departments?.length || 0}</div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Render users tab content
  const renderUsersTab = () => {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">User Management</h2>
          <Button onClick={openUserCreateDialog}>
            <Plus className="mr-2 h-4 w-4" /> Add User
          </Button>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingUsers ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : users && users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatar || undefined} alt={user.name || "User"} />
                            <AvatarFallback>{user.name?.substring(0, 2).toUpperCase() || "U"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.name || "Unnamed User"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openUserEditDialog(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(user)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* User Create/Edit Dialog */}
        <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{userToEdit ? "Edit User" : "Create User"}</DialogTitle>
              <DialogDescription>
                {userToEdit 
                  ? "Update the user details below." 
                  : "Fill in the details to create a new user."}
              </DialogDescription>
            </DialogHeader>
            <Form {...userForm}>
              <form onSubmit={userForm.handleSubmit(onUserSubmit)} className="space-y-4">
                <FormField
                  control={userForm.control}
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
                  control={userForm.control}
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
                  control={userForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john.doe@example.com" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={userForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{userToEdit ? "New Password (leave blank to keep current)" : "Password"}</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          {...field} 
                          required={!userToEdit}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={userForm.control}
                  name="isAdmin"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4 rounded border-gray-300 text-primary"
                          />
                          <label htmlFor="isAdmin" className="text-sm font-medium">
                            Administrator Role
                          </label>
                        </div>
                      </FormControl>
                      <div className="text-xs text-muted-foreground">
                        Grants access to admin dashboard and system configuration
                      </div>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsUserDialogOpen(false)}
                    type="button"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createUserMutation.isPending || updateUserMutation.isPending}
                  >
                    {(createUserMutation.isPending || updateUserMutation.isPending) ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        {userToEdit ? "Updating..." : "Creating..."}
                      </>
                    ) : (
                      userToEdit ? "Update User" : "Create User"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the user <span className="font-semibold">{userToDelete?.name || userToDelete?.username}</span>. 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleUserDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteUserMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete User"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  };

  // Render system settings tab (permissions, etc.)
  const renderSystemTab = () => {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">System Configuration</h2>
        
        {/* SMTP Configuration */}
        <TabsComponent defaultValue="smtp" className="w-full">
          <TabsComponentList className="grid grid-cols-3 w-full">
            <TabsComponentTrigger value="smtp" className="flex items-center">
              <Mail className="mr-2 h-4 w-4" /> Email Notifications
            </TabsComponentTrigger>
            <TabsComponentTrigger value="backup" className="flex items-center">
              <RefreshCw className="mr-2 h-4 w-4" /> Backup & Restore
            </TabsComponentTrigger>
            <TabsComponentTrigger value="auth" className="flex items-center">
              <Users className="mr-2 h-4 w-4" /> Authentication
            </TabsComponentTrigger>
          </TabsComponentList>
          
          <TabsComponentContent value="smtp" className="mt-6">
            <SmtpConfigForm />
          </TabsComponentContent>
          
          <TabsComponentContent value="backup" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Backup and Restore</CardTitle>
                <CardDescription>
                  Manage system data backups and restoration.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col space-y-2">
                  <div className="flex space-x-2">
                    <Button variant="outline">
                      Export Database
                    </Button>
                    <Button variant="outline">
                      Export Settings
                    </Button>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline">
                      Import Database
                    </Button>
                    <Button variant="outline">
                      Import Settings
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsComponentContent>
          
          <TabsComponentContent value="auth" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Authentication Settings</CardTitle>
                <CardDescription>
                  Configure user authentication methods.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Local Authentication</h4>
                    <p className="text-sm text-muted-foreground">Allow users to login with username and password</p>
                  </div>
                  <Badge>Enabled</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Microsoft Authentication</h4>
                    <p className="text-sm text-muted-foreground">Allow users to login with Microsoft Entra ID</p>
                  </div>
                  <Badge>Enabled</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsComponentContent>
        </TabsComponent>
      </div>
    );
  };

  return (
    <div className="container py-10">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Administrator Dashboard</h1>
          <p className="text-muted-foreground">
            Manage users, system settings, and configuration
          </p>
        </div>
        <Separator />
        
        {/* Overview Statistics */}
        {renderAdminOverview()}
        
        <Separator />
        
        {/* Admin Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-[600px]">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="projects">Project Assignments</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>
          
          <TabsContent value="users" className="mt-6">
            {renderUsersTab()}
          </TabsContent>
          
          <TabsContent value="projects" className="mt-6">
            {renderProjectAssignmentsTab()}
          </TabsContent>
          
          <TabsContent value="system" className="mt-6">
            {renderSystemTab()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}