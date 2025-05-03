import React from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Department, departmentInsertSchema } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type DepartmentFormValues = z.infer<typeof departmentInsertSchema>;

export default function Departments() {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingDepartment, setEditingDepartment] = React.useState<Department | null>(null);
  const { toast } = useToast();
  
  // Fetch departments
  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['/api/departments'],
    staleTime: 5000
  });
  
  // Create department form
  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentInsertSchema),
    defaultValues: {
      name: '',
      description: ''
    }
  });
  
  // Reset form when dialog is opened/closed
  React.useEffect(() => {
    if (isDialogOpen) {
      if (editingDepartment) {
        form.reset({
          name: editingDepartment.name,
          description: editingDepartment.description
        });
      } else {
        form.reset({
          name: '',
          description: ''
        });
      }
    }
  }, [isDialogOpen, editingDepartment, form]);
  
  // Create department mutation
  const createDepartmentMutation = useMutation({
    mutationFn: async (values: DepartmentFormValues) => {
      if (editingDepartment) {
        // Update existing department
        return apiRequest(`/api/departments/${editingDepartment.id}`, {
          method: 'PATCH',
          body: JSON.stringify(values)
        });
      } else {
        // Create new department
        return apiRequest('/api/departments', {
          method: 'POST',
          body: JSON.stringify(values)
        });
      }
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      // Close dialog and reset form
      setIsDialogOpen(false);
      setEditingDepartment(null);
      form.reset();
      
      toast({
        title: editingDepartment ? 'Department Updated' : 'Department Created',
        description: editingDepartment 
          ? `${form.getValues().name} has been updated.` 
          : `${form.getValues().name} has been added to departments.`,
      });
    },
    onError: (error) => {
      console.error('Failed to save department:', error);
      toast({
        title: 'Error',
        description: 'Failed to save department. Please try again.',
        variant: 'destructive'
      });
    }
  });
  
  // Delete department mutation
  const deleteDepartmentMutation = useMutation({
    mutationFn: async (departmentId: number) => {
      return apiRequest(`/api/departments/${departmentId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      toast({
        title: 'Department Deleted',
        description: 'The department has been removed.'
      });
    },
    onError: (error) => {
      console.error('Failed to delete department:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete department. It may be in use by categories.',
        variant: 'destructive'
      });
    }
  });
  
  const onSubmit = (values: DepartmentFormValues) => {
    createDepartmentMutation.mutate(values);
  };
  
  const handleEditDepartment = (department: Department) => {
    setEditingDepartment(department);
    setIsDialogOpen(true);
  };
  
  const handleDeleteDepartment = (departmentId: number) => {
    if (confirm('Are you sure you want to delete this department? This may affect associated categories.')) {
      deleteDepartmentMutation.mutate(departmentId);
    }
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Departments</h1>
        <Button onClick={() => {
          setEditingDepartment(null);
          setIsDialogOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" /> Add Department
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>All Departments</CardTitle>
          <CardDescription>
            Manage departments that can be assigned to categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-4">Loading departments...</div>
          ) : departments.length === 0 ? (
            <div className="text-center p-4">
              <p className="text-gray-500">No departments found. Create your first department to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((department) => (
                  <TableRow key={department.id}>
                    <TableCell className="font-medium">{department.name}</TableCell>
                    <TableCell className="max-w-xs truncate">{department.description}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditDepartment(department)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDepartment(department.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Department Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingDepartment ? 'Edit Department' : 'Create Department'}
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
                      <Input {...field} placeholder="Department name" />
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
                        placeholder="Department description"
                        rows={4}
                        value={field.value || ''}
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
                  disabled={createDepartmentMutation.isPending}
                >
                  {editingDepartment ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}