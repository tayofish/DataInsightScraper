import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Report } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, FilePlus, FolderCheck, Loader2, PieChart as PieChartIcon, BarChart2, AlertCircle } from "lucide-react";

// Define schema for the new report form
const reportFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  type: z.enum(["tasks_by_project", "user_performance", "task_status_summary"], {
    required_error: "Please select a report type",
  }),
  parameters: z.string().optional()
});

type ReportFormValues = z.infer<typeof reportFormSchema>;

export default function ReportsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [reportResults, setReportResults] = useState<any | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch all reports
  const { data: reports = [], isLoading: reportsLoading, refetch: refetchReports } = useQuery<Report[]>({
    queryKey: ['/api/reports'],
    queryFn: async () => {
      const res = await fetch('/api/reports');
      if (!res.ok) throw new Error('Failed to fetch reports');
      return res.json();
    }
  });

  // Create new report mutation
  const createReportMutation = useMutation({
    mutationFn: async (data: ReportFormValues) => {
      return apiRequest('POST', '/api/reports', data);
    },
    onSuccess: () => {
      toast({
        title: "Report created",
        description: "Your report has been created successfully."
      });
      setIsCreateDialogOpen(false);
      refetchReports();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create report",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: number) => {
      return apiRequest('DELETE', `/api/reports/${reportId}`);
    },
    onSuccess: () => {
      toast({
        title: "Report deleted",
        description: "The report has been deleted successfully."
      });
      if (activeReport) setActiveReport(null);
      refetchReports();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete report",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async (reportId: number) => {
      setIsGenerating(true);
      try {
        const res = await apiRequest('POST', `/api/reports/${reportId}/generate`);
        return await res.json();
      } finally {
        setIsGenerating(false);
      }
    },
    onSuccess: (data) => {
      setReportResults(data);
      toast({
        title: "Report generated",
        description: "The report has been generated successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate report",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Form handling for creating a new report
  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "task_status_summary",
      parameters: ""
    }
  });

  function onSubmit(values: ReportFormValues) {
    createReportMutation.mutate(values);
  }

  // Function to run/generate a report
  function runReport(report: Report) {
    setActiveReport(report);
    generateReportMutation.mutate(report.id);
  }

  // Function to format date for display
  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  // Helper to render report type badge
  function getReportTypeBadge(type: string) {
    switch (type) {
      case 'tasks_by_project':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Tasks by Project</Badge>;
      case 'user_performance':
        return <Badge variant="outline" className="bg-green-50 text-green-700">User Performance</Badge>;
      case 'task_status_summary':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700">Task Status Summary</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  }

  // Helper function to render chart based on report type
  function renderReportResults() {
    if (!reportResults || !activeReport) return null;

    switch (activeReport.type) {
      case 'tasks_by_project':
        return renderTasksByProjectChart();
      case 'user_performance':
        return renderUserPerformanceChart();
      case 'task_status_summary':
        return renderTaskStatusSummary();
      default:
        return (
          <div className="p-8 text-center text-muted-foreground">
            <p>Unsupported report type: {activeReport.type}</p>
          </div>
        );
    }
  }

  function renderTasksByProjectChart() {
    if (!reportResults?.data || !Array.isArray(reportResults.data)) {
      return <div className="p-8 text-center text-muted-foreground">No data available</div>;
    }

    const chartData = reportResults.data.map((item: any) => ({
      name: item.projectName || 'Unassigned',
      tasks: item.totalTasks,
      completed: item.completedTasks,
      inProgress: item.inProgressTasks, 
      todo: item.todoTasks
    }));

    return (
      <div className="p-4">
        <h3 className="text-lg font-medium mb-4">Tasks by Project</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="todo" name="To Do" fill="#f59e0b" />
              <Bar dataKey="inProgress" name="In Progress" fill="#3b82f6" />
              <Bar dataKey="completed" name="Completed" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  function renderUserPerformanceChart() {
    if (!reportResults?.data || !Array.isArray(reportResults.data)) {
      return <div className="p-8 text-center text-muted-foreground">No data available</div>;
    }

    const chartData = reportResults.data.map((item: any) => ({
      name: item.userName || 'Unassigned',
      completionRate: Math.round(item.completionRate * 100),
      tasks: item.totalTasks,
      completed: item.completedTasks,
      overdue: item.overdueTasks
    }));

    return (
      <div className="p-4">
        <h3 className="text-lg font-medium mb-4">User Performance</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
              <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
              <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
              <Tooltip />
              <Bar yAxisId="left" dataKey="completionRate" name="Completion %" fill="#8884d8" />
              <Bar yAxisId="right" dataKey="tasks" name="Total Tasks" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  function renderTaskStatusSummary() {
    if (!reportResults?.data) {
      return <div className="p-8 text-center text-muted-foreground">No data available</div>;
    }

    const { data } = reportResults;
    
    // Status chart data
    const statusData = [
      { name: 'To Do', value: data.todo },
      { name: 'In Progress', value: data.in_progress },
      { name: 'Completed', value: data.completed },
      { name: 'Overdue', value: data.overdue }
    ];
    
    // Priority chart data
    const priorityData = [
      { name: 'Low', value: data.byPriority.low },
      { name: 'Medium', value: data.byPriority.medium },
      { name: 'High', value: data.byPriority.high }
    ];

    const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'];
    const PRIORITY_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

    return (
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-medium mb-4">Task Status Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-medium mb-4">Task Priority Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[index % PRIORITY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary statistics */}
        <div className="md:col-span-2">
          <h3 className="text-lg font-medium mb-4">Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.total}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {data.total ? Math.round((data.completed / data.total) * 100) : 0}%
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{data.in_progress}</div>
              </CardContent>
            </Card>
            
            <Card className={data.overdue > 0 ? "border-red-200 bg-red-50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.overdue > 0 ? "text-red-600" : ""}`}>
                  {data.overdue}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Recently completed tasks */}
          {data.recentlyCompleted && data.recentlyCompleted.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-4">Recently Completed Tasks</h3>
              <div className="space-y-2">
                {data.recentlyCompleted.map((task: any) => (
                  <div key={task.id} className="flex items-center p-3 border rounded-md bg-green-50">
                    <FolderCheck className="h-5 w-5 mr-2 text-green-500" />
                    <div>
                      <div className="font-medium">{task.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {task.project} • {task.category} • Completed: {formatDate(task.completedAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold gradient-heading">Reports</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <FilePlus className="h-4 w-4 mr-2" />
          Create Report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Available Reports</CardTitle>
              <CardDescription>Select a report to view or generate</CardDescription>
            </CardHeader>
            <CardContent>
              {reportsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <PieChartIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p>No reports available</p>
                  <p className="text-sm">Create your first report to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reports.map(report => (
                    <div
                      key={report.id}
                      className={`p-3 rounded-md cursor-pointer transition-colors ${activeReport?.id === report.id ? 'bg-primary/10 border-primary/20 border' : 'hover:bg-muted border'}`}
                      onClick={() => setActiveReport(report)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium">{report.name}</div>
                        {getReportTypeBadge(report.type)}
                      </div>
                      {report.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{report.description}</p>
                      )}
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Created: {formatDate(report.createdAt)}</span>
                        {report.lastRunAt && <span>Last run: {formatDate(report.lastRunAt)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          {activeReport ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    {activeReport.name}
                    {getReportTypeBadge(activeReport.type)}
                  </CardTitle>
                  {activeReport.description && (
                    <CardDescription>{activeReport.description}</CardDescription>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={isGenerating}
                    onClick={() => runReport(activeReport)}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <BarChart2 className="h-4 w-4 mr-2" />
                        Generate Report
                      </>
                    )}
                  </Button>
                  {user?.id === activeReport.createdBy && (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this report?")) {
                          deleteReportMutation.mutate(activeReport.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {reportResults ? (
                  <div>
                    <div className="text-sm text-muted-foreground mb-4">
                      Generated on: {formatDate(reportResults.generatedAt)}
                    </div>
                    {renderReportResults()}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BarChart2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-medium mb-2">No data to display</h3>
                    <p className="text-muted-foreground">Click "Generate Report" to run this report and see the results.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-muted/40 rounded-lg border border-dashed">
              <PieChartIcon className="h-16 w-16 mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No Report Selected</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Select a report from the list or create a new one to get started.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <FilePlus className="h-4 w-4 mr-2" />
                Create Report
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Create Report Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Report</DialogTitle>
            <DialogDescription>
              Create a new report to analyze task performance and project status.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Monthly Task Status Summary" {...field} />
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
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="A summary of task statuses across all projects..."
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a report type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="task_status_summary">Task Status Summary</SelectItem>
                        <SelectItem value="tasks_by_project">Tasks by Project</SelectItem>
                        <SelectItem value="user_performance">User Performance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the type of data you want to analyze
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createReportMutation.isPending}>
                  {createReportMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Report'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}