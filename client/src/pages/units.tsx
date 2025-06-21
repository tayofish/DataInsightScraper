import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Pencil, Plus, Trash2, Search, ChevronLeft, ChevronRight, Users, Building } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';

// Department form schema (treating departments as units)
const unitFormSchema = z.object({
  name: z.string().min(2, "Unit name must be at least 2 characters"),
  description: z.string().optional(),
  departmentHeadId: z.string().optional()
});

type UnitFormValues = z.infer<typeof unitFormSchema>;

export default function Units() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const itemsPerPage = 10;

  const { toast } = useToast();

  // Fetch units data (from what was originally departments table)
  const { data: units = [], isLoading: unitsLoading } = useQuery({
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
      departmentHeadId: "none"
    }
  });

  // Filter units based on search query
  const filteredUnits = (units as any[] || []).filter((unit: any) =>
    unit.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    unit.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredUnits.length / itemsPerPage);
  const paginatedUnits = filteredUnits.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Create/update unit mutation
  const createUnitMutation = useMutation({
    mutationFn: async (values: UnitFormValues) => {
      const processedValues = {
        name: values.name,
        description: values.description || "",
        departmentHeadId: values.departmentHeadId === "none" ? "none" : values.departmentHeadId || "none"
      };

      if (editingUnit) {
        return await apiRequest('PATCH', `/api/departments/${editingUnit.id}`, processedValues);
      } else {
        return await apiRequest('POST', '/api/departments', processedValues);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/departments'] });
      form.reset();
      setIsCreateDialogOpen(false);
      setEditingUnit(null);
      toast({
        title: "Success",
        description: editingUnit ? "Unit updated successfully" : "Unit created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${editingUnit ? 'update' : 'create'} unit`,
        variant: "destructive",
      });
    },
  });

  // Delete unit mutation
  const deleteUnitMutation = useMutation({
    mutationFn: async (unitId: number) => {
      return await apiRequest('DELETE', `/api/units/${unitId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/units'] });
      toast({
        title: "Success",
        description: "Unit deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete unit",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: UnitFormValues) => {
    createUnitMutation.mutate(values);
  };

  const handleEdit = (unit: any) => {
    setEditingUnit(unit);
    form.reset({
      name: unit.name || '',
      description: unit.description || '',
      departmentHeadId: unit.departmentHeadId ? unit.departmentHeadId.toString() : "none"
    });
    setIsCreateDialogOpen(true);
  };

  const handleDelete = (unitId: number) => {
    deleteUnitMutation.mutate(unitId);
  };

  const getUserName = (userId: number | null) => {
    if (!userId) return 'Not assigned';
    const user = users.find(u => u.id === userId);
    return user ? user.name : 'Unknown User';
  };

  const resetForm = () => {
    form.reset();
    setEditingUnit(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Units Management</h1>
          <p className="text-muted-foreground">
            Manage organizational units and assign unit heads
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Unit
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingUnit ? 'Edit Unit' : 'Create New Unit'}</DialogTitle>
              <DialogDescription>
                {editingUnit ? 'Update the unit information below.' : 'Fill in the information to create a new unit.'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter unit name" {...field} />
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
                          placeholder="Enter unit description (optional)" 
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="departmentHeadId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Head</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value || "none"}
                          onValueChange={field.onChange}
                          options={[
                            { value: "none", label: "No unit head assigned" },
                            ...users.map(user => ({
                              value: user.id.toString(),
                              label: user.name
                            }))
                          ]}
                          placeholder="Select unit head"
                          emptyMessage="No users found"
                          searchPlaceholder="Search users..."
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
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createUnitMutation.isPending}
                  >
                    {createUnitMutation.isPending ? 'Saving...' : (editingUnit ? 'Update Unit' : 'Create Unit')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Units
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search by unit name or description..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1); // Reset to first page when searching
            }}
            className="max-w-sm"
          />
        </CardContent>
      </Card>

      {/* Units Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Units ({filteredUnits.length})
          </CardTitle>
          <CardDescription>
            List of all organizational units and their assigned heads
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unitsLoading ? (
            <div className="text-center py-8">Loading units...</div>
          ) : filteredUnits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No units found matching your search.' : 'No units found. Create your first unit to get started.'}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Unit Head</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUnits.map((unit: any) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.name}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {unit.description || 'No description'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {getUserName(unit.unitHeadId)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {unit.createdAt ? new Date(unit.createdAt).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(unit)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Unit</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{unit.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(unit.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between space-x-2 py-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredUnits.length)} of {filteredUnits.length} units
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {currentPage} of {totalPages}
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
    </div>
  );
}