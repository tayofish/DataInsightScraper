import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, Save, Edit } from "lucide-react";

// App name form schema
const appNameSchema = z.object({
  appName: z.string().min(1, "Application name is required").max(100, "Application name must be less than 100 characters")
});

type AppNameFormValues = z.infer<typeof appNameSchema>;

export default function AppNameEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  // Form for app name editing
  const form = useForm<AppNameFormValues>({
    resolver: zodResolver(appNameSchema),
    defaultValues: {
      appName: ""
    }
  });

  // Fetch current app name
  const { data: appNameSetting, isLoading: isLoadingAppName } = useQuery({
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
        console.error("Error fetching app name:", error);
        return { value: "Task Management System" }; // Default name
      }
    }
  });

  // Update app name mutation
  const updateAppNameMutation = useMutation({
    mutationFn: async (data: AppNameFormValues) => {
      const res = await fetch("/api/app-settings/app-name", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include"
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update app name");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-settings/app-name"] });
      setIsEditing(false);
      toast({
        title: "App name updated",
        description: "The application name has been updated successfully.",
      });
      
      // Update the document title
      document.title = data.value;
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (values: AppNameFormValues) => {
    updateAppNameMutation.mutate(values);
  };

  // Start editing mode
  const handleEdit = () => {
    setIsEditing(true);
    form.setValue("appName", appNameSetting?.value || "Task Management System");
  };

  // Cancel editing
  const handleCancel = () => {
    setIsEditing(false);
    form.reset();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="mr-2 h-5 w-5" /> Application Name
        </CardTitle>
        <CardDescription>
          Customize the name of your application that appears in the interface and browser title.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current App Name Display */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Current Application Name</h4>
          <div className="border rounded-md p-4 flex items-center justify-between bg-muted/20">
            {isLoadingAppName ? (
              <div className="text-center text-muted-foreground">Loading...</div>
            ) : (
              <div className="font-medium text-lg">
                {appNameSetting?.value || "Task Management System"}
              </div>
            )}
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                className="ml-4"
              >
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Button>
            )}
          </div>
        </div>

        {/* App Name Edit Form */}
        {isEditing && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="appName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Application Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter application name"
                        autoFocus
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateAppNameMutation.isPending}
                >
                  {updateAppNameMutation.isPending ? (
                    <>
                      <span className="animate-spin mr-2">
                        <Save className="h-4 w-4" />
                      </span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" /> Save Name
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}