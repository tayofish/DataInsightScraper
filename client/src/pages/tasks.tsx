import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import TaskFilters, { TaskFilterValues } from '@/components/task-filters';
import TaskList from '@/components/task-list';
import TaskForm from '@/components/task-form';

export default function Tasks() {
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
          <div>
            <h1 className="text-2xl font-bold gradient-heading">Tasks</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage and organize your tasks</p>
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

      {/* Task Filters */}
      <div className="px-4 sm:px-6 md:px-8 mb-6">
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <TaskFilters onFilterChange={handleFilterChange} />
        </div>
      </div>

      {/* Task List */}
      <div className="px-4 sm:px-6 md:px-8 pb-6">
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-md max-h-[calc(100vh-320px)] overflow-y-auto">
          <TaskList filters={filters} />
        </div>
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
