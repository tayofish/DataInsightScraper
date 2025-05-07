import React from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Link } from 'wouter';

import type { Project, ProjectAssignment, User } from '@shared/schema';

// Form schema for assigning team members
const assignmentFormSchema = z.object({
  userId: z.number({
    required_error: "Please select a team member",
  }),
  role: z.string().min(1, "Role is required"),
});

type AssignmentFormValues = z.infer<typeof assignmentFormSchema>;

export default function ProjectTeam() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id);
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = React.useState(false);

  // Fetch project details
  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ['/api/projects', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch project');
      return res.json();
    },
    enabled: !isNaN(projectId),
  });

  // Fetch project team members
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<(ProjectAssignment & { user?: User })[]>({
    queryKey: ['/api/projects', projectId, 'assignments'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/assignments`);
      if (!res.ok) throw new Error('Failed to fetch team members');
      return res.json();
    },
    enabled: !isNaN(projectId),
  });

  // Fetch all users to select from
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Form setup
  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues: {
      userId: undefined,
      role: '',
    },
  });

  // Create team assignment mutation
  const assignmentMutation = useMutation({
    mutationFn: async (values: AssignmentFormValues) => {
      return apiRequest('POST', `/api/project-assignments`, {
        ...values,
        projectId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'assignments'] });
      toast({
        title: 'Team member added',
        description: 'Team member has been added to the project.',
      });
      handleCloseForm();
    },
    onError: (err) => {
      toast({
        title: 'Error',
        description: `Failed to add team member: ${err}`,
        variant: 'destructive',
      });
    }
  });

  // Delete team assignment mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      return apiRequest('DELETE', `/api/project-assignments/${assignmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'assignments'] });
      toast({
        title: 'Team member removed',
        description: 'Team member has been removed from the project.',
      });
    },
    onError: (err) => {
      toast({
        title: 'Error',
        description: `Failed to remove team member: ${err}`,
        variant: 'destructive',
      });
    }
  });

  // Open form for assigning a team member
  const handleOpenForm = () => {
    form.reset({
      userId: undefined,
      role: '',
    });
    setIsFormOpen(true);
  };

  // Close the form
  const handleCloseForm = () => {
    setIsFormOpen(false);
  };

  // Handle form submission
  const onSubmit = (values: AssignmentFormValues) => {
    assignmentMutation.mutate(values);
  };

  // Calculate filtered users (not already assigned to this project)
  const filteredUsers = React.useMemo(() => {
    if (!users || !assignments) return [];
    const assignedUserIds = assignments.map(a => a.userId);
    return users.filter(user => !assignedUserIds.includes(user.id));
  }, [users, assignments]);

  // Loading state
  const isLoading = projectLoading || assignmentsLoading || usersLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Not Found</CardTitle>
          <CardDescription>
            The project you're looking for doesn't exist or you don't have access to it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/projects">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <div className="flex items-center space-x-2">
              <Link href={`/projects/${projectId}`}>
                <Button variant="outline" size="sm" className="mb-2">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Project
                </Button>
              </Link>
            </div>
            <CardTitle className="text-2xl">{project.name} Team</CardTitle>
            <CardDescription>
              Manage team members assigned to this project
            </CardDescription>
          </div>
          <Button onClick={handleOpenForm} className="ml-auto">
            <Plus className="mr-2 h-4 w-4" /> Add Team Member
          </Button>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-center text-gray-500 mb-4">No team members have been assigned to this project yet.</p>
              <Button onClick={handleOpenForm}>
                <Plus className="mr-2 h-4 w-4" /> Assign Your First Team Member
              </Button>
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">User</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assigned Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <Avatar>
                          <AvatarImage src={assignment.user?.avatar || ''} />
                          <AvatarFallback>
                            {assignment.user?.username?.substring(0, 2).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{assignment.user?.username || 'Unknown User'}</TableCell>
                      <TableCell>{assignment.role}</TableCell>
                      <TableCell>{new Date(assignment.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove this team member from the project. They will no longer have access to project resources.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteAssignmentMutation.mutate(assignment.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Team Member Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Assign a team member to the project and define their role.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team Member</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value?.toString()}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a team member" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredUsers.length === 0 ? (
                            <SelectItem value="none" disabled>
                              No available users
                            </SelectItem>
                          ) : (
                            filteredUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                {user.username}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Project Manager">Project Manager</SelectItem>
                          <SelectItem value="Developer">Developer</SelectItem>
                          <SelectItem value="Designer">Designer</SelectItem>
                          <SelectItem value="QA Tester">QA Tester</SelectItem>
                          <SelectItem value="Business Analyst">Business Analyst</SelectItem>
                          <SelectItem value="Stakeholder">Stakeholder</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>
                      The role this person will fulfill in the project
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseForm}
                  disabled={assignmentMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={assignmentMutation.isPending || filteredUsers.length === 0}
                >
                  {assignmentMutation.isPending
                    ? 'Adding...'
                    : 'Add Team Member'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}