import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { type Category } from '@shared/schema';

// Form schema for category creation/editing
const categoryFormSchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color'),
  departmentId: z.number().optional().nullable(), // Make departmentId optional and nullable
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export default function Categories() {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [currentCategory, setCurrentCategory] = React.useState<Category | null>(null);

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  // Create/Update category mutation
  const categoryMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      if (currentCategory) {
        return apiRequest('PATCH', `/api/categories/${currentCategory.id}`, values);
      } else {
        return apiRequest('POST', '/api/categories', values);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({
        title: `Category ${currentCategory ? 'updated' : 'created'}`,
        description: `Category has been ${currentCategory ? 'updated' : 'created'} successfully.`,
      });
      handleCloseForm();
    },
    onError: (err) => {
      toast({
        title: 'Error',
        description: `Failed to ${currentCategory ? 'update' : 'create'} category: ${err}`,
        variant: 'destructive',
      });
    }
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: number) => {
      return apiRequest('DELETE', `/api/categories/${categoryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({
        title: 'Category deleted',
        description: 'Category has been deleted successfully.',
      });
    },
    onError: (err) => {
      toast({
        title: 'Error',
        description: `Failed to delete category: ${err}`,
        variant: 'destructive',
      });
    }
  });

  // Form for creating/editing categories
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: '',
      color: '#3b82f6',
      departmentId: null,
    }
  });

  // Open form for creating a new category
  const handleOpenNewForm = () => {
    form.reset({
      name: '',
      color: '#3b82f6',
      department: '', // Empty by default - will be categorized under "General"
    });
    setCurrentCategory(null);
    setIsFormOpen(true);
  };

  // Open form for editing a category
  const handleEditCategory = (category: Category) => {
    form.reset({
      name: category.name,
      color: category.color || '#3b82f6',
      department: category.department ?? '', // Use null coalescing to handle null properly
    });
    setCurrentCategory(category);
    setIsFormOpen(true);
  };

  // Close the form
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setCurrentCategory(null);
  };

  // Handle form submission
  const onSubmit = (values: CategoryFormValues) => {
    // If department is an empty string, set it to null
    const formattedValues = {
      ...values,
      department: values.department?.trim() === '' ? null : values.department?.trim() || null
    };
    
    categoryMutation.mutate(formattedValues);
  };

  // Group categories by department
  const categoriesByDepartment = React.useMemo(() => {
    const grouped: Record<string, Category[]> = {};
    
    categories.forEach(category => {
      const dept = category.department || 'General';
      if (!grouped[dept]) {
        grouped[dept] = [];
      }
      grouped[dept].push(category);
    });
    
    // Make sure General appears first in the order
    const orderedGrouped: Record<string, Category[]> = {};
    if (grouped['General']) {
      orderedGrouped['General'] = grouped['General'];
    }
    
    // Add all other departments in alphabetical order
    Object.keys(grouped)
      .filter(dept => dept !== 'General')
      .sort()
      .forEach(dept => {
        orderedGrouped[dept] = grouped[dept];
      });
    
    return orderedGrouped;
  }, [categories]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>Loading categories...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Categories</CardTitle>
            <CardDescription>
              Manage task categories with optional department grouping
            </CardDescription>
          </div>
          <Button onClick={handleOpenNewForm} className="ml-auto">
            <Plus className="mr-2 h-4 w-4" /> Add Category
          </Button>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-center text-gray-500 mb-4">No categories have been created yet.</p>
              <Button onClick={handleOpenNewForm}>
                <Plus className="mr-2 h-4 w-4" /> Create Your First Category
              </Button>
            </div>
          ) : (
            <>
              {Object.entries(categoriesByDepartment).map(([department, departmentCategories]) => (
                <div key={department} className="mb-8">
                  <h3 className="text-lg font-medium mb-2">{department}</h3>
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Color</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {departmentCategories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell>
                              <div
                                className="w-8 h-8 rounded-full"
                                style={{ backgroundColor: category.color || '#6b7280' }}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{category.name}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditCategory(category)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Category</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete this category. Tasks will no longer be associated with this category.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteCategoryMutation.mutate(category.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Category Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentCategory ? 'Edit Category' : 'Create Category'}</DialogTitle>
            <DialogDescription>
              {currentCategory
                ? 'Update the details of this category.'
                : 'Create a new category for organizing tasks.'}
            </DialogDescription>
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
                      <Input placeholder="Category name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => {
                  // Handle the field value to ensure it's a string
                  const inputValue = field.value === null ? '' : field.value;
                  
                  return (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Department" 
                          value={inputValue}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional: Categorize by department (e.g., Marketing, Engineering, Finance)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <div className="flex items-center gap-4">
                      <Input
                        type="color"
                        className="w-12 h-12 p-1 rounded-md"
                        {...field}
                      />
                      <Input
                        type="text"
                        placeholder="#3b82f6"
                        {...field}
                        className="flex-1"
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseForm}
                  disabled={categoryMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={categoryMutation.isPending}
                >
                  {categoryMutation.isPending
                    ? 'Saving...'
                    : currentCategory
                      ? 'Update Category'
                      : 'Create Category'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}