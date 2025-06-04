import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
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
import { CheckCircle, File, Download, MessageSquare, Upload, Trash2, Loader2, Flag, AlertCircle, CheckSquare, FolderOpen, Building, Tag, Edit3, Plus } from 'lucide-react';
import TaskUpdateHistory from './task-update-history';
import AvatarField from './avatar-field';
import SearchableSelect from './searchable-select';

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [showMentions, setShowMentions] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
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
    queryKey: [`/api/tasks/${task?.id}/updates`],
    enabled: !!task?.id && isOpen,
  });
  
  // Fetch task files
  const { data: taskFileData = [], isLoading: filesLoading, refetch: refetchFiles } = useQuery<TaskFile[]>({
    queryKey: ['/api/tasks', task?.id, 'files'],
    queryFn: async () => {
      if (!task?.id) return [];
      const res = await fetch(`/api/tasks/${task.id}/files`);
      if (!res.ok) throw new Error('Failed to fetch task files');
      return await res.json();
    },
    enabled: !!task?.id && isOpen,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0, // Consider data always stale to force refetch
  });

  // Helper function to format date for HTML date input
  const formatDateForInput = (date: Date | string | null | undefined): string => {
    if (!date) return '';
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
        return dateObj.toISOString().split('T')[0];
      }
    } catch {
      // If date parsing fails, return empty string
    }
    
    return '';
  };

  // Form setup
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title || '',
      description: task?.description || '',
      priority: task?.priority || 'medium',
      status: task?.status || 'todo',
      startDate: formatDateForInput(task?.startDate),
      dueDate: formatDateForInput(task?.dueDate),
      projectId: task?.projectId || null,
      assigneeId: task?.assigneeId || (task ? null : user?.id || null),
      categoryId: task?.categoryId || null,
      departmentId: task?.departmentId || null,
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
        startDate: formatDateForInput(task.startDate),
        dueDate: formatDateForInput(task.dueDate),
        projectId: task.projectId || null,
        assigneeId: task.assigneeId || null,
        categoryId: task.categoryId || null,
        departmentId: task.departmentId || null,
      });
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
        userId: user!.id,
        updateType: 'Comment',
        comment,
        previousValue: null,
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

  // File upload mutation
  const fileMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!task?.id) return null;
      
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`/api/tasks/${task.id}/files`, {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to upload file');
      }
      
      return await res.json().catch(() => ({ success: true }));
    },
    onSuccess: () => {
      toast({
        title: 'File uploaded successfully',
        variant: 'default',
      });
      setSelectedFile(null);
      setFileUploading(false);
      
      // Invalidate the query and refetch to ensure latest files are displayed
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', task?.id, 'files'] });
      refetchFiles();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to upload file',
        description: error.message,
        variant: 'destructive',
      });
      setFileUploading(false);
    },
  });
  
  // File deletion mutation
  const fileDeleteMutation = useMutation({
    mutationFn: async (fileId: number) => {
      if (!task?.id) return null;
      
      const res = await fetch(`/api/tasks/${task.id}/files/${fileId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete file');
      }
      
      return await res.json().catch(() => ({ success: true }));
    },
    onSuccess: () => {
      toast({
        title: 'File deleted successfully',
        variant: 'default',
      });
      
      // Invalidate the query and refetch to ensure latest files are displayed
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', task?.id, 'files'] });
      refetchFiles();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete file',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Handle file upload
  const uploadFile = () => {
    if (!selectedFile || !task?.id) return;
    setFileUploading(true);
    fileMutation.mutate(selectedFile);
  };

  // Handle comment submission
  const submitComment = () => {
    if (!comment.trim()) return;
    commentMutation.mutate(comment);
  };

  // Helpers for mentions - improved predictive filtering
  const handleCommentInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setComment(value);
    
    // Check for @ mentions with improved detection
    if (commentInputRef.current) {
      const cursorPos = commentInputRef.current.selectionStart;
      const textBeforeCursor = value.substring(0, cursorPos);
      const lastAtPos = textBeforeCursor.lastIndexOf('@');
      
      // Show mentions if @ is found and is either at start or preceded by space/newline
      if (lastAtPos !== -1 && 
          (lastAtPos === 0 || /[\s\n]/.test(textBeforeCursor[lastAtPos - 1]))) {
        
        // Get the text after @ up to the cursor position
        const afterAt = textBeforeCursor.substring(lastAtPos + 1);
        
        // Only continue if there's no space in the query (still typing the mention)
        if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
          setMentionQuery(afterAt.toLowerCase());
          
          // Calculate position for the mention popover
          const textarea = commentInputRef.current;
          const rect = textarea.getBoundingClientRect();
          const lines = textBeforeCursor.split('\n');
          const currentLineIndex = lines.length - 1;
          const currentLineChars = lines[currentLineIndex].length;
          
          // Better position calculation
          const lineHeight = 20;
          const charWidth = 7;
          
          setMentionPosition({
            top: (currentLineIndex * lineHeight) + 30,
            left: Math.min(currentLineChars * charWidth, 300),
          });
          
          setShowMentions(true);
          return;
        }
      }
      
      setShowMentions(false);
    }
  };

  // Insert a mention into the comment
  const insertMention = (username: string) => {
    // Find user with this username to get their name
    const user = users.find(u => u.username === username);
    const displayName = user?.name || username;
    
    // Use display name with username to ensure proper identification
    const lastAtPos = comment.lastIndexOf('@');
    if (lastAtPos !== -1) {
      const before = comment.substring(0, lastAtPos);
      const after = comment.substring(lastAtPos).split(' ');
      // Replace spaces with underscores for storage
      const formattedName = user?.name ? user.name.replace(/ /g, '_') : username;
      after[0] = `@${formattedName}`;
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
      <DialogContent className="max-w-4xl w-[95vw] sm:w-[90vw] md:w-full max-h-[95vh] overflow-hidden bg-gradient-to-br from-white to-gray-50 border-0 shadow-2xl rounded-2xl">
        <DialogHeader className="pb-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              {task ? <Edit3 className="h-5 w-5 text-blue-600" /> : <Plus className="h-5 w-5 text-blue-600" />}
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-gray-900">
                {task ? 'Edit Task' : 'Create New Task'}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600 mt-1">
                {task ? 'Update task details, add comments, or view history' : 'Fill in the details to create a new task'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        {task ? (
          <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 mb-6 bg-gray-100 rounded-xl p-1 h-12">
              <TabsTrigger value="details" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium">Details</TabsTrigger>
              <TabsTrigger value="comments" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium">Comments</TabsTrigger>
              <TabsTrigger value="files" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium">Files</TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium">History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details">
              <div className="space-y-6">
                <Form {...form}>
                  <ScrollArea className="h-[60vh] max-h-[500px] pr-4">
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-4">
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
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                        <FormField
                          control={form.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <FormLabel className="text-sm font-medium text-gray-700">Start Date</FormLabel>
                              <FormControl>
                                <Input 
                                  type="date" 
                                  {...field} 
                                  value={field.value || ''}
                                  className="rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
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
                            <FormItem className="space-y-2">
                              <FormLabel className="text-sm font-medium text-gray-700">Due Date</FormLabel>
                              <FormControl>
                                <Input 
                                  type="date" 
                                  {...field} 
                                  value={field.value || ''}
                                  className="rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                        <SearchableSelect
                          control={form.control}
                          name="priority"
                          label="Priority"
                          placeholder="Select priority"
                          searchPlaceholder="Search priorities..."
                          options={[
                            { value: "low", label: "Low", icon: <Flag className="h-4 w-4 text-green-500" /> },
                            { value: "medium", label: "Medium", icon: <Flag className="h-4 w-4 text-yellow-500" /> },
                            { value: "high", label: "High", icon: <Flag className="h-4 w-4 text-red-500" /> }
                          ]}
                        />
                      
                        <SearchableSelect
                          control={form.control}
                          name="status"
                          label="Status"
                          placeholder="Select status"
                          searchPlaceholder="Search status..."
                          options={[
                            { value: "todo", label: "To Do", icon: <AlertCircle className="h-4 w-4 text-blue-500" /> },
                            { value: "in_progress", label: "In Progress", icon: <Loader2 className="h-4 w-4 text-yellow-500" /> },
                            { value: "completed", label: "Completed", icon: <CheckSquare className="h-4 w-4 text-green-500" /> }
                          ]}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SearchableSelect
                          control={form.control}
                          name="projectId"
                          label="Project"
                          placeholder="Select project"
                          searchPlaceholder="Search projects..."
                          options={[
                            { value: "-1", label: "No Project", icon: <FolderOpen className="h-4 w-4 text-gray-400" /> },
                            ...projects.map((project) => ({
                              value: project.id.toString(),
                              label: project.name,
                              icon: <FolderOpen className="h-4 w-4 text-blue-500" />
                            }))
                          ]}
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
                        <SearchableSelect
                          control={form.control}
                          name="departmentId"
                          label="Department"
                          placeholder="Select department"
                          searchPlaceholder="Search departments..."
                          options={[
                            { value: "-1", label: "No Department", icon: <Building className="h-4 w-4 text-gray-400" /> },
                            ...departments.map((department) => ({
                              value: department.id.toString(),
                              label: department.name,
                              icon: <Building className="h-4 w-4 text-purple-500" />
                            }))
                          ]}
                        />

                        <SearchableSelect
                          control={form.control}
                          name="categoryId"
                          label="Category"
                          placeholder="Select category"
                          searchPlaceholder="Search categories..."
                          options={[
                            { value: "-1", label: "No Category", icon: <Tag className="h-4 w-4 text-gray-400" /> },
                            ...categories.map((category) => ({
                              value: category.id.toString(),
                              label: category.name,
                              icon: <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color || '#6b7280' }} />
                            }))
                          ]}
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
                    
                    {showMentions && users.length > 0 && (
                      <div 
                        className="absolute z-50 w-80 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl"
                        style={{
                          top: `${mentionPosition.top}px`,
                          left: `${mentionPosition.left}px`,
                        }}
                      >
                        <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                          <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                            {mentionQuery ? `Search results for "${mentionQuery}"` : 'Mention a user'}
                          </p>
                        </div>
                        <ScrollArea className="max-h-48">
                          <div className="p-1">
                            {(() => {
                              const filteredUsers = users.filter((user: User) => {
                                if (mentionQuery === '') return true;
                                const query = mentionQuery.toLowerCase().trim();
                                if (query === '') return true;
                                
                                const username = user.username.toLowerCase();
                                const name = user.name?.toLowerCase() || '';
                                
                                // Enhanced search: exact match, starts with, or contains
                                return username === query || 
                                       name === query ||
                                       username.startsWith(query) || 
                                       name.startsWith(query) ||
                                       username.includes(query) || 
                                       name.includes(query);
                              })
                              .sort((a: User, b: User) => {
                                if (mentionQuery === '') {
                                  return (a.name || a.username).localeCompare(b.name || b.username);
                                }
                                
                                const query = mentionQuery.toLowerCase().trim();
                                const aUsername = a.username.toLowerCase();
                                const bUsername = b.username.toLowerCase();
                                const aName = a.name?.toLowerCase() || '';
                                const bName = b.name?.toLowerCase() || '';
                                
                                // Scoring system for better relevance
                                const scoreUser = (user: User) => {
                                  const uname = user.username.toLowerCase();
                                  const fname = user.name?.toLowerCase() || '';
                                  
                                  if (uname === query || fname === query) return 100; // Exact match
                                  if (uname.startsWith(query) || fname.startsWith(query)) return 50; // Starts with
                                  if (uname.includes(query) || fname.includes(query)) return 10; // Contains
                                  return 0;
                                };
                                
                                return scoreUser(b) - scoreUser(a);
                              })
                              .slice(0, 8); // Limit results
                              
                              if (filteredUsers.length === 0) {
                                return (
                                  <div className="p-3 text-center text-sm text-gray-500 dark:text-gray-400">
                                    No users found matching "{mentionQuery}"
                                  </div>
                                );
                              }
                              
                              return filteredUsers.map((user: User, index: number) => (
                                <div 
                                  key={user.id}
                                  className="flex items-center gap-3 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md cursor-pointer transition-all duration-150 border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                                  onClick={() => insertMention(user.username)}
                                >
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={user.avatar || undefined} alt={user.name || user.username} />
                                    <AvatarFallback className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold">
                                      {user.name 
                                        ? `${user.name.split(' ')[0][0]}${user.name.split(' ')[1]?.[0] || ''}`
                                        : user.username.substring(0, 2).toUpperCase()
                                      }
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                      {user.name || user.username}
                                    </p>
                                    <p className="text-xs text-blue-600 dark:text-blue-400 truncate font-medium">
                                      @{user.username}
                                    </p>
                                  </div>
                                  {index === 0 && (
                                    <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                      ↵
                                    </div>
                                  )}
                                </div>
                              ));
                            })()}
                          </div>
                        </ScrollArea>
                        <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Type to search • Press ↵ to select • ESC to close
                          </p>
                        </div>
                      </div>
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
                        disabled={fileUploading || fileMutation.isPending}
                      />
                      <label
                        htmlFor="fileUpload"
                        className={`cursor-pointer flex flex-col items-center justify-center ${(fileUploading || fileMutation.isPending) ? 'opacity-50' : ''}`}
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
                                disabled={fileUploading || fileMutation.isPending}
                              >
                                {(fileUploading || fileMutation.isPending) ? (
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
                    {filesLoading ? (
                      <div className="flex justify-center items-center h-[200px]">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : taskFileData.length > 0 ? (
                      <div className="space-y-3">
                        {taskFileData.map((file) => (
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
                                <a href={`/api/tasks/${task?.id}/files/${file.id}`} target="_blank" rel="noopener noreferrer">
                                  <Button size="icon" variant="ghost">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </a>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="text-destructive"
                                  onClick={() => fileDeleteMutation.mutate(file.id)}
                                  disabled={fileDeleteMutation.isPending}
                                >
                                  {fileDeleteMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
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
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="-1">No Department</SelectItem>
                          {departments.map((department) => (
                            <SelectItem key={department.id} value={department.id.toString()}>
                              {department.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
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
              
              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-gray-100">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                  disabled={taskMutation.isPending}
                  className="w-full sm:w-auto h-11 rounded-lg border-gray-200 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={taskMutation.isPending}
                  className="w-full sm:w-auto h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                >
                  {taskMutation.isPending 
                    ? 'Saving...' 
                    : 'Create Task'
                  }
                </Button>
              </DialogFooter>
            </form>
            </ScrollArea>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}