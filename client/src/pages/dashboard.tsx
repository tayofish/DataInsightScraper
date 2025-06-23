import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, Activity } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DashboardStats from '@/components/dashboard-stats';
import ProductivityInsights from '@/components/productivity-insights';
import TaskFilters, { TaskFilterValues } from '@/components/task-filters';
import TaskList from '@/components/task-list';
import TaskForm from '@/components/task-form';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export default function Dashboard() {
  const [isTaskFormOpen, setIsTaskFormOpen] = React.useState(false);
  const [filters, setFilters] = React.useState<TaskFilterValues>({
    assigneeId: -2,
    projectId: -2,
    categoryId: -2,
    department: 'all',
    status: 'all',
    priority: 'all',
    search: '',
    sortBy: 'dueDate',
  });

  const handleFilterChange = (newFilters: TaskFilterValues) => {
    setFilters(newFilters);
  };

  return (
    <div className="py-6 h-full overflow-y-auto">
      {/* Page Header */}
      <div className="px-4 sm:px-6 md:px-8 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Dashboard</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Your personalized productivity overview</p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Button
              onClick={() => setIsTaskFormOpen(true)}
              className="inline-flex items-center px-5 py-2.5 text-base font-medium animated-button bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-200"
            >
              <Plus className="mr-2 h-5 w-5" />
              New Task
            </Button>
          </div>
        </div>
      </div>

      {/* Enhanced Dashboard with Tabs */}
      <div className="px-4 sm:px-6 md:px-8">
        <Tabs defaultValue="insights" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="insights" className="flex items-center gap-2">
              <TrendingUp size={16} />
              Productivity Insights
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <Activity size={16} />
              Task Management
            </TabsTrigger>
          </TabsList>

          {/* Productivity Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            <ProductivityInsights />
          </TabsContent>

          {/* Task Management Tab */}
          <TabsContent value="tasks" className="space-y-6">
            {/* Search bar for mobile - hidden on larger screens */}
            <div className="mb-6 md:hidden">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  placeholder="Search for tasks..."
                  className="pl-10 rounded-lg py-6 border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
            </div>

            {/* Task Statistics */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-100/50 dark:border-blue-800/20 shadow-sm">
              <h2 className="text-lg font-semibold mb-5 text-gray-800 dark:text-gray-200">Task Overview</h2>
              <DashboardStats onFilterChange={handleFilterChange} />
            </div>

            {/* Task Filters */}
            <TaskFilters onFilterChange={handleFilterChange} />

            {/* Task List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700">
              <div className="p-5">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Task List</h2>
              </div>
              <TaskList filters={filters} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Task Form Dialog */}
      <TaskForm
        isOpen={isTaskFormOpen}
        onClose={() => setIsTaskFormOpen(false)}
        task={null}
      />
    </div>
  );
}
