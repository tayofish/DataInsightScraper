import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ProjectAssignment, User, Project } from "@shared/schema";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Users, 
  UserPlus, 
  FolderKanban, 
  Filter, 
  Plus, 
  MoreVertical,
  X,
  Search
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TeamMember extends ProjectAssignment {
  user?: User;
  project?: Project;
}

export default function TeamsPage() {
  const { toast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  
  const { data: assignments = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ['/api/project-assignments'],
    queryFn: async () => {
      const res = await fetch('/api/project-assignments');
      if (!res.ok) throw new Error('Failed to fetch team members');
      return res.json();
    }
  });
  
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    }
  });
  
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    }
  });
  
  // Extract unique roles
  const uniqueRoles = Array.from(new Set(assignments.map(a => a.role || '').filter(Boolean)));
  
  // Filter assignments based on search term, project, and role
  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = 
      assignment.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.user?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.project?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.role?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProject = projectFilter === "all" || 
      assignment.projectId?.toString() === projectFilter;
    
    const matchesRole = roleFilter === "all" || 
      assignment.role === roleFilter;
    
    return matchesSearch && matchesProject && matchesRole;
  });
  
  // Group assignments by project
  const assignmentsByProject: Record<string, TeamMember[]> = {};
  
  filteredAssignments.forEach(assignment => {
    const projectId = assignment.projectId?.toString() || 'unknown';
    if (!assignmentsByProject[projectId]) {
      assignmentsByProject[projectId] = [];
    }
    assignmentsByProject[projectId].push(assignment);
  });
  
  // Group assignments by user
  const assignmentsByUser: Record<string, TeamMember[]> = {};
  
  filteredAssignments.forEach(assignment => {
    const userId = assignment.userId?.toString() || 'unknown';
    if (!assignmentsByUser[userId]) {
      assignmentsByUser[userId] = [];
    }
    assignmentsByUser[userId].push(assignment);
  });
  
  // Mutation to add a new team member
  const addTeamMemberMutation = useMutation({
    mutationFn: async (data: { userId: number; projectId: number; role: string }) => {
      return apiRequest('POST', '/api/project-assignments', data);
    },
    onSuccess: () => {
      toast({
        title: "Team member added",
        description: "The team member has been successfully added to the project.",
      });
      setIsAddModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/project-assignments'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to add team member: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Mutation to remove a team member
  const removeTeamMemberMutation = useMutation({
    mutationFn: async (assignmentId: number) => {
      return apiRequest('DELETE', `/api/project-assignments/${assignmentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Team member removed",
        description: "The team member has been successfully removed from the project.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/project-assignments'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to remove team member: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  const handleAddTeamMember = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const userId = parseInt(formData.get('userId') as string);
    const projectId = parseInt(formData.get('projectId') as string);
    const role = formData.get('role') as string;
    
    if (!userId || !projectId || !role) {
      toast({
        title: "Error",
        description: "Please fill out all required fields.",
        variant: "destructive",
      });
      return;
    }
    
    addTeamMemberMutation.mutate({ userId, projectId, role });
  };
  
  const handleRemoveTeamMember = (assignmentId: number) => {
    if (confirm('Are you sure you want to remove this team member?')) {
      removeTeamMemberMutation.mutate(assignmentId);
    }
  };
  
  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex flex-col items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-500">Loading team data...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-heading">Teams</h1>
          <p className="text-muted-foreground mt-2">
            Manage project teams and assignments
          </p>
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <UserPlus size={18} />
              <span>Add Team Member</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddTeamMember} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="userId">User</Label>
                <Select name="userId" required>
                  <SelectTrigger id="userId">
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name || user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="projectId">Project</Label>
                <Select name="projectId" required>
                  <SelectTrigger id="projectId">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select name="role" required>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Project Manager">Project Manager</SelectItem>
                    <SelectItem value="Developer">Developer</SelectItem>
                    <SelectItem value="Designer">Designer</SelectItem>
                    <SelectItem value="QA Engineer">QA Engineer</SelectItem>
                    <SelectItem value="Business Analyst">Business Analyst</SelectItem>
                    <SelectItem value="DevOps Engineer">DevOps Engineer</SelectItem>
                    <SelectItem value="Stakeholder">Stakeholder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={addTeamMemberMutation.isPending}
                >
                  {addTeamMemberMutation.isPending ? "Adding..." : "Add Team Member"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Filters */}
      <Card className="mb-8">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative w-full md:w-1/3">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, username, role or project..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="w-full md:w-1/4">
              <Select
                value={projectFilter}
                onValueChange={setProjectFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-full md:w-1/4">
              <Select
                value={roleFilter}
                onValueChange={setRoleFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {uniqueRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {(searchTerm || projectFilter !== "all" || roleFilter !== "all") && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setSearchTerm("");
                  setProjectFilter("all");
                  setRoleFilter("all");
                }}
                className="h-10 w-10"
              >
                <X size={16} />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Team views */}
      <Tabs defaultValue="by-project">
        <TabsList className="mb-6">
          <TabsTrigger value="by-project">
            <FolderKanban className="h-4 w-4 mr-2" />
            By Project
          </TabsTrigger>
          <TabsTrigger value="by-user">
            <Users className="h-4 w-4 mr-2" />
            By User
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="by-project">
          {Object.keys(assignmentsByProject).length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <Users className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No team members found</h3>
              <p className="text-gray-500 mb-4">There are no team members that match your filters, or no assignments have been created yet.</p>
              <Button onClick={() => setIsAddModalOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Team Member
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(assignmentsByProject).map(([projectId, projectAssignments]) => {
                const project = projects.find(p => p.id.toString() === projectId);
                
                return (
                  <Card key={projectId} className="border shadow-sm overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b pb-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg font-bold">
                            {project ? project.name : "Unknown Project"}
                          </CardTitle>
                          <CardDescription>
                            {projectAssignments.length} team member{projectAssignments.length !== 1 ? 's' : ''}
                          </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/projects/${projectId}/team`}>
                            Manage
                          </Link>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ul className="divide-y divide-gray-100">
                        {projectAssignments.map((assignment) => (
                          <li key={assignment.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                            <div className="flex items-center space-x-3">
                              <Avatar>
                                <AvatarImage src={assignment.user?.avatar || undefined} />
                                <AvatarFallback className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                                  {assignment.user?.name?.[0]?.toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{assignment.user?.name || assignment.user?.username}</p>
                                <Badge variant="outline" className="mt-1">
                                  {assignment.role}
                                </Badge>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-red-600 cursor-pointer"
                                  onClick={() => handleRemoveTeamMember(assignment.id)}
                                >
                                  Remove from project
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="by-user">
          {Object.keys(assignmentsByUser).length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <Users className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No team members found</h3>
              <p className="text-gray-500 mb-4">There are no team members that match your filters, or no assignments have been created yet.</p>
              <Button onClick={() => setIsAddModalOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Team Member
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(assignmentsByUser).map(([userId, userAssignments]) => {
                const user = users.find(u => u.id.toString() === userId);
                
                return (
                  <Card key={userId} className="border shadow-sm overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b pb-4">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user?.avatar || undefined} />
                          <AvatarFallback className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                            {user?.name?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg font-bold">
                            {user?.name || user?.username || "Unknown User"}
                          </CardTitle>
                          <CardDescription>
                            {userAssignments.length} project assignment{userAssignments.length !== 1 ? 's' : ''}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ul className="divide-y divide-gray-100">
                        {userAssignments.map((assignment) => {
                          const project = projects.find(p => p.id === assignment.projectId);
                          
                          return (
                            <li key={assignment.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                              <div className="flex items-start flex-col">
                                <Link href={`/projects/${assignment.projectId}`}>
                                  <p className="font-medium text-blue-600 hover:underline">
                                    {project?.name || "Unknown Project"}
                                  </p>
                                </Link>
                                <Badge variant="outline" className="mt-1">
                                  {assignment.role}
                                </Badge>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical size={16} />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-red-600 cursor-pointer"
                                    onClick={() => handleRemoveTeamMember(assignment.id)}
                                  >
                                    Remove from project
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}