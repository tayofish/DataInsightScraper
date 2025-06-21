import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Department, departmentInsertSchema } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, Plus, Trash2, Search, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';

// Custom form schema that handles string values from Select components
const departmentFormSchema = z.object({
  name: z.string().min(2, "Department name must be at least 2 characters"),
  description: z.string().optional(),
  departmentHeadId: z.string().optional()
});

type DepartmentFormValues = z.infer<typeof departmentFormSchema>;

export default function Departments() {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingDepartment, setEditingDepartment] = React.useState<Department | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();
  
  // Fetch departments
  const { data: departments = [] as Department[], isLoading } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
    select: (data) => {
      console.log('Departments API response:', data);
      return data;
    }
  });

  // Fetch users for unit head selection
  const { data: users = [] } = useQuery<Array<{id: number, username: string, name: string}>>({
    queryKey: ['/api/users']
  });

  // Note: Departments are the primary organizational structure
  
  // Create department form
  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: '',
      description: '',
      departmentHeadId: "none"
    }
  });
  
  // Reset form when dialog is opened/closed
  React.useEffect(() => {
    if (isDialogOpen) {
      if (editingDepartment) {
        form.reset({
          name: editingDepartment.name,
          description: editingDepartment.description || "",
          departmentHeadId: editingDepartment.departmentHeadId?.toString() || "none"
        });

      } else {
        form.reset({
          name: '',
          description: '',
          departmentHeadId: "none"
        });

      }
    }
  }, [isDialogOpen, editingDepartment, form]);
  
  // Create department mutation
  const createDepartmentMutation = useMutation({
    mutationFn: async (values: DepartmentFormValues) => {
      console.log('Form submission data:', values);
      
      // Handle department head selection - convert "none" to null
      const processedValues = {
        ...values,
        departmentHeadId: values.departmentHeadId === "none" ? null : values.departmentHeadId ? parseInt(values.departmentHeadId) : null
      };

      console.log('Processed values:', processedValues);
      
      if (editingDepartment) {
        // Update existing department
        return await apiRequest('PUT', `/api/departments/${editingDepartment.id}`, processedValues);
      } else {
        // Create new department
        return await apiRequest('POST', '/api/departments', processedValues);
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
      console.error('Failed to save unit:', error);
      toast({
        title: 'Error',
        description: 'Failed to save unit. Please try again.',
        variant: 'destructive'
      });
    }
  });
  
  // Delete department mutation
  const deleteDepartmentMutation = useMutation({
    mutationFn: async (departmentId: number) => {
      return apiRequest('DELETE', `/api/departments/${departmentId}`);
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
    console.log('onSubmit function called with values:', values);
    console.log('Form errors during submission:', form.formState.errors);
    
    createDepartmentMutation.mutate(values);
  };

  const onFormError = (errors: any) => {
    console.log('Form validation errors:', errors);
    console.log('Current form values:', form.getValues());
    console.log('Form state:', form.formState);
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

  // Filter and paginate departments based on search query
  const filteredDepartments = useMemo(() => {
    return departments.filter(department =>
      department.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (department.description && department.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [departments, searchQuery]);

  // Paginated departments
  const paginatedDepartments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredDepartments.slice(startIndex, endIndex);
  }, [filteredDepartments, currentPage, itemsPerPage]);

  // Calculate total pages
  const totalPages = Math.ceil(filteredDepartments.length / itemsPerPage);

  // Reset to first page when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);
  
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
            Manage departments and their organizational structure
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
            <>
              {/* Search Bar */}
              <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search units..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="text-sm text-gray-500">
                  {filteredDepartments.length} of {departments.length} departments
                </div>
              </div>

              {/* Departments Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Department Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[150px]">Department Head</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDepartments.map((department) => {
                    const departmentHead = department.departmentHeadId ? users.find(u => u.id === department.departmentHeadId) : null;
                    return (
                      <TableRow key={department.id}>
                        <TableCell className="font-medium">{department.name}</TableCell>
                        <TableCell className="max-w-xs truncate">{department.description}</TableCell>
                        <TableCell>
                          {departmentHead ? (
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4 text-blue-500" />
                              <span className="text-sm">{departmentHead.name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No department head</span>
                          )}
                        </TableCell>
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
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-500">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredDepartments.length)} of {filteredDepartments.length} results
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="w-8"
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
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
            <form onSubmit={form.handleSubmit(onSubmit, onFormError)} className="space-y-4">
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

              {/* Department Head Selection */}
              <FormField
                control={form.control}
                name="departmentHeadId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>Department Head</span>
                    </FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={[
                          { value: "none", label: "No Department Head" },
                          ...users.map(user => ({ 
                            value: user.id.toString(), 
                            label: `${user.name} (${user.username})` 
                          }))
                        ]}
                        value={field.value || "none"}
                        onValueChange={field.onChange}
                        placeholder="Select a department head (optional)"
                        searchPlaceholder="Search users..."
                        emptyText="No users found"
                      />
                    </FormControl>
                    <FormDescription>
                      Department heads oversee multiple units and receive consolidated email summaries
                    </FormDescription>
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