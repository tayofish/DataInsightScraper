import { useState, useRef } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Upload, Camera, Mail, Building2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";

// Profile update schema
const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  avatar: z.string().nullable().optional(),
});

type ProfileValues = z.infer<typeof profileSchema>;

// Password update schema
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Confirm password is required"),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type PasswordValues = z.infer<typeof passwordSchema>;

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("profile");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Fetch user departments (which returns user-department assignments)
  const { data: userDepartments = [] } = useQuery({
    queryKey: ["/api/user-departments"],
    enabled: !!user?.id,
  });

  // Fetch all departments (categories) to get department info
  const { data: allDepartments = [] } = useQuery({
    queryKey: ["/api/categories"],
    enabled: !!user?.id,
  });

  // Fetch all units to get unit info
  const { data: allUnits = [] } = useQuery({
    queryKey: ["/api/departments"],
    enabled: !!user?.id,
  });

  // Get primary department info from user-department assignments
  const primaryDepartmentAssignment = Array.isArray(userDepartments) 
    ? userDepartments.find((assignment: any) => assignment.isPrimary)
    : null;
  
  const primaryDepartment = primaryDepartmentAssignment && Array.isArray(allDepartments)
    ? allDepartments.find((dept: any) => dept.id === primaryDepartmentAssignment.departmentId)
    : null;

  // Get user's unit info
  const userUnit = Array.isArray(allUnits) && user?.departmentId
    ? allUnits.find((unit: any) => unit.id === user.departmentId)
    : null;

  // Profile form
  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      username: user?.username || "",
      avatar: user?.avatar || null,
    },
  });

  // Password form
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Profile update mutation
  const profileMutation = useMutation({
    mutationFn: async (values: ProfileValues) => {
      const res = await apiRequest("PATCH", `/api/users/${user?.id}`, values);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Password update mutation
  const passwordMutation = useMutation({
    mutationFn: async (values: PasswordValues) => {
      const res = await apiRequest("POST", `/api/users/${user?.id}/change-password`, {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Password updated",
        description: "Your password has been updated successfully.",
      });
      passwordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Avatar upload mutation
  const avatarUploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`/api/users/${user?.id}/avatar`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        throw new Error("Failed to upload avatar");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setSelectedFile(null);
      setPreviewUrl(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle profile form submission
  const onProfileSubmit = (values: ProfileValues) => {
    profileMutation.mutate(values);
  };

  // Handle password form submission
  const onPasswordSubmit = (values: PasswordValues) => {
    passwordMutation.mutate(values);
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file.",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  // Handle avatar upload
  const handleAvatarUpload = () => {
    if (selectedFile) {
      const formData = new FormData();
      formData.append('avatar', selectedFile);
      avatarUploadMutation.mutate(formData);
    }
  };

  // Trigger file input
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="container py-10">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>
        <Separator />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-[400px] grid-cols-2 mb-8">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>
                  Update your personal information and public profile
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                    {/* Avatar */}
                    <div className="flex flex-col items-center space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
                      <Avatar className="h-24 w-24">
                        <AvatarImage 
                          src={previewUrl || user?.avatar || undefined} 
                          alt={user?.name || "User"} 
                        />
                        <AvatarFallback className="text-lg">
                          {user?.name?.substring(0, 2).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col space-y-2">
                        <h3 className="text-lg font-medium">Profile Picture</h3>
                        <p className="text-sm text-muted-foreground">
                          Upload a new avatar. JPG, PNG, or GIF (max 5MB)
                        </p>
                        
                        {/* Hidden file input */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        
                        {/* Upload Controls */}
                        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={triggerFileInput}
                            disabled={avatarUploadMutation.isPending}
                          >
                            <Camera className="h-4 w-4 mr-2" />
                            Choose File
                          </Button>
                          
                          {selectedFile && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleAvatarUpload}
                              disabled={avatarUploadMutation.isPending}
                            >
                              {avatarUploadMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-2" />
                                  Upload
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                        
                        {selectedFile && (
                          <p className="text-xs text-muted-foreground">
                            Selected: {selectedFile.name}
                          </p>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Account Information Section */}
                    <div className="space-y-6">
                      <h3 className="text-lg font-medium">Account Information</h3>
                      
                      {/* Email */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Email Address</span>
                        </div>
                        <div className="pl-6">
                          <p className="text-sm bg-muted/50 px-3 py-2 rounded-md">
                            {user?.email || "No email address set"}
                          </p>
                        </div>
                      </div>

                      {/* Primary Department */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Primary Department</span>
                        </div>
                        <div className="pl-6">
                          {primaryDepartment ? (
                            <div className="space-y-2">
                              <Badge variant="secondary" className="text-sm">
                                {primaryDepartment.name}
                              </Badge>
                              {primaryDepartment.description && (
                                <p className="text-xs text-muted-foreground">
                                  {primaryDepartment.description}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                              No primary department assigned
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Unit Assignment */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Unit Assignment</span>
                        </div>
                        <div className="pl-6">
                          {userUnit ? (
                            <div className="space-y-2">
                              <Badge variant="outline" className="text-sm">
                                {userUnit.name}
                              </Badge>
                              {userUnit.description && (
                                <p className="text-xs text-muted-foreground">
                                  {userUnit.description}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                              No unit assigned
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={profileForm.control}
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
                        control={profileForm.control}
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
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full sm:w-auto" 
                      disabled={profileMutation.isPending}
                    >
                      {profileMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        "Update Profile"
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Password Tab */}
          <TabsContent value="password">
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full sm:w-auto" 
                      disabled={passwordMutation.isPending}
                    >
                      {passwordMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        "Change Password"
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="text-sm text-muted-foreground">
                <p>Your password must be at least 6 characters and should include a mix of letters, numbers, and symbols for better security.</p>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}