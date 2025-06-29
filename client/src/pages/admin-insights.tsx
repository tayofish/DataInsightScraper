import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { 
  Users, 
  Building2, 
  FolderOpen, 
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Activity,
  Target,
  Award
} from 'lucide-react';

interface AdminInsightsData {
  // Overall Stats
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  
  // Department Performance
  departmentStats: Array<{
    id: number;
    name: string;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    completionRate: number;
    activeUsers: number;
  }>;
  
  // Project Performance
  projectStats: Array<{
    id: number;
    name: string;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    completionRate: number;
    status: string;
  }>;
  
  // User Activity
  userActivityStats: Array<{
    period: string;
    activeUsers: number;
    tasksCreated: number;
    tasksCompleted: number;
  }>;
  
  // Task Distribution
  taskPriorityDistribution: Array<{
    priority: string;
    count: number;
    color: string;
  }>;
  
  taskStatusDistribution: Array<{
    status: string;
    count: number;
    color: string;
  }>;
}

const MetricCard = ({ 
  title, 
  value, 
  icon, 
  color = "blue",
  trend,
  trendValue 
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color?: "blue" | "green" | "red" | "orange" | "purple";
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}) => {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200", 
    red: "bg-red-50 text-red-600 border-red-200",
    orange: "bg-orange-50 text-orange-600 border-orange-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200"
  };

  const trendIcons = {
    up: <TrendingUp size={16} className="text-green-500" />,
    down: <TrendingUp size={16} className="text-red-500 rotate-180" />,
    neutral: <Activity size={16} className="text-gray-500" />
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend && trendValue && (
              <div className="flex items-center gap-1 mt-2">
                {trendIcons[trend]}
                <span className="text-xs text-muted-foreground">{trendValue}</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function AdminInsights() {
  const { data: insights, isLoading } = useQuery<AdminInsightsData>({
    queryKey: ['/api/admin/insights'],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Failed to load admin insights</p>
        </div>
      </div>
    );
  }

  const overallCompletionRate = insights.totalTasks > 0 
    ? Math.round((insights.completedTasks / insights.totalTasks) * 100) 
    : 0;

  const userEngagementRate = insights.totalUsers > 0
    ? Math.round((insights.activeUsers / insights.totalUsers) * 100)
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Admin Insights</h1>
        <p className="text-muted-foreground">
          Comprehensive overview of application performance and analytics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Users"
          value={insights.totalUsers}
          icon={<Users size={20} />}
          color="blue"
          trend="up"
          trendValue={`${insights.activeUsers} active`}
        />
        <MetricCard
          title="Total Projects"
          value={insights.totalProjects}
          icon={<FolderOpen size={20} />}
          color="green"
          trend="neutral"
          trendValue="Active projects"
        />
        <MetricCard
          title="Task Completion Rate"
          value={`${overallCompletionRate}%`}
          icon={<CheckCircle2 size={20} />}
          color="green"
          trend={overallCompletionRate >= 70 ? "up" : "down"}
          trendValue={`${insights.completedTasks}/${insights.totalTasks} tasks`}
        />
        <MetricCard
          title="Overdue Tasks"
          value={insights.overdueTasks}
          icon={<Clock size={20} />}
          color="red"
          trend={insights.overdueTasks > 0 ? "down" : "up"}
          trendValue={insights.overdueTasks > 0 ? "Needs attention" : "On track"}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 size={20} />
              Department Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={insights.departmentStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'completionRate' ? `${value}%` : value,
                    name === 'completionRate' ? 'Completion Rate' : 
                    name === 'totalTasks' ? 'Total Tasks' : 'Completed Tasks'
                  ]}
                />
                <Bar dataKey="totalTasks" fill="#8884d8" name="totalTasks" />
                <Bar dataKey="completedTasks" fill="#82ca9d" name="completedTasks" />
                <Bar dataKey="completionRate" fill="#ffc658" name="completionRate" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Task Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target size={20} />
              Task Priority Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={insights.taskPriorityDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ priority, count, percent }) => `${priority}: ${count} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {insights.taskPriorityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Project Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen size={20} />
              Project Completion Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={insights.projectStats.slice(0, 10)} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={120}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip formatter={(value) => [`${value}%`, 'Completion Rate']} />
                <Bar dataKey="completionRate" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Task Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity size={20} />
              Task Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={insights.taskStatusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, count, percent }) => `${status}: ${count} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {insights.taskStatusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* User Activity Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={20} />
            User Activity Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={insights.userActivityStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="activeUsers" 
                stroke="#8884d8" 
                strokeWidth={2}
                name="Active Users"
              />
              <Line 
                type="monotone" 
                dataKey="tasksCreated" 
                stroke="#82ca9d" 
                strokeWidth={2}
                name="Tasks Created"
              />
              <Line 
                type="monotone" 
                dataKey="tasksCompleted" 
                stroke="#ffc658" 
                strokeWidth={2}
                name="Tasks Completed"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Department Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 size={20} />
            Department Detailed Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Department</th>
                  <th className="text-right p-3 font-medium">Active Users</th>
                  <th className="text-right p-3 font-medium">Total Tasks</th>
                  <th className="text-right p-3 font-medium">Completed</th>
                  <th className="text-right p-3 font-medium">Overdue</th>
                  <th className="text-right p-3 font-medium">Completion Rate</th>
                </tr>
              </thead>
              <tbody>
                {insights.departmentStats.map((dept) => (
                  <tr key={dept.id} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-medium">{dept.name}</td>
                    <td className="text-right p-3">{dept.activeUsers}</td>
                    <td className="text-right p-3">{dept.totalTasks}</td>
                    <td className="text-right p-3">{dept.completedTasks}</td>
                    <td className="text-right p-3">
                      <span className={dept.overdueTasks > 0 ? "text-red-600" : "text-green-600"}>
                        {dept.overdueTasks}
                      </span>
                    </td>
                    <td className="text-right p-3">
                      <div className="flex items-center justify-end gap-2">
                        <Progress value={dept.completionRate} className="w-16" />
                        <span className="text-sm font-medium">{dept.completionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}