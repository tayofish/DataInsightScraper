import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvatarField } from '@/components/ui/avatar-field';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { type Project } from '@shared/schema';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';

interface TaskFiltersProps {
  onFilterChange: (filters: TaskFilterValues) => void;
}

export interface TaskFilterValues {
  assigneeId: number | null;
  projectId: number | null;
  status: string;
  priority: string;
  search: string;
  sortBy: string;
}

export default function TaskFilters({ onFilterChange }: TaskFiltersProps) {
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const form = useForm<TaskFilterValues>({
    defaultValues: {
      assigneeId: -2, // -2 means "All Users"
      projectId: -2,  // -2 means "All Projects"
      status: 'all',
      priority: 'all',
      search: '',
      sortBy: 'dueDate'
    }
  });

  // Apply filters whenever form values change
  React.useEffect(() => {
    const subscription = form.watch((value) => {
      onFilterChange(value as TaskFilterValues);
    });
    return () => subscription.unsubscribe();
  }, [form.watch, onFilterChange]);

  return (
    <Form {...form}>
      <div className="bg-white shadow px-4 py-4 rounded-lg sm:flex sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <AvatarField
            control={form.control}
            name="assigneeId"
            label="Assignee"
            placeholder="All Users"
            includeUnassigned={true}
            includeAll={true}
          />
          
          <div className="w-full sm:w-auto">
            <label htmlFor="project-filter" className="block text-sm font-medium text-gray-700">
              Project
            </label>
            <Select
              value={form.watch("projectId")?.toString() || "-2"}
              onValueChange={(value) => {
                if (value === "-2") {
                  form.setValue("projectId", -2);
                } else if (value === "-1") {
                  form.setValue("projectId", -1);
                } else {
                  form.setValue("projectId", parseInt(value));
                }
              }}
            >
              <SelectTrigger id="project-filter" className="w-[180px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-2">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-full sm:w-auto">
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <Select
              value={form.watch("status")}
              onValueChange={(value) => form.setValue("status", value)}
            >
              <SelectTrigger id="status-filter" className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-full sm:w-auto">
            <label htmlFor="priority-filter" className="block text-sm font-medium text-gray-700">
              Priority
            </label>
            <Select
              value={form.watch("priority")}
              onValueChange={(value) => form.setValue("priority", value)}
            >
              <SelectTrigger id="priority-filter" className="w-[180px]">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">
              Search
            </label>
            <Input
              id="search"
              type="search"
              placeholder="Search tasks..."
              className="w-full sm:w-[200px]"
              value={form.watch("search")}
              onChange={(e) => form.setValue("search", e.target.value)}
            />
          </div>
          
          <div>
            <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700">
              Sort By
            </label>
            <Select
              value={form.watch("sortBy")}
              onValueChange={(value) => form.setValue("sortBy", value)}
            >
              <SelectTrigger id="sort-by" className="w-[180px]">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dueDate">Due Date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="updatedAt">Recently Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </Form>
  );
}
