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
  Award,
  Trophy
} from 'lucide-react';
import { useLocation } from 'wouter';

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
  trendValue,
  onClick 
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color?: "blue" | "green" | "red" | "orange" | "purple";
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  onClick?: () => void;
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
    <Card 
      className={`transition-all duration-200 ${
        onClick 
          ? "hover:shadow-lg hover:scale-[1.02] cursor-pointer hover:bg-gray-50" 
          : "hover:shadow-md"
      }`}
      onClick={onClick}
    >
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
  const [, setLocation] = useLocation();
  const { data: insights, isLoading } = useQuery<AdminInsightsData>({
    queryKey: ['/api/admin/insights'],
  });

  const handleCardClick = (type: string) => {
    switch (type) {
      case 'users':
        setLocation('/teams');
        break;
      case 'projects':
        setLocation('/projects');
        break;
      case 'completed':
        setLocation('/tasks?status=completed');
        break;
      case 'overdue':
        setLocation('/tasks?customFilter=overdue');
        break;
      default:
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Failed to load admin insights</p>
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
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Users"
          value={insights.totalUsers}
          icon={<Users size={20} />}
          color="blue"
          trend="up"
          trendValue={`${insights.activeUsers} active`}
          onClick={() => handleCardClick('users')}
        />
        <MetricCard
          title="Total Projects"
          value={insights.totalProjects}
          icon={<FolderOpen size={20} />}
          color="green"
          trend="neutral"
          trendValue="Active projects"
          onClick={() => handleCardClick('projects')}
        />
        <MetricCard
          title="Task Completion Rate"
          value={`${overallCompletionRate}%`}
          icon={<CheckCircle2 size={20} />}
          color="green"
          trend={overallCompletionRate >= 70 ? "up" : "down"}
          trendValue={`${insights.completedTasks}/${insights.totalTasks} tasks`}
          onClick={() => handleCardClick('completed')}
        />
        <MetricCard
          title="Overdue Tasks"
          value={insights.overdueTasks}
          icon={<Clock size={20} />}
          color="red"
          trend={insights.overdueTasks > 0 ? "down" : "up"}
          trendValue={insights.overdueTasks > 0 ? "Needs attention" : "On track"}
          onClick={() => handleCardClick('overdue')}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Performing Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy size={20} />
              Top Performing Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.projectStats
                .sort((a, b) => b.completionRate - a.completionRate)
                .slice(0, 5)
                .map((project, index) => (
                  <div 
                    key={project.id} 
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setLocation(`/projects/${project.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{project.name}</div>
                        <div className="text-xs text-muted-foreground">{project.totalTasks} tasks</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">{project.completionRate}%</div>
                      <div className="text-xs text-muted-foreground">{project.completedTasks}/{project.totalTasks}</div>
                    </div>
                  </div>
                ))}
            </div>
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

      {/* Unit Performance Chart - Full Width */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 size={20} />
            Unit Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
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
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Project Performance Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen size={20} />
            Project Performance Overview
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Project metrics with completion status and task breakdown
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Project</th>
                  <th className="text-center p-3 font-medium">Status</th>
                  <th className="text-center p-3 font-medium">Completion</th>
                  <th className="text-center p-3 font-medium">Total Tasks</th>
                  <th className="text-center p-3 font-medium">In Progress</th>
                  <th className="text-center p-3 font-medium">Completed</th>
                  <th className="text-center p-3 font-medium">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {insights.projectStats
                  .sort((a, b) => a.completionRate - b.completionRate)
                  .map((project) => {
                  const inProgressTasks = project.totalTasks - project.completedTasks;
                  const overdueTasks = project.overdueTasks;
                  
                  return (
                    <tr 
                      key={project.id} 
                      className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/projects/${project.id}`)}
                    >
                      <td className="p-3">
                        <div className="font-medium text-primary hover:underline">{project.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          <Progress value={project.completionRate} className="w-24 h-1" />
                        </div>
                      </td>
                      <td className="text-center p-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          project.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          project.status === 'on-hold' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }`}>
                          {project.status}
                        </span>
                      </td>
                      <td className="text-center p-3">
                        <div className="font-bold text-lg">{project.completionRate}%</div>
                      </td>
                      <td className="text-center p-3">
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {project.totalTasks}
                        </span>
                      </td>
                      <td className="text-center p-3">
                        <span className="font-medium text-yellow-600 dark:text-yellow-400">
                          {inProgressTasks}
                        </span>
                      </td>
                      <td className="text-center p-3">
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {project.completedTasks}
                        </span>
                      </td>
                      <td className="text-center p-3">
                        <span className={`font-medium ${overdueTasks > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                          {overdueTasks}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Charts Section - First Row */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 mb-6">
        {/* User Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={20} />
              User Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={insights.userActivityStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="period" 
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
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
      </div>



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