import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Task, TaskFormValues, taskFormSchema, User, 
  Department, Category, Project, TaskUpdate, 
  InsertTaskUpdate, InsertTask 
} from '@shared/schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, File, Download, MessageSquare, Upload, Trash2, Loader2 } from 'lucide-react';
import TaskUpdateHistory from './task-update-history';
import AvatarField from './avatar-field';

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
}

interface TaskFile {
  id: number;
  name: string;
  size: number;
  uploadedAt: string;
}

export default function TaskForm({ isOpen, onClose, task }: TaskFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [showMentions, setShowMentions] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [taskFiles, setTaskFiles] = useState<TaskFile[]>([]);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch users for assignee selection and mentions
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Fetch projects for project selection
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Fetch departments and categories for category selection
  const { data: departments = [], isLoading: departmentsLoading } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  // Fetch task updates for comments and history
  const { data: taskUpdates = [], isLoading: updatesLoading, refetch: refetchUpdates } = useQuery<(TaskUpdate & { user?: User })[]>({
    queryKey: ['/api/tasks', task?.id, 'updates'],
    enabled: !!task?.id && isOpen,
  });

  // Form setup
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title || '',
      description: task?.description || '',
      priority: task?.priority || 'medium',
      status: task?.status || 'todo',
      startDate: task?.startDate || '',
      dueDate: task?.dueDate || '',
      projectId: task?.projectId || null,
      assigneeId: task?.assigneeId || null,
      categoryId: task?.categoryId || null,
    },
  });

  // Load task data when the task changes
  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'medium',
        status: task.status || 'todo',
        startDate: task.startDate || '',
        dueDate: task.dueDate || '',
        projectId: task.projectId || null,
        assigneeId: task.assigneeId || null,
        categoryId: task.categoryId || null,
      });
      
      // Load task files (sample - in a real app, this would fetch from the API)
      setTaskFiles([
        {
          id: 1,
          name: 'Project_Requirements.pdf',
          size: 2456000,
          uploadedAt: new Date().toISOString(),
        },
        {
          id: 2,
          name: 'Design_Mockup.png',
          size: 1200000,
          uploadedAt: new Date().toISOString(),
        }
      ]);
    }
  }, [task, form]);

  // Task update mutation (for saving the task)
  const taskMutation = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      if (task?.id) {
        const res = await apiRequest('PATCH', `/api/tasks/${task.id}`, values);
        return await res.json();
      } else {
        const res = await apiRequest('POST', '/api/tasks', values as InsertTask);
        return await res.json();
      }
    },
    onSuccess: () => {
      toast({
        title: `Task ${task ? 'updated' : 'created'} successfully`,
        variant: 'default',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: `Failed to ${task ? 'update' : 'create'} task`,
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Comment mutation (for adding comments)
  const commentMutation = useMutation({
    mutationFn: async (comment: string) => {
      if (!task?.id) return null;
      
      const commentData: InsertTaskUpdate = {
        taskId: task.id,
        updateType: 'Comment',
        comment,
        field: null,
        oldValue: null,
        newValue: null,
      };
      
      const res = await apiRequest('POST', `/api/tasks/${task.id}/updates`, commentData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Comment added successfully',
        variant: 'default',
      });
      setComment('');
      refetchUpdates();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to add comment',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handle form submission
  const onSubmit = (values: TaskFormValues) => {
    taskMutation.mutate(values);
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Handle file upload
  const uploadFile = () => {
    if (!selectedFile || !task?.id) return;
    
    setFileUploading(true);
    
    // Simulate file upload - in a real app, this would be an API call
    setTimeout(() => {
      setFileUploading(false);
      
      // Add the file to the list (in a real app, this would come from the API response)
      setTaskFiles([
        ...taskFiles,
        {
          id: Date.now(),
          name: selectedFile.name,
          size: selectedFile.size,
          uploadedAt: new Date().toISOString(),
        },
      ]);
      
      setSelectedFile(null);
      
      toast({
        title: 'File uploaded successfully',
        variant: 'default',
      });
    }, 1500);
  };

  // Handle comment submission
  const submitComment = () => {
    if (!comment.trim()) return;
    commentMutation.mutate(comment);
  };

  // Helpers for mentions
  const handleCommentInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setComment(value);
    
    // Check for @ mentions
    const lastAtPos = value.lastIndexOf('@');
    if (lastAtPos !== -1 && (lastAtPos === 0 || value[lastAtPos - 1] === ' ')) {
      const query = value.substring(lastAtPos + 1).split(' ')[0];
      setMentionQuery(query);
      
      // Calculate position for the mention popover
      if (commentInputRef.current) {
        const cursorPos = commentInputRef.current.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPos);
        const lines = textBeforeCursor.split('\n');
        const currentLineIndex = lines.length - 1;
        const currentLineChars = lines[currentLineIndex].length;
        
        // Rough estimation of position
        const lineHeight = 24;
        const charWidth = 8;
        
        setMentionPosition({
          top: (currentLineIndex * lineHeight) + 24,
          left: Math.min(currentLineChars * charWidth, 300),
        });
      }
      
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  // Insert a mention into the comment
  const insertMention = (username: string) => {
    const lastAtPos = comment.lastIndexOf('@');
    if (lastAtPos !== -1) {
      const before = comment.substring(0, lastAtPos);
      const after = comment.substring(lastAtPos).split(' ');
      after[0] = `@${username}`;
      setComment(before + after.join(' '));
    }
    setShowMentions(false);
    
    // Focus back on the textarea
    if (commentInputRef.current) {
      commentInputRef.current.focus();
    }
  };

  // Helper for file size formatting
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Create New Task'}</DialogTitle>
          <DialogDescription>
            {task ? 'Update task details, add comments, or view history' : 'Fill in the details to create a new task'}
          </DialogDescription>
        </DialogHeader>
        
        {task ? (
          <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="comments">Comments</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details">
              <div className="py-2 space-y-6">
                <Form {...form}>
                  <ScrollArea className="h-[500px] pr-4">
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
                  </ScrollArea>
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