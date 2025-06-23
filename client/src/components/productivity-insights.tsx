import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Clock, 
  Target, 
  Calendar,
  Award,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  MessageSquare,
  Bell,
  AtSign
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface ProductivityInsights {
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  overdueTasks: number;
  unreadMessages: number;
  unreadNotifications: number;
  mentions: number;
  completedThisWeek: number;
  completedLastWeek: number;
  completionTrend: number;
  activityThisWeek: number;
  avgCompletionDays: number;
  performanceScore: number;
  projectStats: Array<{
    name: string;
    total: number;
    completed: number;
    completionRate: number;
  }>;
  priorityStats: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  upcomingDeadlines: Array<{
    id: number;
    title: string;
    dueDate: string;
    priority: string;
    project?: string;
    daysUntilDue: number;
  }>;
  weeklyData: Array<{
    week: string;
    completed: number;
    created: number;
    date: string;
  }>;
}

const MetricCard = ({ 
  title, 
  value, 
  icon, 
  trend, 
  trendValue, 
  color = "blue",
  isLoading = false,
  href,
  onClick
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: "blue" | "green" | "amber" | "red" | "purple";
  isLoading?: boolean;
  href?: string;
  onClick?: () => void;
}) => {
  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
    green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    amber: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
  };

  const iconColors = {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-green-600 dark:text-green-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
    purple: "text-purple-600 dark:text-purple-400"
  };

  const cardContent = (
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`${iconColors[color]} p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm`}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            {isLoading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            )}
          </div>
        </div>
        {trend && trendValue && !isLoading && (
          <div className={`flex items-center space-x-1 ${
            trend === 'up' ? 'text-green-600' : 
            trend === 'down' ? 'text-red-600' : 
            'text-gray-600'
          }`}>
            {trend === 'up' ? <TrendingUp size={16} /> : 
             trend === 'down' ? <TrendingDown size={16} /> : null}
            <span className="text-sm font-medium">{trendValue}</span>
          </div>
        )}
      </div>
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className={`${colorClasses[color]} transition-all duration-200 hover:shadow-md cursor-pointer hover:scale-105`}>
          {cardContent}
        </Card>
      </Link>
    );
  }

  if (onClick) {
    return (
      <Card 
        className={`${colorClasses[color]} transition-all duration-200 hover:shadow-md cursor-pointer hover:scale-105`}
        onClick={onClick}
      >
        {cardContent}
      </Card>
    );
  }

  return (
    <Card className={`${colorClasses[color]} transition-all duration-200 hover:shadow-md`}>
      {cardContent}
    </Card>
  );
};

