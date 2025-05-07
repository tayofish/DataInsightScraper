import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
// Card imports removed as they're no longer needed
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, UserPlus, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { TaskFilterValues } from './task-filters';
import TaskForm from './task-form';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
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
  department?: Department | null;
}

interface TaskListProps {
  filters: TaskFilterValues;
}

export default function TaskList({ filters }: TaskListProps) {
  const { toast } = useToast();
  const [isTaskFormOpen, setIsTaskFormOpen] = React.useState(false);
  const [currentTask, setCurrentTask] = React.useState<Task | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const tasksPerPage = 15;
  
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
      console.log('Adding department filter:', filters.department);
      params.append('departmentId', filters.department);
    }
    
    if (filters.search) {
      params.append('search', filters.search);
    }
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    console.log('Final query string:', queryString);
    return queryString;
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
  
  // Calculate pagination
  const totalPages = Math.ceil(sortedTasks.length / tasksPerPage);
  const indexOfLastTask = currentPage * tasksPerPage;
  const indexOfFirstTask = indexOfLastTask - tasksPerPage;
  const currentTasks = sortedTasks.slice(indexOfFirstTask, indexOfLastTask);
  
  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters]);
  
  const goToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    // Scroll to top of task list
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
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
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="px-3 py-1">
            <Skeleton className="h-6 w-24" />
          </div>
          <div>
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-start animate-pulse">
                <Skeleton className="h-5 w-5 mt-1 mr-3 rounded-full" />
                <div className="w-full">
                  <Skeleton className="h-5 w-3/4 mb-2 rounded-md" />
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-5 w-32 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                </div>
                <div className="flex ml-4 space-x-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
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
        
        {sortedTasks.length > 0 ? (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm">
            {currentTasks.map((task) => {
              const priorityClass = `task-priority-${task.priority}`;
              const priorityBadge = getPriorityBadge(task.priority);
              const isCompleted = task.status === 'completed';
              const isDueDate = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;
              
              return (
                <li 
                  key={task.id} 
                  className={`
                    hover:bg-gray-50 dark:hover:bg-gray-800 relative 
                    ${isCompleted ? 'opacity-70' : ''} 
                    ${priorityClass} 
                    border-l-4 
                    ${task.priority === 'high' ? 'border-red-500' : 
                      task.priority === 'medium' ? 'border-amber-500' : 
                      'border-green-500'}
                    transition-all duration-200 hover:shadow-md
                  `}
                >
                  <div className="px-4 py-4 flex items-center sm:px-6">
                    <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                      <div className="flex items-center">
                        <Checkbox
                          checked={isCompleted}
                          onCheckedChange={() => toggleTaskMutation.mutate(task)}
                          className="h-5 w-5 text-blue-600 mr-3 cursor-pointer rounded-full border-2 transition-all"
                        />
                        <div>
                          <p className={`text-base font-medium ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'} truncate`}>
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
                            {task.department && (
                              <Badge variant="outline" className="ml-2 bg-gray-100 text-gray-700 border-gray-200">
                                <Building2 className="h-3 w-3 mr-1" />
                                {task.department.name}
                              </Badge>
                            )}
                            {task.category && (
                              <TooltipProvider>
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
                                      task.department
                                        ? task.department.name
                                        : (task.category && task.category.departmentId 
                                          ? departments.find((d: Department) => d.id === task.category?.departmentId)?.name || 'Unknown'
                                          : 'General')
                                    }</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between sm:mt-0 sm:ml-6 sm:flex-shrink-0 sm:justify-start">
                        <div className="flex items-center space-x-2">
                          {task.assignee ? (
                            <div className="flex items-center space-x-2">
                              <Avatar className="h-8 w-8 border-2 border-white">
                                <AvatarImage 
                                  src={task.assignee.avatar || ''} 
                                  alt={`Assigned to ${task.assignee.name}`} 
                                />
                                <AvatarFallback>
                                  {task.assignee.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium text-gray-700">{task.assignee.name}</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <UserPlus className="text-gray-500 h-4 w-4" />
                              </div>
                              <span className="text-sm text-gray-500">Unassigned</span>
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTask(task)}
                            className="rounded-full hover:bg-blue-100 hover:text-blue-600 transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="rounded-full hover:bg-red-100 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
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
        ) : (
          <div className="flex flex-col items-center justify-center py-10 bg-white dark:bg-gray-900 rounded-xl mt-4 shadow-sm transition-all duration-300 border border-gray-100 dark:border-gray-800">
            <Trash2 className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-center text-gray-500 dark:text-gray-400 font-medium">No tasks match your current filters.</p>
            <p className="text-center text-gray-400 dark:text-gray-500 text-sm mt-1">Try adjusting your filters or create a new task.</p>
          </div>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center mt-6 gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => goToPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => goToPage(page)}
                  className={`h-8 w-8 ${currentPage === page ? 'text-white' : ''}`}
                >
                  {page}
                </Button>
              ))}
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
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
