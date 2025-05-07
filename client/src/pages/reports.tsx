import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar, BarChart2, BarChart, PieChart, Trash2, Download, Save, RefreshCw, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Report, reportFormSchema } from '@shared/schema';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';

type ReportFormValues = z.infer<typeof reportFormSchema>;

export default function ReportsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('list');
  const [activeReportId, setActiveReportId] = useState<number | null>(null);
  const [reportResults, setReportResults] = useState<any | null>(null);

  // Fetch reports
  const { data: reports = [], isLoading: reportsLoading, refetch: refetchReports } = useQuery({
    queryKey: ['/api/reports'],
    queryFn: async () => {
      const res = await fetch('/api/reports');
      if (!res.ok) throw new Error('Failed to fetch reports');
      return res.json();
    }
  });

  // Create report mutation
  const createReportMutation = useMutation({
    mutationFn: async (data: ReportFormValues) => {
      const res = await apiRequest('POST', '/api/reports', data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Report created',
        description: 'The report was created successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      setActiveTab('list');
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create report',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Delete report mutation
  const deleteReportMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/reports/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Report deleted',
        description: 'The report was deleted successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete report',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Run report mutation
  const runReportMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/reports/${id}/generate`);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Report generated',
        description: 'The report was generated successfully.',
      });
      setReportResults(data);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to generate report',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'task_status_summary',
      parameters: ''
    }
  });

  function onSubmit(values: ReportFormValues) {
    // Add the current user's ID to the form data
    if (user) {
      createReportMutation.mutate({
        ...values,
        createdBy: user.id
      });
    } else {
      toast({
        title: 'Error',
        description: 'You must be logged in to create a report',
        variant: 'destructive'
      });
    }
  }

  function runReport(report: Report) {
    setActiveReportId(report.id);
    setActiveTab('results');
    runReportMutation.mutate(report.id);
  }

  function formatDate(dateStr: string | Date) {
    try {
      if (dateStr instanceof Date) {
        return format(dateStr, 'MMM d, yyyy h:mm a');
      }
      return format(new Date(dateStr), 'MMM d, yyyy h:mm a');
    } catch (e) {
      return String(dateStr);
    }
  }

  function getReportTypeBadge(type: string) {
    switch (type) {
      case 'tasks_by_project':
        return <Badge variant="secondary" className="bg-blue-100 hover:bg-blue-100 text-blue-800"><BarChart2 className="w-3 h-3 mr-1" /> Tasks by Project</Badge>;
      case 'user_performance':
        return <Badge variant="secondary" className="bg-green-100 hover:bg-green-100 text-green-800"><BarChart className="w-3 h-3 mr-1" /> User Performance</Badge>;
      case 'task_status_summary':
        return <Badge variant="secondary" className="bg-purple-100 hover:bg-purple-100 text-purple-800"><PieChart className="w-3 h-3 mr-1" /> Task Status Summary</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  }

  // Function to export report data as CSV
  function exportReportData() {
    if (!reportResults) return;
    
    const { reportType, data, generatedAt } = reportResults;
    let csvContent = "";
    let filename = `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`;
    
    // Format CSV header and data based on report type
    if (reportType === 'tasks_by_project') {
      csvContent = "Project,Total Tasks,Completed Tasks,Completion Rate\n";
      data.forEach((item: any) => {
        const completionRate = item.totalTasks > 0 
          ? Math.round((item.completedTasks / item.totalTasks) * 100) 
          : 0;
        csvContent += `"${item.projectName}",${item.totalTasks},${item.completedTasks},${completionRate}%\n`;
      });
    } else if (reportType === 'user_performance') {
      csvContent = "User,Total Tasks,Completed,In Progress,Todo,Overdue\n";
      data.forEach((item: any) => {
        csvContent += `"${item.userName}",${item.totalAssigned},${item.completed},${item.inProgress},${item.todo},${item.overdue}\n`;
      });
    } else if (reportType === 'task_status_summary') {
      const { numTasks, numTodo, numInProgress, numCompleted, numOverdue } = reportResults.data;
      csvContent = "Status,Number of Tasks\n";
      csvContent += `"Todo",${numTodo}\n`;
      csvContent += `"In Progress",${numInProgress}\n`;
      csvContent += `"Completed",${numCompleted}\n`;
      csvContent += `"Overdue",${numOverdue}\n`;
      csvContent += `\nPriority Breakdown:\n`;
      csvContent += `"Low",${reportResults.data.byPriority.low}\n`;
      csvContent += `"Medium",${reportResults.data.byPriority.medium}\n`;
      csvContent += `"High",${reportResults.data.byPriority.high}\n`;
    }
    
    // Create a download link and trigger it
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: 'Report exported',
      description: `Report has been exported as ${filename}`,
    });
  }

  function renderReportResults() {
    if (!reportResults) {
      return (
        <div className="flex flex-col items-center justify-center p-8">
          <p className="text-gray-500">Select a report and run it to see results</p>
        </div>
      );
    }

    const { reportType, data, generatedAt } = reportResults;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Report Results</h3>
            <p className="text-sm text-gray-500">Generated on {formatDate(generatedAt)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportReportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        <Separator />

        {reportType === 'tasks_by_project' && renderTasksByProjectChart()}
        {reportType === 'user_performance' && renderUserPerformanceChart()}
        {reportType === 'task_status_summary' && renderTaskStatusSummary()}
      </div>
    );
  }

  function renderTasksByProjectChart() {
    if (!reportResults || !reportResults.data) return null;

    const chartData = reportResults.data.map((item: any) => ({
      project: item.projectName,
      total: item.totalTasks,
      completed: item.completedTasks,
    }));

    return (
      <div className="space-y-6">
        <div className="h-[400px]">
          <ResponsiveBar
            data={chartData}
            keys={['total', 'completed']}
            indexBy="project"
            margin={{ top: 50, right: 130, bottom: 60, left: 60 }}
            padding={0.3}
            valueScale={{ type: 'linear' }}
            indexScale={{ type: 'band', round: true }}
            colors={['#93c5fd', '#3b82f6']}
            borderRadius={4}
            borderWidth={1}
            borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
            axisTop={null}
            axisRight={null}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: -45,
              legend: 'Project',
              legendPosition: 'middle',
              legendOffset: 50
            }}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: 'Number of Tasks',
              legendPosition: 'middle',
              legendOffset: -40
            }}
            legends={[
              {
                dataFrom: 'keys',
                anchor: 'bottom-right',
                direction: 'column',
                justify: false,
                translateX: 120,
                translateY: 0,
                itemsSpacing: 2,
                itemWidth: 100,
                itemHeight: 20,
                itemDirection: 'left-to-right',
                itemOpacity: 0.85,
                symbolSize: 20,
                effects: [
                  {
                    on: 'hover',
                    style: {
                      itemOpacity: 1
                    }
                  }
                ]
              }
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Project</th>
                <th className="px-6 py-3">Total Tasks</th>
                <th className="px-6 py-3">Completed Tasks</th>
                <th className="px-6 py-3">Completion Rate</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportResults.data.map((item: any, index: number) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">{item.projectName}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.totalTasks}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.completedTasks}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.totalTasks > 0 
                      ? `${Math.round((item.completedTasks / item.totalTasks) * 100)}%` 
                      : '0%'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderUserPerformanceChart() {
    if (!reportResults || !reportResults.data) return null;

    const chartData = reportResults.data.map((item: any) => ({
      user: item.userName,
      completed: item.completed,
      inProgress: item.inProgress,
      todo: item.todo,
      overdue: item.overdue
    }));

    return (
      <div className="space-y-6">
        <div className="h-[400px]">
          <ResponsiveBar
            data={chartData}
            keys={['completed', 'inProgress', 'todo', 'overdue']}
            indexBy="user"
            margin={{ top: 50, right: 130, bottom: 60, left: 60 }}
            padding={0.3}
            valueScale={{ type: 'linear' }}
            indexScale={{ type: 'band', round: true }}
            colors={['#10b981', '#6366f1', '#f59e0b', '#ef4444']}
            borderRadius={4}
            borderWidth={1}
            borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
            axisTop={null}
            axisRight={null}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: -45,
              legend: 'User',
              legendPosition: 'middle',
              legendOffset: 50
            }}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: 'Number of Tasks',
              legendPosition: 'middle',
              legendOffset: -40
            }}
            legends={[
              {
                dataFrom: 'keys',
                anchor: 'bottom-right',
                direction: 'column',
                justify: false,
                translateX: 120,
                translateY: 0,
                itemsSpacing: 2,
                itemWidth: 100,
                itemHeight: 20,
                itemDirection: 'left-to-right',
                itemOpacity: 0.85,
                symbolSize: 20,
                effects: [
                  {
                    on: 'hover',
                    style: {
                      itemOpacity: 1
                    }
                  }
                ]
              }
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Total Tasks</th>
                <th className="px-6 py-3">Completed</th>
                <th className="px-6 py-3">In Progress</th>
                <th className="px-6 py-3">Todo</th>
                <th className="px-6 py-3">Overdue</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportResults.data.map((item: any, index: number) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">{item.userName}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.totalAssigned}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.completed}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.inProgress}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.todo}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-red-600">{item.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderTaskStatusSummary() {
    if (!reportResults || !reportResults.data) return null;

    const { numTasks, numTodo, numInProgress, numCompleted, numOverdue, byPriority, byCategory, byProject, recentlyCompleted } = reportResults.data;

    const statusPieData = [
      { id: 'Todo', label: 'Todo', value: numTodo, color: '#f59e0b' },
      { id: 'In Progress', label: 'In Progress', value: numInProgress, color: '#6366f1' },
      { id: 'Completed', label: 'Completed', value: numCompleted, color: '#10b981' },
    ];

    const priorityPieData = [
      { id: 'Low', label: 'Low', value: byPriority.low, color: '#94a3b8' },
      { id: 'Medium', label: 'Medium', value: byPriority.medium, color: '#f59e0b' },
      { id: 'High', label: 'High', value: byPriority.high, color: '#ef4444' },
    ];

    // Transform category data for pie chart
    const categoryPieData = Object.keys(byCategory).map(category => ({
      id: category,
      label: category,
      value: byCategory[category]
    }));

    // Transform project data for pie chart  
    const projectPieData = Object.keys(byProject).map(project => ({
      id: project,
      label: project,
      value: byProject[project]
    }));

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Status overview */}
          <Card>
            <CardHeader>
              <CardTitle>Tasks by Status</CardTitle>
              <CardDescription>Distribution of tasks by their current status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsivePie
                  data={statusPieData}
                  margin={{ top: 40, right: 80, bottom: 40, left: 80 }}
                  innerRadius={0.5}
                  padAngle={0.7}
                  cornerRadius={3}
                  colors={{ scheme: 'set2' }}
                  borderWidth={1}
                  borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                  arcLabelsSkipAngle={10}
                  arcLabelsTextColor="#ffffff"
                  animate={true}
                />
              </div>
            </CardContent>
            <CardFooter className="bg-gray-50 px-6 py-3">
              <div className="grid grid-cols-4 w-full gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="text-xl font-bold">{numTasks}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Todo</p>
                  <p className="text-xl font-bold text-amber-500">{numTodo}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">In Progress</p>
                  <p className="text-xl font-bold text-indigo-500">{numInProgress}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-xl font-bold text-emerald-500">{numCompleted}</p>
                </div>
              </div>
            </CardFooter>
          </Card>

          {/* Priority overview */}
          <Card>
            <CardHeader>
              <CardTitle>Tasks by Priority</CardTitle>
              <CardDescription>Distribution of tasks by their priority level</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsivePie
                  data={priorityPieData}
                  margin={{ top: 40, right: 80, bottom: 40, left: 80 }}
                  innerRadius={0.5}
                  padAngle={0.7}
                  cornerRadius={3}
                  colors={{ scheme: 'set3' }}
                  borderWidth={1}
                  borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                  arcLabelsSkipAngle={10}
                  arcLabelsTextColor="#ffffff"
                  animate={true}
                />
              </div>
            </CardContent>
            <CardFooter className="bg-gray-50 px-6 py-3">
              <div className="grid grid-cols-3 w-full gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-500">Low</p>
                  <p className="text-xl font-bold text-slate-500">{byPriority.low}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Medium</p>
                  <p className="text-xl font-bold text-amber-500">{byPriority.medium}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">High</p>
                  <p className="text-xl font-bold text-red-500">{byPriority.high}</p>
                </div>
              </div>
            </CardFooter>
          </Card>
        </div>

        {/* Overdue tasks alert */}
        {numOverdue > 0 && (
          <Alert variant="destructive">
            <AlertTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Overdue Tasks
            </AlertTitle>
            <AlertDescription>
              There {numOverdue === 1 ? 'is' : 'are'} <strong>{numOverdue}</strong> overdue {numOverdue === 1 ? 'task' : 'tasks'} that {numOverdue === 1 ? 'has' : 'have'} passed their due date but {numOverdue === 1 ? 'is' : 'are'} not completed.
            </AlertDescription>
          </Alert>
        )}

        {/* Tasks by category */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks by Category</CardTitle>
            <CardDescription>Distribution of tasks across different categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsivePie
                data={categoryPieData}
                margin={{ top: 40, right: 80, bottom: 40, left: 80 }}
                innerRadius={0.5}
                padAngle={0.7}
                cornerRadius={3}
                colors={{ scheme: 'category10' }}
                borderWidth={1}
                borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                arcLabelsSkipAngle={10}
                arcLabelsTextColor="#ffffff"
                animate={true}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tasks by project */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks by Project</CardTitle>
            <CardDescription>Distribution of tasks across different projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsivePie
                data={projectPieData}
                margin={{ top: 40, right: 80, bottom: 40, left: 80 }}
                innerRadius={0.5}
                padAngle={0.7}
                cornerRadius={3}
                colors={{ scheme: 'set1' }}
                borderWidth={1}
                borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                arcLabelsSkipAngle={10}
                arcLabelsTextColor="#ffffff"
                animate={true}
              />
            </div>
          </CardContent>
        </Card>

        {/* Recently completed tasks */}
        {recentlyCompleted && recentlyCompleted.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recently Completed Tasks</CardTitle>
              <CardDescription>The 5 most recently completed tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {recentlyCompleted.map((task: any, index: number) => (
                  <li key={index} className="py-3">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-gray-500">
                          {task.project} / {task.category}
                        </p>
                      </div>
                      <p className="text-sm text-gray-500">{formatDate(task.completedAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-gray-500">Generate and analyze reports on tasks, projects, and team performance</p>
        </div>
        <Button onClick={() => setActiveTab('create')}>
          <PlusCircle className="mr-2 h-4 w-4" /> New Report
        </Button>
      </div>

      <Tabs 
        defaultValue="list" 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list">Reports List</TabsTrigger>
          <TabsTrigger value="create">Create Report</TabsTrigger>
          <TabsTrigger value="results">Report Results</TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="mt-6">
          {reportsLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center p-8 border rounded-lg bg-gray-50">
              <h3 className="text-lg font-medium mb-2">No reports yet</h3>
              <p className="text-gray-500 mb-4">Create your first report to start analyzing your data</p>
              <Button onClick={() => setActiveTab('create')}>
                <PlusCircle className="mr-2 h-4 w-4" /> Create Report
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {reports.map((report: Report) => (
                <Card key={report.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl">{report.name}</CardTitle>
                      <div>{getReportTypeBadge(report.type)}</div>
                    </div>
                    <CardDescription>{report.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="flex flex-col space-y-1 text-sm text-gray-500">
                      <div className="flex justify-between">
                        <span>Created:</span>
                        <span>{formatDate(report.createdAt)}</span>
                      </div>
                      {report.lastRunAt && (
                        <div className="flex justify-between">
                          <span>Last Generated:</span>
                          <span>{formatDate(report.lastRunAt)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between pt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => deleteReportMutation.mutate(report.id)}
                      disabled={deleteReportMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => runReport(report)}
                      disabled={runReportMutation.isPending}
                    >
                      {runReportMutation.isPending && activeReportId === report.id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-1" />
                      )}
                      Generate
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="create" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Report</CardTitle>
              <CardDescription>Set up a new report to analyze your project data</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Report Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Q2 Task Status Overview" {...field} />
                        </FormControl>
                        <FormDescription>
                          Give your report a clear descriptive name
                        </FormDescription>
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
                          <Input placeholder="Overview of all task statuses in Q2" {...field} />
                        </FormControl>
                        <FormDescription>
                          A brief description of what this report shows
                        </FormDescription>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                          The type of analysis to perform
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="mr-2"
                      onClick={() => setActiveTab('list')}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createReportMutation.isPending}
                    >
                      {createReportMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Create Report
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="results" className="mt-6">
          {renderReportResults()}
        </TabsContent>
      </Tabs>
    </div>
  );
}