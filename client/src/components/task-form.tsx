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
import { Skeleton } from '@/components/ui/skeleton';
import { Upload, File, Download, Trash2, Loader2 } from 'lucide-react';
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
import { formatDistanceToNow, format } from 'date-fns';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { taskFormSchema, type TaskFormValues, type Task, type Project, type Category, type Department, type User, type TaskUpdate } from '@shared/schema';
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
  
  // State for file upload section
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [taskFiles, setTaskFiles] = useState<{id: number, name: string, size: number, url: string, uploadedAt: string}[]>([]);
  
  // Get users for mentions
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });
  
  // Get task updates for this task
  const { data: taskUpdates = [], isLoading: updatesLoading, refetch: refetchUpdates } = useQuery<(TaskUpdate & { user?: User })[]>({
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
        // userId will be set by the server from the authenticated session
        updateType: 'Comment',
        previousValue: '',
        newValue: '',
        comment: commentText
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
  
  // File upload handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };
  
  const uploadFile = async () => {
    if (!selectedFile || !task?.id) return;
    
    setFileUploading(true);
    
    // In a real implementation, we would upload the file to a server
    // For demonstration, we'll simulate an upload and add it to our local state
    setTimeout(() => {
      const newFile = {
        id: Math.floor(Math.random() * 10000),
        name: selectedFile.name,
        size: selectedFile.size,
        url: URL.createObjectURL(selectedFile),
        uploadedAt: new Date().toISOString()
      };
      
      setTaskFiles([...taskFiles, newFile]);
      setSelectedFile(null);
      setFileUploading(false);
      
      toast({
        title: "File uploaded",
        description: `${selectedFile.name} has been uploaded successfully.`
      });
    }, 1500);
  };
  
  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="comments">Comments</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
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
            
            <TabsContent value="comments">
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
                      type="button"
                      onClick={submitComment}
                      disabled={!comment.trim() || commentMutation.isPending}
                    >
                      {commentMutation.isPending ? 'Submitting...' : 'Add Comment'}
                    </Button>
                  </div>
                </div>
                
                {/* Show existing comments */}
                <div className="mt-4">
                  <h3 className="text-lg font-medium mb-2">Comments</h3>
                  <ScrollArea className="h-[300px] pr-4">
                    {updatesLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                      </div>
                    ) : taskUpdates?.filter((update: TaskUpdate & { user?: User }) => update.updateType === 'Comment').length ? (
                      <div className="space-y-3">
                        {taskUpdates?.filter((update: TaskUpdate & { user?: User }) => update.updateType === 'Comment').map((update: TaskUpdate & { user?: User }) => (
                          <Card key={update.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={update.user?.avatar || ''} alt={update.user?.name || 'User'} />
                                  <AvatarFallback>{update.user?.username?.charAt(0) || 'U'}</AvatarFallback>
                                </Avatar>
                                
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{update.user?.name || update.user?.username || 'Unknown user'}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {update.createdAt ? new Date(update.createdAt).toLocaleString() : ''}
                                    </span>
                                  </div>
                                  
                                  <p className="mt-1 text-sm">{update.comment}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="border border-dashed">
                        <CardContent className="flex items-center justify-center p-6">
                          <p className="text-muted-foreground text-sm">No comments yet</p>
                        </CardContent>
                      </Card>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="files">
              <div className="py-2">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium mb-2">Attached Files</h3>
                  
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-dashed">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <input
                        type="file"
                        id="fileUpload"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <label
                        htmlFor="fileUpload"
                        className="cursor-pointer flex flex-col items-center justify-center"
                      >
                        <div className="bg-primary/10 h-12 w-12 rounded-full flex items-center justify-center">
                          <Upload className="h-6 w-6 text-primary" />
                        </div>
                        <p className="text-sm font-medium mt-2">Click to upload file</p>
                        <p className="text-xs text-muted-foreground">
                          PDF, Word, Excel, Images, etc.
                        </p>
                      </label>
                      
                      {selectedFile && (
                        <div className="mt-4 w-full">
                          <Card>
                            <CardContent className="p-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <File className="h-5 w-5 text-primary" />
                                <div>
                                  <p className="text-sm font-medium">{selectedFile.name}</p>
                                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={uploadFile}
                                disabled={fileUploading}
                              >
                                {fileUploading ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Uploading
                                  </>
                                ) : 'Upload'}
                              </Button>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <ScrollArea className="h-[250px]">
                    {taskFiles.length > 0 ? (
                      <div className="space-y-3">
                        {taskFiles.map((file) => (
                          <Card key={file.id}>
                            <CardContent className="p-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <File className="h-5 w-5 text-primary" />
                                <div>
                                  <p className="text-sm font-medium">{file.name}</p>
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                                    <span className="text-xs text-muted-foreground">•</span>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(file.uploadedAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="icon" variant="ghost">
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="border border-dashed">
                        <CardContent className="flex items-center justify-center p-6">
                          <p className="text-muted-foreground text-sm">No files attached to this task</p>
                        </CardContent>
                      </Card>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="history">
              <div className="py-2">
                <TaskUpdateHistory taskId={task.id} />
              </div>
            </TabsContent>
            
            <TabsContent value="details">
              <div className="py-2 space-y-6">
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
                          type="button"
                          onClick={submitComment}
                          disabled={!comment.trim() || commentMutation.isPending}
                        >
                          {commentMutation.isPending ? 'Submitting...' : 'Add Comment'}
                        </Button>
                      </div>
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