import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvatarField } from '@/components/ui/avatar-field';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { type Project, type Category, type Department } from '@shared/schema';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';

interface TaskFiltersProps {
  onFilterChange: (filters: TaskFilterValues) => void;
}

export interface TaskFilterValues {
  assigneeId: number | null;
  projectId: number | null;
  categoryId: number | null;
  department: string;
  status: string;
  priority: string;
  search: string;
  sortBy: string;
  customFilter?: string; // For special filters like 'overdue'
}

export default function TaskFilters({ onFilterChange }: TaskFiltersProps) {
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });
  
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });
  
  const { data: departmentsData = [] } = useQuery<Department[]>({
    queryKey: ['/api/departments'],
  });

  const form = useForm<TaskFilterValues>({
    defaultValues: {
      assigneeId: -2, // -2 means "All Users"
      projectId: -2,  // -2 means "All Projects"
      categoryId: -2, // -2 means "All Categories"
      department: 'all',
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
      <div className="bg-white shadow px-4 py-4 rounded-lg">
        {/* Row 1: Primary filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
          <AvatarField
            control={form.control}
            name="assigneeId"
            label="Assignee"
            placeholder="All Users"
            includeUnassigned={true}
            includeAll={true}
          />
          
          <div>
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
              <SelectTrigger id="project-filter" className="w-full">
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
          
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <Select
              value={form.watch("status")}
              onValueChange={(value) => form.setValue("status", value)}
            >
              <SelectTrigger id="status-filter" className="w-full">
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
          
          <div>
            <label htmlFor="priority-filter" className="block text-sm font-medium text-gray-700">
              Priority
            </label>
            <Select
              value={form.watch("priority")}
              onValueChange={(value) => form.setValue("priority", value)}
            >
              <SelectTrigger id="priority-filter" className="w-full">
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
          
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">
              Search
            </label>
            <Input
              id="search"
              type="search"
              placeholder="Search tasks..."
              className="w-full"
              value={form.watch("search")}
              onChange={(e) => form.setValue("search", e.target.value)}
            />
          </div>
        </div>
        
        {/* Row 2: Secondary filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <Select
              value={form.watch("categoryId")?.toString() || "-2"}
              onValueChange={(value) => {
                if (value === "-2") {
                  form.setValue("categoryId", -2);
                } else if (value === "-1") {
                  form.setValue("categoryId", -1);
                } else {
                  form.setValue("categoryId", parseInt(value));
                }
              }}
            >
              <SelectTrigger id="category-filter" className="w-full">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-2">All Categories</SelectItem>
                <SelectItem value="-1">Uncategorized</SelectItem>
                
                {/* Group categories by department */}
                {(() => {
                  // Create a map of departments to categories
                  const departmentMap: Record<string, Category[]> = {};
                  
                  // Create a mapping of department IDs to names
                  const departmentsById: Record<number, string> = {};
                  
                  departmentsData.forEach(dept => {
                    departmentsById[dept.id] = dept.name;
                  });
                  
                  categories.forEach(category => {
                    const deptName = category.departmentId ? (departmentsById[category.departmentId] || 'Unknown') : 'General';
                    if (!departmentMap[deptName]) {
                      departmentMap[deptName] = [];
                    }
                    departmentMap[deptName].push(category);
                  });
                  
                  // Return the grouped categories
                  return Object.entries(departmentMap).map(([department, deptCategories]) => (
                    <React.Fragment key={department}>
                      <SelectItem value={`dept_${department}`} disabled className="text-xs font-bold uppercase text-gray-500 py-1">
                        {department}
                      </SelectItem>
                      {deptCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()} className="pl-6">
                          <div className="flex items-center">
                            <div 
                              className="w-3 h-3 rounded-full mr-2" 
                              style={{ backgroundColor: category.color }}
                            />
                            {category.name}
                          </div>
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ));
                })()}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label htmlFor="department-filter" className="block text-sm font-medium text-gray-700">
              Department
            </label>
            <Select
              value={form.watch("department")}
              onValueChange={(value) => form.setValue("department", value)}
            >
              <SelectTrigger id="department-filter" className="w-full">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {/* List all departments */}
                {departmentsData.map((department) => (
                  <SelectItem key={department.id} value={department.id.toString()}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700">
              Sort By
            </label>
            <Select
              value={form.watch("sortBy")}
              onValueChange={(value) => form.setValue("sortBy", value)}
            >
              <SelectTrigger id="sort-by" className="w-full">
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
