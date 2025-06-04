import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCheck, Clock, ListTodo, AlertTriangle } from 'lucide-react';
import { useLocation } from 'wouter';
import { TaskFilterValues } from './task-filters';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
  isLoading?: boolean;
  onClick?: () => void;
}

const StatCard = ({ title, value, icon, iconBgColor, iconColor, isLoading = false, onClick }: StatCardProps) => {
  return (
    <Card 
      className="hover:shadow-lg cursor-pointer relative transition-all duration-200 border border-gray-200 bg-white"
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`flex-shrink-0 ${iconBgColor} rounded-lg p-3`}>
              <div className={iconColor}>{icon}</div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
              {isLoading ? (
                <Skeleton className="h-8 w-20 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
              )}
            </div>
          </div>
        </div>
        <div className={`absolute bottom-0 left-0 right-0 w-full h-1.5 rounded-b-lg ${
          iconColor.includes('blue') ? 'bg-gradient-to-r from-blue-500 to-transparent' : 
          iconColor.includes('green') ? 'bg-gradient-to-r from-green-500 to-transparent' : 
          iconColor.includes('amber') ? 'bg-gradient-to-r from-amber-500 to-transparent' : 
          'bg-gradient-to-r from-red-500 to-transparent'
        }`}></div>
      </CardContent>
    </Card>
  );
};

interface TaskStatistics {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

interface DashboardStatsProps {
  onFilterChange?: (filters: TaskFilterValues) => void;
}

export default function DashboardStats({ onFilterChange }: DashboardStatsProps) {
  const { data, isLoading } = useQuery<TaskStatistics>({
    queryKey: ['/api/tasks/statistics'],
  });
  const [, navigate] = useLocation();

  const statistics = {
    total: data?.total || 0,
    completed: data?.completed || 0,
    pending: data?.pending || 0,
    overdue: data?.overdue || 0
  };

  // Function to reset filters to default and apply only specific filters
  const resetAndApplyFilter = (filterUpdates: Partial<TaskFilterValues>) => {
    if (onFilterChange) {
      // If onFilterChange prop is provided, use it (for in-page filtering)
      onFilterChange({
        assigneeId: null,
        projectId: null,
        categoryId: null,
        department: '',
        status: 'all',
        priority: 'all',
        search: '',
        sortBy: 'dueDate',
        ...filterUpdates
      });
    } else {
      // Otherwise, navigate to tasks page with query params (for cross-page navigation)
      const queryParams = new URLSearchParams();
      Object.entries(filterUpdates).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          queryParams.set(key, value.toString());
        }
      });
      navigate(`/tasks?${queryParams.toString()}`);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      <StatCard
        title="Total Tasks"
        value={statistics.total}
        icon={<ListTodo size={20} />}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        isLoading={isLoading}
        onClick={() => resetAndApplyFilter({})}
      />
      
      <StatCard
        title="Completed"
        value={statistics.completed}
        icon={<CheckCheck size={20} />}
        iconBgColor="bg-green-100"
        iconColor="text-green-600"
        isLoading={isLoading}
        onClick={() => resetAndApplyFilter({ status: 'completed' })}
      />
      
      <StatCard
        title="Pending"
        value={statistics.pending}
        icon={<Clock size={20} />}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-600"
        isLoading={isLoading}
        onClick={() => resetAndApplyFilter({ status: 'todo,in_progress' })}
      />
      
      <StatCard
        title="Overdue"
        value={statistics.overdue}
        icon={<AlertTriangle size={20} />}
        iconBgColor="bg-red-100"
        iconColor="text-red-600"
        isLoading={isLoading}
        onClick={() => resetAndApplyFilter({ customFilter: 'overdue' })}
      />
    </div>
  );
}
