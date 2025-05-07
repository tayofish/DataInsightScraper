import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Form, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormMessage 
} from '@/components/ui/form';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { AvatarField } from './ui/avatar-field';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { taskFormSchema, type TaskFormValues, type Task, type Project, type Category, type Department } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import TaskUpdateHistory from './task-update-history';

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
}

export default function TaskForm({ isOpen, onClose, task }: TaskFormProps) {
  const { toast } = useToast();
  const isEditMode = !!task;

  // Get projects for select dropdown
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });
  
  // Get categories for select dropdown
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });
  
  // Get departments for categorizing
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
  });

  // Setup form with default values
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      id: task?.id,
      title: task?.title || '',
      description: task?.description || '',
      dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      priority: task?.priority || 'medium',
      status: task?.status || 'todo',
      projectId: task?.projectId || null,
      assigneeId: task?.assigneeId || null,
      categoryId: task?.categoryId || null,
    },
  });

  // Create/Update task mutation
  const taskMutation = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      // Clean up data for API submission - ensure proper types for backend
      const processedValues = {
        ...values,
        // Convert empty strings to null for optional fields
        description: values.description?.trim() === '' ? null : values.description,
        dueDate: values.dueDate?.trim() === '' ? null : values.dueDate,
        // Ensure numerical fields are properly handled
        projectId: values.projectId === undefined ? null : values.projectId,
        assigneeId: values.assigneeId === undefined ? null : values.assigneeId,
        categoryId: values.categoryId === undefined ? null : values.categoryId
      };
      
      if (isEditMode && task) {
        return apiRequest('PATCH', `/api/tasks/${task.id}`, processedValues);
      } else {
        return apiRequest('POST', '/api/tasks', processedValues);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/statistics'] });
      toast({
        title: isEditMode ? "Task updated" : "Task created",
        description: isEditMode 
          ? "Task has been updated successfully." 
          : "Task has been created successfully.",
      });
      onClose();
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: `Failed to ${isEditMode ? 'update' : 'create'} task: ${err}`,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (values: TaskFormValues) => {
    // Directly submit the values, processing happens in the mutation function
    taskMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Task' : 'Create New Task'}</DialogTitle>
          <p className="text-sm text-gray-500 mt-2">
            {isEditMode ? 'Edit task details below.' : 'Fill out the form below to create a new task.'}
          </p>
        </DialogHeader>
        
        {isEditMode && task?.id ? (
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Task Details</TabsTrigger>
              <TabsTrigger value="history">History & Updates</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details">
              <div className="py-2">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Task Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter task title..." {...field} />
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
                              placeholder="Describe the task..." 
                              rows={3} 
                              {...field} 
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="dueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Due Date</FormLabel>
                            <FormControl>
                              <Input 
                                type="date" 
                                {...field} 
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="projectId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Project</FormLabel>
                            <Select
                              value={field.value?.toString() || '-1'}
                              onValueChange={(value) => {
                                if (value === '-1') {
                                  field.onChange(null);
                                } else {
                                  field.onChange(parseInt(value));
                                }
                              }}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select project" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="-1">No Project</SelectItem>
                                {projects.map((project) => (
                                  <SelectItem key={project.id} value={project.id.toString()}>
                                    {project.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <AvatarField
                        control={form.control}
                        name="assigneeId"
                        label="Assign To"
                        placeholder="Select assignee"
                        includeUnassigned
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="todo">To Do</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="categoryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select
                              value={field.value?.toString() || '-1'}
                              onValueChange={(value) => {
                                if (value === '-1') {
                                  field.onChange(null);
                                } else {
                                  field.onChange(parseInt(value));
                                }
                              }}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="-1">No Category</SelectItem>
                                
                                {(() => {
                                  // Create a map of departments to categories
                                  const departmentMap: Record<string, typeof categories> = {};
                                  const departmentsById: Record<number, string> = {};
                                  
                                  // Create a mapping of department IDs to names
                                  departments.forEach((dept: Department) => {
                                    departmentsById[dept.id] = dept.name;
                                  });
                                  
                                  categories.forEach(category => {
                                    const deptName = category.departmentId 
                                      ? (departmentsById[category.departmentId] || 'Unknown') 
                                      : 'General';
                                    
                                    if (!departmentMap[deptName]) {
                                      departmentMap[deptName] = [];
                                    }
                                    departmentMap[deptName].push(category);
                                  });
                                  
                                  // Return the grouped categories
                                  return Object.entries(departmentMap).map(([department, deptCategories]) => (
                                    <React.Fragment key={department}>
                                      <SelectItem value={`dept_${department}`} disabled className="text-xs font-bold uppercase text-gray-500 py-1">
                                        {department}
                                      </SelectItem>
                                      {deptCategories.map((category) => (
                                        <SelectItem key={category.id} value={category.id.toString()} className="pl-6">
                                          <div className="flex items-center">
                                            <div 
                                              className="w-3 h-3 rounded-full mr-2" 
                                              style={{ backgroundColor: category.color || '#6b7280' }}
                                            />
                                            {category.name}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </React.Fragment>
                                  ));
                                })()}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <DialogFooter>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={onClose}
                        disabled={taskMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        disabled={taskMutation.isPending}
                      >
                        {taskMutation.isPending 
                          ? 'Saving...' 
                          : 'Update Task'
                        }
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </div>
            </TabsContent>
            
            <TabsContent value="history">
              <div className="py-2">
                <TaskUpdateHistory taskId={task.id} />
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter task title..." {...field} />
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
                        placeholder="Describe the task..." 
                        rows={3} 
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select
                        value={field.value?.toString() || '-1'}
                        onValueChange={(value) => {
                          if (value === '-1') {
                            field.onChange(null);
                          } else {
                            field.onChange(parseInt(value));
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="-1">No Project</SelectItem>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id.toString()}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <AvatarField
                  control={form.control}
                  name="assigneeId"
                  label="Assign To"
                  placeholder="Select assignee"
                  includeUnassigned
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isEditMode && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        value={field.value?.toString() || '-1'}
                        onValueChange={(value) => {
                          if (value === '-1') {
                            field.onChange(null);
                          } else {
                            field.onChange(parseInt(value));
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="-1">No Category</SelectItem>
                          
                          {(() => {
                            // Create a map of departments to categories
                            const departmentMap: Record<string, typeof categories> = {};
                            const departmentsById: Record<number, string> = {};
                            
                            // Create a mapping of department IDs to names
                            departments.forEach((dept: Department) => {
                              departmentsById[dept.id] = dept.name;
                            });
                            
                            categories.forEach(category => {
                              const deptName = category.departmentId 
                                ? (departmentsById[category.departmentId] || 'Unknown') 
                                : 'General';
                              
                              if (!departmentMap[deptName]) {
                                departmentMap[deptName] = [];
                              }
                              departmentMap[deptName].push(category);
                            });
                            
                            // Return the grouped categories
                            return Object.entries(departmentMap).map(([department, deptCategories]) => (
                              <React.Fragment key={department}>
                                <SelectItem value={`dept_${department}`} disabled className="text-xs font-bold uppercase text-gray-500 py-1">
                                  {department}
                                </SelectItem>
                                {deptCategories.map((category) => (
                                  <SelectItem key={category.id} value={category.id.toString()} className="pl-6">
                                    <div className="flex items-center">
                                      <div 
                                        className="w-3 h-3 rounded-full mr-2" 
                                        style={{ backgroundColor: category.color || '#6b7280' }}
                                      />
                                      {category.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </React.Fragment>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                  disabled={taskMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={taskMutation.isPending}
                >
                  {taskMutation.isPending 
                    ? 'Saving...' 
                    : isEditMode 
                      ? 'Update Task' 
                      : 'Create Task'
                  }
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}