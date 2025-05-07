import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Project, Task } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, CheckSquare, Clock, List, PlusCircle, ProjectorIcon, UserCog } from "lucide-react";
import TaskList from "@/components/task-list";
import { TaskFilterValues } from "@/components/task-filters";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { queryClient } from "@/lib/queryClient";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id);
  const [taskFilters, setTaskFilters] = useState<TaskFilterValues>({
    projectId,
    assigneeId: null,
    categoryId: null,
    department: "",
    status: "",
    priority: "",
    search: "",
    sortBy: "updatedAt"
  });

  // Fetch project details
  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ['/api/projects', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch project');
      return res.json();
    },
    enabled: !isNaN(projectId)
  });

  // Fetch tasks for this project
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks', { projectId }],
    queryFn: async () => {
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
    enabled: !isNaN(projectId)
  });
  
  // Fetch project team members/assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: ['/api/projects', projectId, 'assignments'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/assignments`);
      if (!res.ok) throw new Error('Failed to fetch team members');
      return res.json();
    },
    enabled: !isNaN(projectId)
  });

  // Calculate task statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const inProgressTasks = tasks.filter(task => task.status === 'in_progress').length;
  const todoTasks = tasks.filter(task => task.status === 'todo').length;
  
  const highPriorityTasks = tasks.filter(task => task.priority === 'high').length;
  const mediumPriorityTasks = tasks.filter(task => task.priority === 'medium').length;
  const lowPriorityTasks = tasks.filter(task => task.priority === 'low').length;
  
  // Calculate overdue tasks
  const now = new Date();
  const overdueTasks = tasks.filter(task => 
    task.status !== 'completed' && 
    task.dueDate && 
    new Date(task.dueDate) < now
  ).length;

  if (projectLoading) {
    return (
      <div className="container py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse flex space-x-4">
            <div className="rounded-full bg-slate-200 h-12 w-12"></div>
            <div className="flex-1 space-y-4 py-1">
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 rounded"></div>
                <div className="h-4 bg-slate-200 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project && !projectLoading) {
    return (
      <div className="container py-8">
        <div className="flex flex-col items-center justify-center h-64">
          <h2 className="text-2xl font-bold mb-4">Project not found</h2>
          <Button asChild>
            <Link href="/projects">Back to Projects</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Project Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="p-0 h-auto">
              <Link href="/projects">
                <span className="text-muted-foreground">Projects</span> /
              </Link>
            </Button>
            <h1 className="text-3xl font-bold gradient-heading">{project?.name}</h1>
            <Badge variant="secondary" className="ml-2">
              Active
            </Badge>
          </div>
          <p className="text-muted-foreground mt-2">{project?.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}/team`}>
              <UserCog className="h-4 w-4 mr-2" />
              Manage Team
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/tasks/new?projectId=${projectId}`}>
              <PlusCircle className="h-4 w-4 mr-2" />
              New Task
            </Link>
          </Button>
        </div>
      </div>

      {/* Project Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <div className="text-3xl font-bold mb-2">{completionPercentage}%</div>
              <Progress value={completionPercentage} className="h-2 w-full" />
              <div className="text-sm text-muted-foreground mt-2">
                {completedTasks} of {totalTasks} tasks complete
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Task Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-yellow-500">{todoTasks}</div>
                <div className="text-xs text-muted-foreground">To Do</div>
              </div>
              <div>
                <div className="text-xl font-bold text-blue-500">{inProgressTasks}</div>
                <div className="text-xs text-muted-foreground">In Progress</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-500">{completedTasks}</div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-red-500">{highPriorityTasks}</div>
                <div className="text-xs text-muted-foreground">High</div>
              </div>
              <div>
                <div className="text-xl font-bold text-orange-500">{mediumPriorityTasks}</div>
                <div className="text-xs text-muted-foreground">Medium</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-500">{lowPriorityTasks}</div>
                <div className="text-xs text-muted-foreground">Low</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className={overdueTasks > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <div className={`text-3xl font-bold mb-1 ${overdueTasks > 0 ? "text-red-500" : ""}`}>
                {overdueTasks}
              </div>
              <div className="text-sm text-muted-foreground">
                {overdueTasks === 1 ? 'task is overdue' : 'tasks are overdue'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Tabs */}
      <Tabs defaultValue="tasks" className="mb-8">
        <TabsList className="mb-4">
          <TabsTrigger value="tasks">
            <List className="h-4 w-4 mr-2" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="team">
            <UserCog className="h-4 w-4 mr-2" />
            Team
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <CalendarDays className="h-4 w-4 mr-2" />
            Timeline
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="tasks" className="space-y-4">
          <TaskList filters={taskFilters} />
        </TabsContent>
        
        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Team</CardTitle>
              <CardDescription>Team members assigned to this project</CardDescription>
            </CardHeader>
            <CardContent>
              {assignmentsLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <UserCog className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p>No team members assigned to this project yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {assignments.map((assignment: any) => (
                    <div key={assignment.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={assignment.user?.avatar ?? ''} />
                          <AvatarFallback>{assignment.user?.name?.[0] ?? 'U'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{assignment.user?.name}</div>
                          <div className="text-sm text-muted-foreground">{assignment.role}</div>
                        </div>
                      </div>
                      <Badge variant="outline">{assignment.role}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/projects/${projectId}/team`}>
                  <UserCog className="h-4 w-4 mr-2" />
                  Manage Team
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Timeline</CardTitle>
              <CardDescription>View project timeline and tasks by due date</CardDescription>
            </CardHeader>
            <CardContent className="min-h-[400px]">
              {tasksLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <CalendarDays className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p>No tasks have been created for this project yet.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline with vertical line */}
                  <div className="absolute top-0 bottom-0 left-[20px] w-[2px] bg-gray-200"></div>
                  
                  {/* Sort tasks by due date and group them */}
                  {[...tasks]
                    .sort((a, b) => {
                      // Sort by due date (tasks without due date appear at the bottom)
                      if (!a.dueDate && !b.dueDate) return 0;
                      if (!a.dueDate) return 1;
                      if (!b.dueDate) return -1;
                      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                    })
                    .map((task, index) => {
                      // Format the date
                      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                      const formattedDate = dueDate ? 
                        dueDate.toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        }) : 'No due date';
                      
                      // Check if task is overdue
                      const isOverdue = dueDate && dueDate < new Date() && task.status !== 'completed';
                      
                      // Status color
                      const statusColor = task.status === 'completed' 
                        ? 'bg-green-500' 
                        : (task.status === 'in_progress' ? 'bg-blue-500' : 'bg-yellow-500');
                      
                      return (
                        <div key={task.id} className="ml-10 mb-6 relative">
                          {/* Timeline dot */}
                          <div className={`absolute -left-[20px] top-1 w-[12px] h-[12px] rounded-full ${statusColor} border-2 border-white z-10`}></div>
                          
                          {/* Due date label */}
                          <div className={`text-sm font-medium mb-1 ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                            {formattedDate}
                            {isOverdue && <span className="ml-2 text-red-600 text-xs">(Overdue)</span>}
                          </div>
                          
                          {/* Task card */}
                          <div className={`border rounded-lg p-4 transition-all ${
                            isOverdue 
                              ? 'border-red-200 bg-red-50' 
                              : (task.status === 'completed' ? 'border-green-100 bg-green-50' : 'bg-white')
                          }`}>
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-medium">{task.title}</h3>
                              <Badge 
                                variant={task.status === 'completed' ? 'default' : (task.status === 'in_progress' ? 'secondary' : 'outline')}
                                className={task.status === 'completed' ? 'bg-green-500' : ''}
                              >
                                {task.status === 'completed' 
                                  ? 'Completed' 
                                  : (task.status === 'in_progress' ? 'In Progress' : 'Todo')}
                              </Badge>
                            </div>
                            
                            {task.description && (
                              <p className="text-sm text-gray-600 mb-2 line-clamp-2">{task.description}</p>
                            )}
                            
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center space-x-2">
                                {task.priority && (
                                  <Badge 
                                    variant="outline" 
                                    className={`
                                      ${task.priority === 'high' 
                                        ? 'text-red-600 border-red-200 bg-red-50' 
                                        : (task.priority === 'medium' 
                                          ? 'text-orange-600 border-orange-200 bg-orange-50' 
                                          : 'text-green-600 border-green-200 bg-green-50')}
                                    `}
                                  >
                                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                                  </Badge>
                                )}
                                
                                {task.assigneeId && task.assignee && (
                                  <div className="flex items-center space-x-1">
                                    <Avatar className="h-6 w-6">
                                      <AvatarFallback>
                                        {task.assignee.username.substring(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs text-gray-500">{task.assignee.username}</span>
                                  </div>
                                )}
                              </div>
                              
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                asChild
                                className="h-7 text-xs"
                              >
                                <Link href={`/tasks/${task.id}`}>
                                  View
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}