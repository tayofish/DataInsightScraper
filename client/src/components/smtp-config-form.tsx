import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SmtpConfigFormValues, smtpConfigFormSchema } from '@shared/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail } from 'lucide-react';

export default function SmtpConfigForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch existing SMTP configuration
  const { data: smtpConfig, isLoading } = useQuery({
    queryKey: ['/api/smtp-config'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/smtp-config');
        if (!res.ok) {
          if (res.status === 404) {
            console.log('No SMTP configuration found');
            return null; // No config found
          }
          throw new Error('Failed to fetch SMTP configuration');
        }
        const data = await res.json();
        console.log('SMTP configuration loaded:', data);
        return data;
      } catch (error) {
        console.error('Error fetching SMTP configuration:', error);
        return null;
      }
    }
  });
  
  // Create form with existing data or defaults
  const defaultValues = {
    host: '',
    port: 587,
    username: '',
    password: '',
    fromEmail: '',
    fromName: 'Promellon Notifications',
    enableTls: true,
    active: false,
  };
  
  const form = useForm<SmtpConfigFormValues>({
    resolver: zodResolver(smtpConfigFormSchema),
    defaultValues,
    values: smtpConfig || undefined,
  });
  
  // This ensures the form is updated when the data is loaded
  React.useEffect(() => {
    if (smtpConfig) {
      form.reset({
        ...smtpConfig,
        // Don't display the password for security reasons
        password: smtpConfig.password ? '••••••••' : '',
      });
    }
  }, [smtpConfig, form]);
  
  // Mutation to save SMTP configuration
  const saveConfigMutation = useMutation({
    mutationFn: async (data: SmtpConfigFormValues) => {
      const method = data.id ? 'PUT' : 'POST';
      const url = data.id ? `/api/smtp-config/${data.id}` : '/api/smtp-config';
      return apiRequest(method, url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/smtp-config'] });
      toast({
        title: 'SMTP Configuration Saved',
        description: 'Your email notification settings have been updated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to save SMTP configuration: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
  
  // Mutation to test SMTP configuration
  const testConfigMutation = useMutation({
    mutationFn: async (data: SmtpConfigFormValues) => {
      return apiRequest('POST', '/api/smtp-config/test', data);
    },
    onSuccess: () => {
      toast({
        title: 'Test Email Sent',
        description: 'A test email has been sent. Please check your inbox.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to send test email: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
  
  function onSubmit(data: SmtpConfigFormValues) {
    saveConfigMutation.mutate(data);
  }
  
  function onTest() {
    const values = form.getValues();
    testConfigMutation.mutate(values);
  }
  
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl flex items-center">
            <Mail className="mr-2 h-5 w-5" /> Loading SMTP Configuration...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl flex items-center">
          <Mail className="mr-2 h-5 w-5" /> SMTP Configuration
        </CardTitle>
        <CardDescription>
          Configure email notifications for task activities, user mentions, and system events.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMTP Host</FormLabel>
                    <FormControl>
                      <Input placeholder="smtp.example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="port"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMTP Port</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="587" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMTP Username</FormLabel>
                    <FormControl>
                      <Input placeholder="username@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMTP Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fromEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Email</FormLabel>
                    <FormControl>
                      <Input placeholder="notifications@example.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      The email address that will appear in the "From" field.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="fromName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Promellon Notifications" {...field} />
                    </FormControl>
                    <FormDescription>
                      The name that will appear in the "From" field.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="enableTls"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Enable TLS</FormLabel>
                      <FormDescription>
                        Use TLS encryption for secure email transmission (recommended).
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Enable Email Notifications</FormLabel>
                      <FormDescription>
                        Activate email notifications for task activities and system events.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onTest}
              disabled={testConfigMutation.isPending}
            >
              {testConfigMutation.isPending ? "Sending Test..." : "Send Test Email"}
            </Button>
            <Button 
              type="submit" 
              disabled={saveConfigMutation.isPending}
            >
              {saveConfigMutation.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}