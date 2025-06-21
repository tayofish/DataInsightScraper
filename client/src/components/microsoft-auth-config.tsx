import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Save, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

const microsoftAuthSchema = z.object({
  enabled: z.boolean(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  tenantId: z.string().optional(),
  approvalRequired: z.boolean().default(true),
  allowedDomains: z.string().optional(),
  autoCreateUsers: z.boolean().default(false)
});

type MicrosoftAuthFormValues = z.infer<typeof microsoftAuthSchema>;

export default function MicrosoftAuthConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Fetch current Microsoft auth settings
  const { data: authSettings, isLoading } = useQuery({
    queryKey: ["/api/app-settings/auth/microsoft"],
    queryFn: async () => {
      const res = await fetch("/api/app-settings/auth/microsoft");
      if (!res.ok) throw new Error("Failed to fetch Microsoft auth settings");
      return res.json();
    }
  });

  const form = useForm<MicrosoftAuthFormValues>({
    resolver: zodResolver(microsoftAuthSchema),
    defaultValues: {
      enabled: authSettings?.enabled || false,
      clientId: authSettings?.clientId || "",
      clientSecret: authSettings?.clientSecret || "",
      tenantId: authSettings?.tenantId || "",
      approvalRequired: authSettings?.approvalRequired !== false,
      allowedDomains: authSettings?.allowedDomains || "",
      autoCreateUsers: authSettings?.autoCreateUsers || false
    }
  });

  // Update form values when data loads
  useState(() => {
    if (authSettings) {
      form.reset({
        enabled: authSettings.enabled || false,
        clientId: authSettings.clientId || "",
        clientSecret: authSettings.clientSecret || "",
        tenantId: authSettings.tenantId || "",
        approvalRequired: authSettings.approvalRequired !== false,
        allowedDomains: authSettings.allowedDomains || "",
        autoCreateUsers: authSettings.autoCreateUsers || false
      });
    }
  }, [authSettings, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: MicrosoftAuthFormValues) => {
      return apiRequest("/api/app-settings/auth/microsoft", {
        method: "POST",
        body: JSON.stringify(values)
      });
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Microsoft authentication settings have been updated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/app-settings/auth/microsoft"] });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save Microsoft authentication settings.",
        variant: "destructive"
      });
    }
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const values = form.getValues();
      return apiRequest("/api/auth/microsoft/test", {
        method: "POST",
        body: JSON.stringify({
          clientId: values.clientId,
          clientSecret: values.clientSecret,
          tenantId: values.tenantId
        })
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Connection Test Successful",
        description: "Microsoft authentication configuration is valid and working."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Test Failed",
        description: error.message || "Failed to connect to Microsoft authentication service.",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (values: MicrosoftAuthFormValues) => {
    saveMutation.mutate(values);
  };

  const handleTestConnection = () => {
    setIsTestingConnection(true);
    testConnectionMutation.mutate();
    setTimeout(() => setIsTestingConnection(false), 2000);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Microsoft Authentication</CardTitle>
          <CardDescription>Configure Microsoft Entra ID (Azure AD) authentication</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Microsoft Authentication
          <ExternalLink className="h-4 w-4" />
        </CardTitle>
        <CardDescription>
          Configure Microsoft Entra ID (Azure AD) authentication for your organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Enable Microsoft Auth */}
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Enable Microsoft Authentication</FormLabel>
                    <FormDescription>
                      Allow users to sign in with their Microsoft accounts
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch("enabled") && (
              <>
                <Separator />
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Azure AD App Registration Required</AlertTitle>
                  <AlertDescription>
                    You need to register an application in Azure AD and configure the redirect URI: 
                    <code className="ml-1 bg-muted px-1 py-0.5 rounded">
                      {window.location.origin}/auth/microsoft/callback
                    </code>
                  </AlertDescription>
                </Alert>

                {/* Client ID */}
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application (Client) ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="00000000-0000-0000-0000-000000000000"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The Application (Client) ID from your Azure AD app registration
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Client Secret */}
                <FormField
                  control={form.control}
                  name="clientSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Secret</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter client secret"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The client secret value from your Azure AD app registration
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tenant ID */}
                <FormField
                  control={form.control}
                  name="tenantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Directory (Tenant) ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="00000000-0000-0000-0000-000000000000"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The Directory (Tenant) ID from your Azure AD tenant
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Approval Required */}
                <FormField
                  control={form.control}
                  name="approvalRequired"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Admin Approval Required</FormLabel>
                        <FormDescription>
                          New Microsoft users must be approved by an admin before access
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Auto Create Users */}
                <FormField
                  control={form.control}
                  name="autoCreateUsers"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Auto-Create User Accounts</FormLabel>
                        <FormDescription>
                          Automatically create user accounts for new Microsoft sign-ins
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Allowed Domains */}
                <FormField
                  control={form.control}
                  name="allowedDomains"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Allowed Email Domains (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="example.com, company.org"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Comma-separated list of email domains allowed to authenticate. Leave empty to allow all domains.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Test Connection Button */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={isTestingConnection || testConnectionMutation.isPending}
                  >
                    {(isTestingConnection || testConnectionMutation.isPending) ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing Connection...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            <Separator />

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}