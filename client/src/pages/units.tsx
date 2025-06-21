import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, Plus, Trash2, Search, ChevronLeft, ChevronRight, Users, Building } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';

// Unit form schema
const unitFormSchema = z.object({
  name: z.string().min(2, "Unit name must be at least 2 characters"),
  description: z.string().optional(),
  unitHeadId: z.string().optional(),
  departmentId: z.string().min(1, "Department is required")
});

type UnitFormValues = z.infer<typeof unitFormSchema>;

export default function Units() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const itemsPerPage = 10;

  const { toast } = useToast();

  // Fetch units with departments
  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['/api/units']
  });

  // Fetch departments for selection
  const { data: departments = [] } = useQuery({
    queryKey: ['/api/departments']
  });

  // Fetch users for unit head selection
  const { data: users = [] } = useQuery<Array<{id: number, username: string, name: string}>>({
    queryKey: ['/api/users']
  });

  // Create unit form
  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: {
      name: '',
      description: '',
      unitHeadId: "none",
      departmentId: ""
    }
  });

  // Filter units based on search query
  const filteredUnits = units.filter((unit: any) =>
    unit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    unit.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredUnits.length / itemsPerPage);
  const paginatedUnits = filteredUnits.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Create unit mutation
  const createUnitMutation = useMutation({
    mutationFn: async (values: UnitFormValues) => {
      console.log('Form submission data:', values);
      
      // Handle unit head selection - convert "none" to null
      const processedValues = {
        ...values,
        unitHeadId: values.unitHeadId === "none" ? null : values.unitHeadId ? parseInt(values.unitHeadId) : null,
        departmentId: parseInt(values.departmentId)
      };

      console.log('Processed values:', processedValues);

      let unitResponse;
      
      if (editingUnit) {
        // Update existing unit
        unitResponse = await apiRequest('PATCH', `/api/units/${editingUnit.id}`, processedValues);
      } else {
        // Create new unit
        unitResponse = await apiRequest('POST', '/api/units', processedValues);
      }

      return unitResponse;
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['/api/units'] });
      // Close dialog and reset form
      setIsDialogOpen(false);
      setEditingUnit(null);
      form.reset();
      
      toast({
        title: editingUnit ? 'Unit Updated' : 'Unit Created',
        description: editingUnit 
          ? `${form.getValues().name} has been updated.` 
          : `${form.getValues().name} has been added to units.`,
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

  // Delete unit mutation
  const deleteUnitMutation = useMutation({
    mutationFn: async (unitId: number) => {
      return apiRequest('DELETE', `/api/units/${unitId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/units'] });
      toast({
        title: 'Unit Deleted',
        description: 'The unit has been removed.'
      });
    },
    onError: (error) => {
      console.error('Failed to delete unit:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete unit. It may be in use by tasks.',
        variant: 'destructive'
      });
    }
  });
  
  const onSubmit = (values: UnitFormValues) => {
    console.log('onSubmit function called with values:', values);
    console.log('Form errors during submission:', form.formState.errors);
    
    createUnitMutation.mutate(values);
  };

  const onFormError = (errors: any) => {
    console.log('Form validation errors:', errors);
    console.log('Current form values:', form.getValues());
    console.log('Form state:', form.formState);
  };
  
  const handleEditUnit = (unit: any) => {
    setEditingUnit(unit);
    form.reset({
      name: unit.name,
      description: unit.description || '',
      unitHeadId: unit.unitHeadId ? unit.unitHeadId.toString() : "none",
      departmentId: unit.departmentId.toString()
    });
    setIsDialogOpen(true);
  };
  
  const handleDeleteUnit = (unitId: number) => {
    if (confirm('Are you sure you want to delete this unit? This may affect associated tasks.')) {
      deleteUnitMutation.mutate(unitId);
    }
  };

  if (unitsLoading) {
    return <div>Loading units...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Units Management</h1>
          <p className="text-muted-foreground">
            Manage organizational units within departments
          </p>
        </div>
        <Button onClick={() => {
          setEditingUnit(null);
          form.reset();
          setIsDialogOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Unit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building className="h-5 w-5" />
            <span>Units Overview</span>
          </CardTitle>
          <CardDescription>
            Units are organizational subdivisions within departments, each with their own unit head
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and filters */}
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search units..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="text-sm text-gray-500">
                {filteredUnits.length} of {units.length} units
              </div>
            </div>

            {/* Units Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Unit Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[150px]">Unit Head</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUnits.map((unit: any) => {
                  const unitHead = unit.unitHeadId ? users.find(u => u.id === unit.unitHeadId) : null;
                  const department = departments.find(d => d.id === unit.departmentId);
                  return (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Building className="h-4 w-4 text-gray-500" />
                          <span>{department?.name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{unit.description}</TableCell>
                      <TableCell>
                        {unitHead ? (
                          <div className="flex items-center space-x-2">
                            <Users className="h-4 w-4 text-blue-500" />
                            <span className="text-sm">{unitHead.name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No unit head</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUnit(unit)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUnit(unit.id)}
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
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredUnits.length)} of {filteredUnits.length} results
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
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
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
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Unit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingUnit ? 'Edit Unit' : 'Add New Unit'}</DialogTitle>
            <DialogDescription>
              {editingUnit ? 'Update the unit information below.' : 'Create a new organizational unit within a department.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onFormError)} className="space-y-4">
              {/* Unit Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Marketing Team" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of the unit's purpose"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Department Selection */}
              <FormField
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center space-x-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span>Department</span>
                    </FormLabel>
                    <SearchableSelect
                      options={departments.map(dept => ({ 
                        value: dept.id.toString(), 
                        label: dept.name 
                      }))}
                      value={field.value || ""}
                      onValueChange={field.onChange}
                      placeholder="Select a department"
                      searchPlaceholder="Search departments..."
                      emptyText="No departments found"
                    />
                    <FormDescription>
                      The department this unit belongs to
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Unit Head Selection */}
              <FormField
                control={form.control}
                name="unitHeadId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>Unit Head</span>
                    </FormLabel>
                    <SearchableSelect
                      options={[
                        { value: "none", label: "No Unit Head" },
                        ...users.map(user => ({ 
                          value: user.id.toString(), 
                          label: `${user.name} (${user.username})` 
                        }))
                      ]}
                      value={field.value || "none"}
                      onValueChange={field.onChange}
                      placeholder="Select a unit head (optional)"
                      searchPlaceholder="Search users..."
                      emptyText="No users found"
                    />
                    <FormDescription>
                      Unit heads receive daily email summaries for their assigned units
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
                  disabled={createUnitMutation.isPending}
                >
                  {editingUnit ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}