import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Form, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormMessage 
} from '@/components/ui/form';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { formatDistanceToNow } from 'date-fns';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { taskFormSchema, type TaskFormValues, type Task, type Project, type Category, type Department, type User } from '@shared/schema';
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

  // State for comment section
  const [comment, setComment] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  
  // Get users for mentions
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });
  
  // Get task updates for this task
  const { data: taskUpdates = [], isLoading: updatesLoading, refetch: refetchUpdates } = useQuery({
    queryKey: ['/api/tasks', task?.id, 'updates'],
    queryFn: () => {
      if (!task?.id) return [];
      return apiRequest('GET', `/api/tasks/${task.id}/updates`).then(res => res.json());
    },
    enabled: !!task?.id,
  });

  // Setup form with default values
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      id: task?.id,
      title: task?.title || '',
      description: task?.description || '',
      startDate: task?.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
      dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      priority: task?.priority || 'medium',
      status: task?.status || 'todo',
      projectId: task?.projectId || null,
      assigneeId: task?.assigneeId || null,
      categoryId: task?.categoryId || null,
    },
  });

  // Add comment mutation
  const commentMutation = useMutation({
    mutationFn: async (commentText: string) => {
      if (!task?.id) throw new Error('Task ID is required');
      return apiRequest('POST', `/api/tasks/${task.id}/updates`, {
        taskId: task.id,
        comment: commentText,
        updateType: 'Comment'
      });
    },
    onSuccess: () => {
      setComment('');
      refetchUpdates();
      toast({
        title: "Comment added",
        description: "Your comment has been added to the task."
      });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: `Failed to add comment: ${err}`,
        variant: "destructive"
      });
    }
  });

  // Handle mentions in comment input
  const handleCommentInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setComment(text);
    
    // Check for @ symbol to trigger mentions
    const lastAtPos = text.lastIndexOf('@');
    if (lastAtPos !== -1 && lastAtPos === text.length - 1) {
      setMentionQuery('');
      setShowMentions(true);
      // Position the mentions popover
      if (commentInputRef.current) {
        const caretPosition = commentInputRef.current.selectionStart;
        const textBeforeCaret = text.substring(0, caretPosition);
        const lines = textBeforeCaret.split('\n');
        const lineHeight = 24; // Approximate line height in pixels
        const lineCount = lines.length;
        const charCountInLastLine = lines[lines.length - 1].length;
        
        // Set position relative to textarea
        setMentionPosition({
          top: lineCount * lineHeight,
          left: charCountInLastLine * 8 // Approximate char width
        });
      }
    } else if (lastAtPos !== -1) {
      const queryText = text.substring(lastAtPos + 1).split(' ')[0];
      setMentionQuery(queryText);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  // Insert mention into comment
  const insertMention = (username: string) => {
    const atPos = comment.lastIndexOf('@');
    if (atPos !== -1) {
      const newComment = comment.substring(0, atPos) + `@${username} `;
      setComment(newComment);
    }
    setShowMentions(false);
    commentInputRef.current?.focus();
  };

  // Submit comment
  const submitComment = () => {
    if (comment.trim()) {
      commentMutation.mutate(comment);
    }
  };

  // Create/Update task mutation
  const taskMutation = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      // Clean up data for API submission - ensure proper types for backend
      const processedValues = {
        ...values,
        // Convert empty strings to null for optional fields
        description: values.description?.trim() === '' ? null : values.description,
        startDate: values.startDate?.trim() === '' ? null : values.startDate,
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
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date</FormLabel>
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
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="py-2 space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Add Comment</h3>
                  <div className="relative">
                    <Textarea
                      ref={commentInputRef}
                      placeholder="Type your comment here... Use @ to mention team members"
                      className="min-h-[100px] resize-none"
                      value={comment}
                      onChange={handleCommentInput}
                    />
                    
                    {showMentions && (
                      <Popover open={showMentions} onOpenChange={setShowMentions}>
                        <PopoverContent 
                          className="w-64 p-0" 
                          align="start"
                          style={{
                            position: 'absolute',
                            top: `${mentionPosition.top}px`,
                            left: `${mentionPosition.left}px`,
                          }}
                        >
                          <ScrollArea className="h-64">
                            <div className="p-2">
                              {users
                                .filter((user: User) => 
                                  mentionQuery === '' || 
                                  user.username.toLowerCase().includes(mentionQuery.toLowerCase()) ||
                                  user.name?.toLowerCase().includes(mentionQuery.toLowerCase())
                                )
                                .map((user: User) => (
                                  <div 
                                    key={user.id}
                                    className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                                    onClick={() => insertMention(user.username)}
                                  >
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={user.avatar || undefined} alt={user.name || user.username} />
                                      <AvatarFallback>{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="text-sm font-medium">{user.name || user.username}</p>
                                      <p className="text-xs text-gray-500">@{user.username}</p>
                                    </div>
                                  </div>
                                ))
                              }
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button
                      onClick={submitComment}
                      disabled={!comment.trim() || commentMutation.isPending}
                    >
                      {commentMutation.isPending ? 'Submitting...' : 'Add Comment'}
                    </Button>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Updates History</h3>
                  <TaskUpdateHistory taskId={task.id} />
                </div>
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
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
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