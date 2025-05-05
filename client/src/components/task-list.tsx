import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { TaskFilterValues } from './task-filters';
import TaskForm from './task-form';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
} from "@/components/ui/alert-dialog";
import { type Task, type User, type Project, type Category, type Department } from '@shared/schema';

interface TaskWithRelations extends Task {
  project?: Project | null;
  assignee?: User | null;
  category?: Category | null;
}

interface TaskListProps {
  filters: TaskFilterValues;
}

export default function TaskList({ filters }: TaskListProps) {
  const { toast } = useToast();
  const [isTaskFormOpen, setIsTaskFormOpen] = React.useState(false);
  const [currentTask, setCurrentTask] = React.useState<Task | null>(null);
  
  // Build query string from filters
  const getQueryString = () => {
    const params = new URLSearchParams();
    
    if (filters.status && filters.status !== 'all') {
      params.append('status', filters.status);
    }
    
    if (filters.priority && filters.priority !== 'all') {
      params.append('priority', filters.priority);
    }
    
    if (filters.projectId && filters.projectId !== -2) {
      params.append('projectId', filters.projectId.toString());
    }
    
    if (filters.assigneeId && filters.assigneeId !== -2) {
      params.append('assigneeId', filters.assigneeId.toString());
    }
    
    if (filters.categoryId && filters.categoryId !== -2) {
      params.append('categoryId', filters.categoryId.toString());
    }
    
    if (filters.department && filters.department !== 'all') {
      params.append('department', filters.department);
    }
    
    if (filters.search) {
      params.append('search', filters.search);
    }
    
    return params.toString() ? `?${params.toString()}` : '';
  };
  
  // Fetch departments for reference
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
  });
  
  // Fetch tasks based on filters
  const { data: tasks = [], isLoading } = useQuery<TaskWithRelations[]>({
    queryKey: [`/api/tasks${getQueryString()}`],
  });
  
  // Sort tasks based on the selected sort option
  const sortedTasks = React.useMemo(() => {
    if (!tasks) return [];
    
    return [...tasks].sort((a, b) => {
      if (filters.sortBy === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      
      if (filters.sortBy === 'priority') {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority as keyof typeof priorityOrder] - 
               priorityOrder[b.priority as keyof typeof priorityOrder];
      }
      
      if (filters.sortBy === 'updatedAt') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      
      return 0;
    });
  }, [tasks, filters.sortBy]);
  
  // Toggle task completion status
  const toggleTaskMutation = useMutation({
    mutationFn: async (task: Task) => {
      const newStatus = task.status === 'completed' ? 'todo' : 'completed';
      return apiRequest('PATCH', `/api/tasks/${task.id}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/statistics'] });
      toast({
        title: "Task updated",
        description: "Task status has been updated successfully.",
      });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: `Failed to update task: ${err}`,
        variant: "destructive",
      });
    }
  });
  
  // Delete task
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return apiRequest('DELETE', `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/statistics'] });
      toast({
        title: "Task deleted",
        description: "Task has been deleted successfully.",
      });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: `Failed to delete task: ${err}`,
        variant: "destructive",
      });
    }
  });
  
  const handleEditTask = (task: Task) => {
    setCurrentTask(task);
    setIsTaskFormOpen(true);
  };
  
  const handleTaskFormClose = () => {
    setIsTaskFormOpen(false);
    setCurrentTask(null);
  };
  
  // Helper function to get priority badge styling
  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case 'high':
        return { color: 'destructive', label: 'High Priority' };
      case 'medium':
        return { color: 'warning', label: 'Medium Priority' };
      case 'low':
        return { color: 'success', label: 'Low Priority' };
      default:
        return { color: 'secondary', label: 'No Priority' };
    }
  };
  
  // Helper function to format date
  const formatDate = (dateString?: string | Date | null) => {
    if (!dateString) return 'No due date';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return 'Invalid date';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>Loading tasks...</CardDescription>
        </CardHeader>
        <CardContent>
          {[1, 2, 3].map((i) => (
            <div key={i} className="mb-4 p-4 border-b border-gray-200">
              <div className="flex items-start">
                <Skeleton className="h-4 w-4 mt-1 mr-3" />
                <div className="w-full">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <div className="flex space-x-2 mb-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="px-3 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400">
            {sortedTasks.length === 0
              ? "No tasks found"
              : `${sortedTasks.length} task${sortedTasks.length === 1 ? '' : 's'}`}
          </div>
          <div className="text-xs text-gray-500">
            {sortedTasks.length === 0 ? "Try adjusting your filters or create a new task" : ""}
          </div>
        </div>
        
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm">
            {sortedTasks.map((task) => {
              const priorityClass = `task-priority-${task.priority}`;
              const priorityBadge = getPriorityBadge(task.priority);
              const isCompleted = task.status === 'completed';
              const isDueDate = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;
              
              return (
                <li 
                  key={task.id} 
                  className={`
                    hover:bg-gray-50 relative 
                    ${isCompleted ? 'opacity-70' : ''} 
                    ${priorityClass} 
                    border-l-4 
                    ${task.priority === 'high' ? 'border-red-500' : 
                      task.priority === 'medium' ? 'border-amber-500' : 
                      'border-green-500'}
                  `}
                >
                  <div className="px-4 py-4 flex items-center sm:px-6">
                    <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                      <div className="flex items-center">
                        <Checkbox
                          checked={isCompleted}
                          onCheckedChange={() => toggleTaskMutation.mutate(task)}
                          className="h-4 w-4 text-blue-600 mr-3 cursor-pointer"
                        />
                        <div>
                          <p className={`text-sm font-medium ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'} truncate`}>
                            {task.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-y-1 text-sm text-gray-500">
                            <Badge 
                              variant={priorityBadge.color as any} 
                              className="mr-2"
                            >
                              {priorityBadge.label}
                            </Badge>
                            <span className={`text-xs mr-2 ${isDueDate ? 'text-red-600 font-semibold' : ''}`}>
                              Due: {formatDate(task.dueDate)}
                            </span>
                            {task.project && (
                              <Badge variant="outline" className="ml-2">
                                {task.project.name}
                              </Badge>
                            )}
                            {task.category && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge 
                                    variant="secondary" 
                                    className="ml-2 flex items-center gap-1"
                                    style={{ backgroundColor: task.category.color, color: 'white' }}
                                  >
                                    <div className="w-2 h-2 rounded-full bg-white/80"></div>
                                    {task.category.name}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p><span className="font-semibold">Department:</span> {
                                    task.category && task.category.departmentId 
                                      ? departments.find((d: Department) => d.id === task.category?.departmentId)?.name || 'Unknown'
                                      : 'General'
                                  }</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between sm:mt-0 sm:ml-6 sm:flex-shrink-0 sm:justify-start">
                        <div className="flex items-center space-x-2">
                          {task.assignee ? (
                            <Avatar className="h-8 w-8 border-2 border-white">
                              <AvatarImage 
                                src={task.assignee.avatar || ''} 
                                alt={`Assigned to ${task.assignee.name}`} 
                              />
                              <AvatarFallback>
                                {task.assignee.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <UserPlus className="text-gray-500 h-4 w-4" />
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTask(task)}
                          >
                            <Pencil className="h-4 w-4 text-gray-500" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-gray-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Task</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this task? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteTaskMutation.mutate(task.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
        </ul>
        
        {sortedTasks.length === 0 && (
          <div className="flex justify-center py-8 bg-white dark:bg-gray-900 rounded-xl mt-4 shadow-sm">
            <p className="text-center text-gray-500">No tasks match your current filters.</p>
          </div>
        )}
      </div>
      
      {isTaskFormOpen && (
        <TaskForm
          isOpen={isTaskFormOpen}
          onClose={handleTaskFormClose}
          task={currentTask}
        />
      )}
    </>
  );
}
