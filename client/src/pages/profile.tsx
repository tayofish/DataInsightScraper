import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Building2, Mail, Users } from "lucide-react";

interface UserProfile {
  id: number;
  username: string;
  name: string;
  email?: string;
  departmentId?: number;
  department?: {
    id: number;
    name: string;
    description?: string;
  };
}

interface UserDepartment {
  id: number;
  userId: number;
  departmentId: number;
  department: {
    id: number;
    name: string;
    description?: string;
  };
}

export default function ProfilePage() {
  // Get current user profile
  const { data: user, isLoading: userLoading } = useQuery<UserProfile>({
    queryKey: ['/api/user']
  });

  // Get user's department assignments (units)
  const { data: userDepartments, isLoading: departmentsLoading } = useQuery<UserDepartment[]>({
    queryKey: ['/api/user-departments'],
    enabled: !!user?.id
  });

  // Get user's primary department
  const { data: primaryDepartment } = useQuery({
    queryKey: ['/api/categories', user?.departmentId],
    enabled: !!user?.departmentId,
    select: (data: any) => data || null
  });

  if (userLoading || departmentsLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Profile</h1>
            <p className="text-muted-foreground">Your account information and assignments</p>
          </div>
        </div>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Basic Information
            </CardTitle>
            <CardDescription>
              Your personal account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <p className="text-base font-medium">{user?.name || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Username</label>
                <p className="text-base font-medium">@{user?.username}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </label>
              <p className="text-base font-medium">
                {user?.email || 'No email specified'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Department Assignment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Department Assignment
            </CardTitle>
            <CardDescription>
              Your primary department for task categorization
            </CardDescription>
          </CardHeader>
          <CardContent>
            {primaryDepartment ? (
              <div className="space-y-2">
                <Badge variant="secondary" className="text-sm">
                  {primaryDepartment.name}
                </Badge>
                {primaryDepartment.description && (
                  <p className="text-sm text-muted-foreground">
                    {primaryDepartment.description}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No department assigned</p>
            )}
          </CardContent>
        </Card>

        {/* Unit Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Unit Assignments
            </CardTitle>
            <CardDescription>
              The units you are assigned to work with
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userDepartments && userDepartments.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {userDepartments.map((userDept) => (
                    <Badge key={userDept.id} variant="outline">
                      {userDept.department.name}
                    </Badge>
                  ))}
                </div>
                <div className="space-y-2 pt-2">
                  {userDepartments.map((userDept) => (
                    <div key={userDept.id} className="border-l-2 border-muted pl-3">
                      <h4 className="font-medium text-sm">{userDept.department.name}</h4>
                      {userDept.department.description && (
                        <p className="text-xs text-muted-foreground">
                          {userDept.department.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No units assigned</p>
            )}
          </CardContent>
        </Card>

        {/* Account Status */}
        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
            <CardDescription>
              Current status of your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Badge variant="secondary">Active</Badge>
              {user?.departmentId && <Badge variant="outline">Department Assigned</Badge>}
              {userDepartments && userDepartments.length > 0 && (
                <Badge variant="outline">{userDepartments.length} Unit{userDepartments.length !== 1 ? 's' : ''}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}