const PRIORITY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function ProductivityInsights() {
  const { data: insights, isLoading } = useQuery<ProductivityInsights>({
    queryKey: ['/api/productivity/insights'],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!insights) return null;

  const completionRate = insights.totalTasks > 0 
    ? Math.round((insights.completedTasks / insights.totalTasks) * 100) 
    : 0;

  const priorityChartData = [
    { name: 'Low', value: insights.priorityStats.low, color: '#3b82f6' },
    { name: 'Medium', value: insights.priorityStats.medium, color: '#10b981' },
    { name: 'High', value: insights.priorityStats.high, color: '#f59e0b' },
    { name: 'Urgent', value: insights.priorityStats.urgent, color: '#ef4444' },
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-8">
      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Performance Score"
          value={`${insights.performanceScore}%`}
          icon={<Award size={20} />}
          color="purple"
          trend={insights.performanceScore >= 80 ? "up" : insights.performanceScore >= 60 ? "neutral" : "down"}
          trendValue={insights.performanceScore >= 80 ? "Excellent" : insights.performanceScore >= 60 ? "Good" : "Needs Focus"}
        />
        
        <MetricCard
          title="Completion Rate"
          value={`${completionRate}%`}
          icon={<Target size={20} />}
          color="green"
          trend={completionRate >= 70 ? "up" : completionRate >= 50 ? "neutral" : "down"}
          trendValue={`${insights.completedTasks}/${insights.totalTasks} tasks`}
        />
        
        <MetricCard
          title="Weekly Activity"
          value={insights.activityThisWeek}
          icon={<Activity size={20} />}
          color="blue"
          trend={insights.completionTrend > 0 ? "up" : insights.completionTrend < 0 ? "down" : "neutral"}
          trendValue={`${insights.completionTrend > 0 ? '+' : ''}${insights.completionTrend}%`}
        />
        
        <MetricCard
          title="Avg. Completion"
          value={`${insights.avgCompletionDays} days`}
          icon={<Clock size={20} />}
          color={insights.avgCompletionDays <= 3 ? "green" : insights.avgCompletionDays <= 7 ? "amber" : "red"}
          trend={insights.avgCompletionDays <= 3 ? "up" : insights.avgCompletionDays <= 7 ? "neutral" : "down"}
          trendValue={insights.avgCompletionDays <= 3 ? "Fast" : insights.avgCompletionDays <= 7 ? "Normal" : "Slow"}
        />
      </div>

      {/* Task Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Tasks"
          value={insights.totalTasks}
          icon={<Target size={20} />}
          color="blue"
          href="/tasks"
        />
        <MetricCard
          title="Completed"
          value={insights.completedTasks}
          icon={<CheckCircle2 size={20} />}
          trend="up"
          trendValue={`+${insights.completionTrend}%`}
          color="green"
          href="/tasks?status=completed"
        />
        <MetricCard
          title="Active Tasks"
          value={insights.activeTasks}
          icon={<Activity size={20} />}
          color="amber"
          href="/tasks?status=active"
        />
        <MetricCard
          title="Overdue"
          value={insights.overdueTasks}
          icon={<AlertCircle size={20} />}
          color="red"
          href="/tasks?status=overdue"
        />
      </div>

      {/* Communication Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Unread Messages"
          value={insights.unreadMessages || 0}
          icon={<MessageSquare size={20} />}
          color="blue"
          href="/direct-messages"
        />
        <MetricCard
          title="Mentions"
          value={insights.mentions || 0}
          icon={<AtSign size={20} />}
          color="purple"
          href="/notifications"
        />
        <MetricCard
          title="Notifications"
          value={insights.unreadNotifications || 0}
          icon={<Bell size={20} />}
          color="amber"
          href="/notifications"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Progress Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 size={20} />
              <span>Weekly Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={insights.weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="week" 
                  className="text-xs"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
                <Bar dataKey="completed" fill="#10b981" name="Completed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="created" fill="#3b82f6" name="Created" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target size={20} />
              <span>Task Priority Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={priorityChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {priorityChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Performance & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle2 size={20} />
              <span>Top Performing Projects</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights.projectStats.length > 0 ? (
                insights.projectStats.map((project, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {project.name}
                      </span>
                      <Badge 
                        variant={project.completionRate >= 80 ? "default" : project.completionRate >= 60 ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {project.completionRate}%
                      </Badge>
                    </div>
                    <Progress value={project.completionRate} className="h-2" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {project.completed} of {project.total} tasks completed
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  No project data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar size={20} />
              <span>Upcoming Deadlines</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.upcomingDeadlines.length > 0 ? (
                insights.upcomingDeadlines.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {task.title}
                      </p>
                      {task.project && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {task.project}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-3">
                      <Badge 
                        variant={task.priority === 'urgent' ? "destructive" : task.priority === 'high' ? "outline" : "secondary"}
                        className="text-xs"
                      >
                        {task.priority}
                      </Badge>
                      <div className="text-right">
                        <p className={`text-xs font-medium ${
                          task.daysUntilDue <= 1 ? 'text-red-600' : 
                          task.daysUntilDue <= 3 ? 'text-amber-600' : 
                          'text-gray-600'
                        }`}>
                          {task.daysUntilDue === 0 ? 'Today' : 
                           task.daysUntilDue === 1 ? 'Tomorrow' : 
                           `${task.daysUntilDue} days`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No upcoming deadlines
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}