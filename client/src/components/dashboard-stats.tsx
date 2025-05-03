import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCheck, Clock, ListTodo, AlertTriangle } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
  isLoading?: boolean;
}

const StatCard = ({ title, value, icon, iconBgColor, iconColor, isLoading = false }: StatCardProps) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center">
          <div className={`flex-shrink-0 ${iconBgColor} rounded-md p-3`}>
            <div className={iconColor}>{icon}</div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd>
                {isLoading ? (
                  <Skeleton className="h-7 w-16 mt-1" />
                ) : (
                  <div className="text-xl font-semibold text-gray-900">{value}</div>
                )}
              </dd>
            </dl>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function DashboardStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/tasks/statistics'],
  });

  const statistics = {
    total: data?.total || 0,
    completed: data?.completed || 0,
    pending: data?.pending || 0,
    overdue: data?.overdue || 0
  };

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Tasks"
        value={statistics.total}
        icon={<ListTodo size={20} />}
        iconBgColor="bg-blue-100"
        iconColor="text-blue-600"
        isLoading={isLoading}
      />
      
      <StatCard
        title="Completed"
        value={statistics.completed}
        icon={<CheckCheck size={20} />}
        iconBgColor="bg-green-100"
        iconColor="text-green-600"
        isLoading={isLoading}
      />
      
      <StatCard
        title="Pending"
        value={statistics.pending}
        icon={<Clock size={20} />}
        iconBgColor="bg-amber-100"
        iconColor="text-amber-600"
        isLoading={isLoading}
      />
      
      <StatCard
        title="Overdue"
        value={statistics.overdue}
        icon={<AlertTriangle size={20} />}
        iconBgColor="bg-red-100"
        iconColor="text-red-600"
        isLoading={isLoading}
      />
    </div>
  );
}
