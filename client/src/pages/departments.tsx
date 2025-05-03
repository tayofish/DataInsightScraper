import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Department, type InsertDepartment, departmentInsertSchema } from '@shared/schema';
import { z } from 'zod';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle, Edit, Trash2, Building2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type DepartmentFormValues = z.infer<typeof departmentInsertSchema>;

export default function Departments() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const { toast } = useToast();

  // Fetch departments
  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['/api/departments'],
    queryFn: () => apiRequest<Department[]>('/api/departments')
  });

  // Create department mutation
  const createMutation = useMutation({
    mutationFn: async (values: DepartmentFormValues) => {
      return apiRequest<Department>('/api/departments', {
        method: 'POST',
        body: JSON.stringify(values)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      toast({
        title: 'Department created',
        description: 'The department has been successfully created.',
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create department: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Update department mutation
  const updateMutation = useMutation({
    mutationFn: async (values: DepartmentFormValues & { id: number }) => {
      const { id, ...departmentData } = values;
      return apiRequest<Department>(`/api/departments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(departmentData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      toast({
        title: 'Department updated',
        description: 'The department has been successfully updated.',
      });
      setIsDialogOpen(false);
      setSelectedDepartment(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update department: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Delete department mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/departments/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      toast({
        title: 'Department deleted',
        description: 'The department has been successfully deleted.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete department: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Define form
  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentInsertSchema),
    defaultValues: {
      name: '',
      description: ''
    }
  });

  // Handle form submit
  const onSubmit = (values: DepartmentFormValues) => {
    if (selectedDepartment) {
      updateMutation.mutate({ ...values, id: selectedDepartment.id });
    } else {
      createMutation.mutate(values);
    }
  };

  // Open department form for editing
  const handleEditDepartment = (department: Department) => {
    setSelectedDepartment(department);
    form.reset({
      name: department.name,
      description: department.description || ''
    });
    setIsDialogOpen(true);
  };

  // Open new department form
  const handleNewDepartment = () => {
    setSelectedDepartment(null);
    form.reset({
      name: '',
      description: ''
    });
    setIsDialogOpen(true);
  };

  // Handle department deletion
  const handleDeleteDepartment = (id: number) => {
    if (confirm('Are you sure you want to delete this department? This action cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Departments</h1>
        <Button onClick={handleNewDepartment}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Department
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : departments.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">No departments</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new department.</p>
          <div className="mt-6">
            <Button onClick={handleNewDepartment}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Department
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((department) => (
            <Card key={department.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">{department.name}</CardTitle>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditDepartment(department)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDepartment(department.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  {department.description || 'No description provided.'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Department form dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDepartment ? 'Edit Department' : 'Create Department'}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter department name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter department description"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={createMutation.isPending || updateMutation.isPending}
                >
                  {selectedDepartment ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}