import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from '@/components/ui/searchable-select';
import { AvatarField } from '@/components/ui/avatar-field';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { type Project, type Category, type Department } from '@shared/schema';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RotateCcw, Search, Filter, SlidersHorizontal, X, FolderOpen } from 'lucide-react';

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

  const defaultValues = {
    assigneeId: -2, // -2 means "All Users"
    projectId: -2,  // -2 means "All Projects"
    categoryId: -2, // -2 means "All Categories"
    department: 'all',
    status: 'all',
    priority: 'all',
    search: '',
    sortBy: 'dueDate'
  };

  const form = useForm<TaskFilterValues>({
    defaultValues
  });

  // Apply filters whenever form values change
  React.useEffect(() => {
    const subscription = form.watch((value) => {
      onFilterChange(value as TaskFilterValues);
    });
    return () => subscription.unsubscribe();
  }, [form.watch, onFilterChange]);

  // Function to reset all filters
  const resetFilters = React.useCallback(() => {
    form.reset({
      assigneeId: -2, // -2 means "All Users"
      projectId: -2,  // -2 means "All Projects"
      categoryId: -2, // -2 means "All Categories"
      department: 'all',
      status: 'all',
      priority: 'all',
      search: '',
      sortBy: 'dueDate',
      customFilter: undefined
    });
  }, [form]);

  // Helper function to get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    const values = form.getValues();
    
    if (values.assigneeId && values.assigneeId !== -2) count++;
    if (values.projectId && values.projectId !== -2) count++;
    if (values.categoryId && values.categoryId !== -2) count++;
    if (values.department && values.department !== 'all') count++;
    if (values.status && values.status !== 'all') count++;
    if (values.priority && values.priority !== 'all') count++;
    if (values.search && values.search.trim()) count++;
    
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <CardContent className="p-6">
        <Form {...form}>
          {/* Header Section */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">Task Filters</h3>
              </div>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  {activeFilterCount} active
                </Badge>
              )}
            </div>
            <Button 
              onClick={resetFilters} 
              variant="ghost" 
              size="sm"
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              Reset All
            </Button>
          </div>

          {/* Quick Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="search"
                type="search"
                placeholder="Search tasks by title, description, or assignee..."
                className="pl-10 h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400"
                value={form.watch("search")}
                onChange={(e) => form.setValue("search", e.target.value)}
              />
              {form.watch("search") && (
                <button
                  onClick={() => form.setValue("search", "")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Primary Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                Assignee
              </label>
              <AvatarField
                control={form.control}
                name="assigneeId"
                label=""
                placeholder="All Users"
                includeUnassigned={true}
                includeAll={true}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Project
              </label>
              <SearchableSelect
                options={[
                  {
                    value: "-2",
                    label: "All Projects",
                    icon: <FolderOpen className="h-4 w-4 text-blue-500" />
                  },
                  ...projects.map((project) => ({
                    value: project.id.toString(),
                    label: project.name,
                    icon: <FolderOpen className="h-4 w-4 text-slate-500" />
                  }))
                ]}
                value={form.watch("projectId")?.toString() || "-2"}
                placeholder="All Projects"
                searchPlaceholder="Search projects..."
                emptyText="No projects found."
                onValueChange={(value) => {
                  if (value === "-2") {
                    form.setValue("projectId", -2);
                  } else if (value === "-1") {
                    form.setValue("projectId", -1);
                  } else if (value === "") {
                    form.setValue("projectId", -2);
                  } else {
                    form.setValue("projectId", parseInt(value));
                  }
                }}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Status
              </label>
              <Select
                value={form.watch("status")}
                onValueChange={(value) => form.setValue("status", value)}
              >
                <SelectTrigger className="h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="todo">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                      To Do
                    </div>
                  </SelectItem>
                  <SelectItem value="in_progress">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      In Progress
                    </div>
                  </SelectItem>
                  <SelectItem value="completed">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      Completed
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Priority
              </label>
              <Select
                value={form.watch("priority")}
                onValueChange={(value) => form.setValue("priority", value)}
              >
                <SelectTrigger className="h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      High
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      Medium
                    </div>
                  </SelectItem>
                  <SelectItem value="low">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      Low
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Sort By
              </label>
              <Select
                value={form.watch("sortBy")}
                onValueChange={(value) => form.setValue("sortBy", value)}
              >
                <SelectTrigger className="h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
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

          {/* Secondary Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
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
                <SelectTrigger className="h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-2">All Categories</SelectItem>
                  <SelectItem value="-1">Uncategorized</SelectItem>
                  
                  {/* Group categories by department */}
                  {(() => {
                    const departmentMap: Record<string, Category[]> = {};
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
                    
                    return Object.entries(departmentMap).map(([department, deptCategories]) => (
                      <div key={department}>
                        <SelectItem value={`dept_${department}`} disabled className="text-xs font-semibold uppercase text-slate-500 py-2 bg-slate-50 dark:bg-slate-800">
                          {department}
                        </SelectItem>
                        {deptCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()} className="pl-6">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full border border-slate-200 dark:border-slate-600" 
                                style={{ backgroundColor: category.color }}
                              />
                              {category.name}
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Department
              </label>
              <Select
                value={form.watch("department")}
                onValueChange={(value) => form.setValue("department", value)}
              >
                <SelectTrigger className="h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departmentsData.map((department) => (
                    <SelectItem key={department.id} value={department.id.toString()}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
