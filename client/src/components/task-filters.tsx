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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RotateCcw, Search, Filter, SlidersHorizontal, X, FolderOpen, Building2, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [isOpen, setIsOpen] = React.useState(false);
  
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
  }, [form, onFilterChange]);

  const resetFilters = () => {
    form.reset(defaultValues);
  };

  const getActiveFilterCount = () => {
    const values = form.getValues();
    let count = 0;
    
    if (values.assigneeId !== -2) count++;
    if (values.projectId !== -2) count++;
    if (values.categoryId !== -2) count++;
    if (values.department !== 'all') count++;
    if (values.status !== 'all') count++;
    if (values.priority !== 'all') count++;
    if (values.search && values.search.trim() !== '') count++;
    
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        <CardContent className="p-6">
          <Form {...form}>
            {/* Header Section */}
            <div className="flex items-center justify-between mb-6">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="p-0 h-auto font-normal justify-start flex-1">
                  <div className="flex items-center gap-3 w-full">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                      <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">Task Filters</h3>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      )}
                    </div>
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {activeFilterCount} active
                      </Badge>
                    )}
                  </div>
                </Button>
              </CollapsibleTrigger>
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

            <CollapsibleContent className="space-y-6">
              {/* Quick Search */}
              <div>
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

              {/* First Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <SearchableSelect
                    options={[
                      {
                        value: "all",
                        label: "All Statuses",
                        icon: <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                      },
                      {
                        value: "pending",
                        label: "Pending",
                        icon: <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      },
                      {
                        value: "in_progress",
                        label: "In Progress",
                        icon: <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      },
                      {
                        value: "completed",
                        label: "Completed",
                        icon: <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      },
                      {
                        value: "overdue",
                        label: "Overdue",
                        icon: <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      }
                    ]}
                    value={form.watch("status")}
                    placeholder="All Statuses"
                    searchPlaceholder="Search statuses..."
                    emptyText="No status found."
                    onValueChange={(value) => form.setValue("status", value || "all")}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Priority
                  </label>
                  <SearchableSelect
                    options={[
                      {
                        value: "all",
                        label: "All Priorities",
                        icon: <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                      },
                      {
                        value: "low",
                        label: "Low",
                        icon: <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      },
                      {
                        value: "medium",
                        label: "Medium",
                        icon: <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      },
                      {
                        value: "high",
                        label: "High",
                        icon: <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      }
                    ]}
                    value={form.watch("priority")}
                    placeholder="All Priorities"
                    searchPlaceholder="Search priorities..."
                    emptyText="No priority found."
                    onValueChange={(value) => form.setValue("priority", value || "all")}
                  />
                </div>
              </div>

              {/* Second Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Department
                  </label>
                  <SearchableSelect
                    options={[
                      {
                        value: "-2",
                        label: "All Departments",
                        icon: <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                      },
                      {
                        value: "-1",
                        label: "Uncategorized",
                        icon: <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                      },
                      ...categories.map((category) => ({
                        value: category.id.toString(),
                        label: category.name,
                        icon: (
                          <div 
                            className="w-3 h-3 rounded-full border border-slate-200 dark:border-slate-600" 
                            style={{ backgroundColor: category.color }}
                          />
                        )
                      }))
                    ]}
                    value={form.watch("categoryId")?.toString() || "-2"}
                    placeholder="All Departments"
                    searchPlaceholder="Search departments..."
                    emptyText="No departments found."
                    onValueChange={(value) => {
                      if (value === "-2") {
                        form.setValue("categoryId", -2);
                      } else if (value === "-1") {
                        form.setValue("categoryId", -1);
                      } else if (value === "") {
                        form.setValue("categoryId", -2);
                      } else {
                        form.setValue("categoryId", parseInt(value));
                      }
                    }}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Unit
                  </label>
                  <SearchableSelect
                    options={[
                      {
                        value: "all",
                        label: "All Units",
                        icon: <Building2 className="h-4 w-4 text-slate-500" />
                      },
                      ...departmentsData.map((department) => ({
                        value: department.id.toString(),
                        label: department.name,
                        icon: <Building2 className="h-4 w-4 text-slate-500" />
                      }))
                    ]}
                    value={form.watch("department")}
                    placeholder="All Units"
                    searchPlaceholder="Search units..."
                    emptyText="No units found."
                    onValueChange={(value) => form.setValue("department", value || "all")}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Sort By
                  </label>
                  <SearchableSelect
                    options={[
                      {
                        value: "dueDate",
                        label: "Due Date",
                        icon: <div className="w-4 h-4 text-slate-500">📅</div>
                      },
                      {
                        value: "priority",
                        label: "Priority",
                        icon: <div className="w-4 h-4 text-slate-500">⭐</div>
                      },
                      {
                        value: "updatedAt",
                        label: "Recently Updated",
                        icon: <div className="w-4 h-4 text-slate-500">🕒</div>
                      }
                    ]}
                    value={form.watch("sortBy")}
                    placeholder="Sort by..."
                    searchPlaceholder="Search sort options..."
                    emptyText="No sort option found."
                    onValueChange={(value) => form.setValue("sortBy", value || "dueDate")}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Form>
        </CardContent>
      </Card>
    </Collapsible>
  );
}