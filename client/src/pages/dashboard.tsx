import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import DashboardStats from '@/components/dashboard-stats';
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
    <div className="py-6">
      {/* Page Header */}
      <div className="px-4 sm:px-6 md:px-8 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Overview of your tasks and projects</p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Button
              onClick={() => setIsTaskFormOpen(true)}
              className="inline-flex items-center"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </div>
        </div>
      </div>

      {/* Search bar for mobile - hidden on larger screens */}
      <div className="px-4 sm:px-6 md:px-8 mb-6 md:hidden">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <Input
            placeholder="Search for tasks..."
            className="pl-10"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
      </div>

      {/* Task Statistics */}
      <div className="px-4 sm:px-6 md:px-8 mb-8">
        <DashboardStats />
      </div>

      {/* Task Filters */}
      <div className="px-4 sm:px-6 md:px-8 mb-6">
        <TaskFilters onFilterChange={handleFilterChange} />
      </div>

      {/* Task List */}
      <div className="px-4 sm:px-6 md:px-8">
        <TaskList filters={filters} />
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
