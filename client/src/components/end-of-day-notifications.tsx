import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Mail, Clock, Users, Send, Eye, Settings, PlayCircle, StopCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface NotificationSettings {
  userNotificationsEnabled: boolean;
  adminNotificationsEnabled: boolean;
}

interface SchedulerConfig {
  enabled: boolean;
  time: string;
  timezone: string;
  status: {
    running: boolean;
    nextRun?: string;
  };
}

interface UserTaskSummary {
  overdueTasks: any[];
  pendingTasks: any[];
  unreadNotifications: number;
  unreadDirectMessages: number;
  unreadChannelMessages: number;
}

interface AdminSummary {
  totalOverdueTasks: number;
  totalPendingTasks: number;
  tasksCompletedToday: any[];
  userSummaries: Array<{
    username: string;
    name: string;
    email: string;
    overdueTasks: number;
    pendingTasks: number;
  }>;
  usersWithCompletedWork: Array<{
    username: string;
    name: string;
    email: string;
    completedTasks: number;
  }>;
}

export default function EndOfDayNotifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewType, setPreviewType] = useState<'user' | 'admin'>('user');

  // Fetch notification settings
  const { data: settings, isLoading: settingsLoading } = useQuery<NotificationSettings>({
    queryKey: ['/api/end-of-day-notifications/settings'],
  });

  // Fetch user summary for preview
  const { data: userSummary, isLoading: userSummaryLoading } = useQuery<UserTaskSummary>({
    queryKey: ['/api/end-of-day-notifications/user-summary'],
    enabled: previewType === 'user',
  });

  // Fetch admin summary for preview
  const { data: adminSummary, isLoading: adminSummaryLoading } = useQuery<AdminSummary>({
    queryKey: ['/api/end-of-day-notifications/admin-summary'],
    enabled: previewType === 'admin',
  });

  // Fetch scheduler configuration
  const { data: schedulerConfig, isLoading: schedulerLoading } = useQuery<SchedulerConfig>({
    queryKey: ['/api/scheduler/config'],
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: NotificationSettings) => {
      const response = await fetch('/api/end-of-day-notifications/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/end-of-day-notifications/settings'] });
      toast({
        title: 'Settings Updated',
        description: 'End-of-day notification settings have been updated successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update notification settings.',
        variant: 'destructive',
      });
    },
  });

  // Send notifications mutation
  const sendNotificationsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/end-of-day-notifications/send', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to send notifications');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Notifications Sent',
        description: 'End-of-day notifications have been sent successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send end-of-day notifications.',
        variant: 'destructive',
      });
    },
  });

  const handleSettingChange = (key: keyof NotificationSettings, value: boolean) => {
    if (!settings) return;
    
    const newSettings = { ...settings, [key]: value };
    updateSettingsMutation.mutate(newSettings);
  };

  const handleSendNotifications = () => {
    sendNotificationsMutation.mutate();
  };

  // Update scheduler configuration mutation
  const updateSchedulerMutation = useMutation({
    mutationFn: async (config: Partial<SchedulerConfig>) => {
      const response = await fetch('/api/scheduler/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error('Failed to update scheduler configuration');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduler/config'] });
      toast({
        title: 'Scheduler Updated',
        description: 'Automatic scheduler configuration has been updated successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update scheduler configuration.',
        variant: 'destructive',
      });
    },
  });

  const handleSchedulerChange = (config: Partial<SchedulerConfig>) => {
    updateSchedulerMutation.mutate(config);
  };

  if (settingsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="mr-2 h-5 w-5" />
            Loading...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="mr-2 h-5 w-5" />
            End-of-Day Email Notifications
          </CardTitle>
          <CardDescription>
            Configure automatic daily email summaries for users and administrators.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Notifications Setting */}
          <div className="flex items-center justify-between space-x-4">
            <div className="space-y-1">
              <Label htmlFor="user-notifications" className="text-base font-medium">
                User Daily Summaries
              </Label>
              <p className="text-sm text-muted-foreground">
                Send daily task summaries to all users including overdue tasks, pending tasks, and unread notifications.
              </p>
            </div>
            <Switch
              id="user-notifications"
              checked={settings?.userNotificationsEnabled || false}
              onCheckedChange={(checked) => handleSettingChange('userNotificationsEnabled', checked)}
              disabled={updateSettingsMutation.isPending}
            />
          </div>

          {/* Admin Notifications Setting */}
          <div className="flex items-center justify-between space-x-4">
            <div className="space-y-1">
              <Label htmlFor="admin-notifications" className="text-base font-medium">
                Admin Daily Summaries
              </Label>
              <p className="text-sm text-muted-foreground">
                Send comprehensive daily summaries to administrators with team overview and productivity metrics.
              </p>
            </div>
            <Switch
              id="admin-notifications"
              checked={settings?.adminNotificationsEnabled || false}
              onCheckedChange={(checked) => handleSettingChange('adminNotificationsEnabled', checked)}
              disabled={updateSettingsMutation.isPending}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
            <Button
              onClick={handleSendNotifications}
              disabled={sendNotificationsMutation.isPending}
              className="flex items-center"
            >
              <Send className="mr-2 h-4 w-4" />
              {sendNotificationsMutation.isPending ? 'Sending...' : 'Send Now'}
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center">
                  <Eye className="mr-2 h-4 w-4" />
                  Preview Email Content
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Email Preview</DialogTitle>
                  <DialogDescription>
                    Preview the content of end-of-day notification emails.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Preview Type Selector */}
                  <div className="flex gap-2">
                    <Button
                      variant={previewType === 'user' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreviewType('user')}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      User Summary
                    </Button>
                    <Button
                      variant={previewType === 'admin' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreviewType('admin')}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      Admin Summary
                    </Button>
                  </div>

                  {/* User Summary Preview */}
                  {previewType === 'user' && (
                    <div className="space-y-4">
                      {userSummaryLoading ? (
                        <div className="flex items-center justify-center p-8">
                          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
                        </div>
                      ) : userSummary ? (
                        <div className="border rounded-lg p-4 bg-muted/50">
                          <h3 className="font-semibold mb-3">Daily Task Summary Preview</h3>
                          
                          {userSummary.overdueTasks.length > 0 && (
                            <div className="mb-4">
                              <Badge variant="destructive" className="mb-2">
                                Overdue Tasks ({userSummary.overdueTasks.length})
                              </Badge>
                              <ul className="text-sm space-y-1 ml-4">
                                {userSummary.overdueTasks.slice(0, 3).map((task, index) => (
                                  <li key={index} className="flex items-center">
                                    • {task.title}
                                    {task.dueDate && (
                                      <span className="ml-2 text-xs text-muted-foreground">
                                        (Due: {new Date(task.dueDate).toLocaleDateString()})
                                      </span>
                                    )}
                                  </li>
                                ))}
                                {userSummary.overdueTasks.length > 3 && (
                                  <li className="text-xs text-muted-foreground">
                                    ... and {userSummary.overdueTasks.length - 3} more
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}

                          {userSummary.pendingTasks.length > 0 && (
                            <div className="mb-4">
                              <Badge variant="secondary" className="mb-2">
                                Pending Tasks ({userSummary.pendingTasks.length})
                              </Badge>
                              <ul className="text-sm space-y-1 ml-4">
                                {userSummary.pendingTasks.slice(0, 3).map((task, index) => (
                                  <li key={index} className="flex items-center">
                                    • {task.title}
                                    {task.dueDate && (
                                      <span className="ml-2 text-xs text-muted-foreground">
                                        (Due: {new Date(task.dueDate).toLocaleDateString()})
                                      </span>
                                    )}
                                  </li>
                                ))}
                                {userSummary.pendingTasks.length > 3 && (
                                  <li className="text-xs text-muted-foreground">
                                    ... and {userSummary.pendingTasks.length - 3} more
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}

                          {(userSummary.unreadNotifications > 0 || 
                            userSummary.unreadDirectMessages > 0 || 
                            userSummary.unreadChannelMessages > 0) && (
                            <div className="mb-4">
                              <Badge variant="outline" className="mb-2">
                                Unread Notifications
                              </Badge>
                              <ul className="text-sm space-y-1 ml-4">
                                {userSummary.unreadNotifications > 0 && (
                                  <li>General notifications: {userSummary.unreadNotifications}</li>
                                )}
                                {userSummary.unreadDirectMessages > 0 && (
                                  <li>Direct messages: {userSummary.unreadDirectMessages}</li>
                                )}
                                {userSummary.unreadChannelMessages > 0 && (
                                  <li>Channel messages: {userSummary.unreadChannelMessages}</li>
                                )}
                              </ul>
                            </div>
                          )}

                          {userSummary.overdueTasks.length === 0 && 
                           userSummary.pendingTasks.length === 0 && 
                           userSummary.unreadNotifications === 0 && 
                           userSummary.unreadDirectMessages === 0 && 
                           userSummary.unreadChannelMessages === 0 && (
                            <div className="text-center py-4">
                              <Badge variant="default" className="mb-2">All Caught Up!</Badge>
                              <p className="text-sm text-muted-foreground">
                                No overdue tasks, pending items, or unread messages.
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">Unable to load user summary preview.</p>
                      )}
                    </div>
                  )}

                  {/* Admin Summary Preview */}
                  {previewType === 'admin' && (
                    <div className="space-y-4">
                      {adminSummaryLoading ? (
                        <div className="flex items-center justify-center p-8">
                          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
                        </div>
                      ) : adminSummary ? (
                        <div className="border rounded-lg p-4 bg-muted/50">
                          <h3 className="font-semibold mb-3">Daily Admin Summary Preview</h3>
                          
                          {/* Overall Statistics */}
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="text-center p-3 border rounded">
                              <div className="text-2xl font-bold text-red-600">
                                {adminSummary.totalOverdueTasks}
                              </div>
                              <div className="text-xs text-muted-foreground">Overdue Tasks</div>
                            </div>
                            <div className="text-center p-3 border rounded">
                              <div className="text-2xl font-bold text-orange-600">
                                {adminSummary.totalPendingTasks}
                              </div>
                              <div className="text-xs text-muted-foreground">Pending Tasks</div>
                            </div>
                            <div className="text-center p-3 border rounded">
                              <div className="text-2xl font-bold text-green-600">
                                {adminSummary.tasksCompletedToday.length}
                              </div>
                              <div className="text-xs text-muted-foreground">Completed Today</div>
                            </div>
                          </div>

                          {/* Completed Tasks Today */}
                          {adminSummary.tasksCompletedToday.length > 0 && (
                            <div className="mb-4">
                              <Badge variant="default" className="mb-2">
                                Tasks Completed Today ({adminSummary.tasksCompletedToday.length})
                              </Badge>
                              <ul className="text-sm space-y-1 ml-4">
                                {adminSummary.tasksCompletedToday.slice(0, 5).map((task, index) => (
                                  <li key={index}>
                                    • {task.title} - {task.assignee?.name || 'Unassigned'}
                                  </li>
                                ))}
                                {adminSummary.tasksCompletedToday.length > 5 && (
                                  <li className="text-xs text-muted-foreground">
                                    ... and {adminSummary.tasksCompletedToday.length - 5} more
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}

                          {/* Users with Pending Work */}
                          {adminSummary.userSummaries.length > 0 && (
                            <div className="mb-4">
                              <Badge variant="secondary" className="mb-2">
                                Users with Pending Work ({adminSummary.userSummaries.length})
                              </Badge>
                              <div className="space-y-2">
                                {adminSummary.userSummaries.slice(0, 5).map((user, index) => (
                                  <div key={index} className="flex justify-between items-center text-sm bg-background p-2 rounded border">
                                    <span>{user.name}</span>
                                    <div className="flex gap-2">
                                      {user.overdueTasks > 0 && (
                                        <Badge variant="destructive" className="text-xs">
                                          {user.overdueTasks} overdue
                                        </Badge>
                                      )}
                                      {user.pendingTasks > 0 && (
                                        <Badge variant="secondary" className="text-xs">
                                          {user.pendingTasks} pending
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {adminSummary.userSummaries.length > 5 && (
                                  <p className="text-xs text-muted-foreground ml-2">
                                    ... and {adminSummary.userSummaries.length - 5} more users
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Users with Completed Work */}
                          {adminSummary.usersWithCompletedWork.length > 0 && (
                            <div className="mb-4">
                              <Badge variant="default" className="mb-2 bg-green-600">
                                Users with Completed Work ({adminSummary.usersWithCompletedWork.length})
                              </Badge>
                              <div className="space-y-2">
                                {adminSummary.usersWithCompletedWork.slice(0, 5).map((user, index) => (
                                  <div key={index} className="flex justify-between items-center text-sm bg-green-50 p-2 rounded border border-green-200">
                                    <span className="font-medium">{user.name}</span>
                                    <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                                      {user.completedTasks} completed
                                    </Badge>
                                  </div>
                                ))}
                                {adminSummary.usersWithCompletedWork.length > 5 && (
                                  <p className="text-xs text-muted-foreground ml-2">
                                    ... and {adminSummary.usersWithCompletedWork.length - 5} more users
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {adminSummary.totalOverdueTasks === 0 && 
                           adminSummary.totalPendingTasks === 0 && 
                           adminSummary.tasksCompletedToday.length === 0 && (
                            <div className="text-center py-4">
                              <Badge variant="default" className="mb-2">All Systems Green!</Badge>
                              <p className="text-sm text-muted-foreground">
                                No overdue or pending tasks to report.
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">Unable to load admin summary preview.</p>
                      )}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Automatic Scheduler Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            Automatic Scheduler
          </CardTitle>
          <CardDescription>
            Configure automatic daily email notifications with custom timing and timezone settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {schedulerLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <>
              {/* Enable/Disable Scheduler */}
              <div className="flex items-center justify-between space-x-4">
                <div className="space-y-1">
                  <Label htmlFor="scheduler-enabled" className="text-base font-medium">
                    Enable Automatic Scheduler
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically send end-of-day notifications at a specified time each day.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {schedulerConfig?.status.running ? (
                    <Badge variant="default" className="flex items-center">
                      <PlayCircle className="mr-1 h-3 w-3" />
                      Running
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="flex items-center">
                      <StopCircle className="mr-1 h-3 w-3" />
                      Stopped
                    </Badge>
                  )}
                  <Switch
                    id="scheduler-enabled"
                    checked={schedulerConfig?.enabled || false}
                    onCheckedChange={(checked) => handleSchedulerChange({ enabled: checked })}
                    disabled={updateSchedulerMutation.isPending}
                  />
                </div>
              </div>

              {/* Time Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduler-time" className="text-base font-medium">
                    Notification Time
                  </Label>
                  <Input
                    id="scheduler-time"
                    type="time"
                    value={schedulerConfig?.time || '18:00'}
                    onChange={(e) => handleSchedulerChange({ time: e.target.value })}
                    disabled={updateSchedulerMutation.isPending}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Time when daily notifications will be sent (24-hour format)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduler-timezone" className="text-base font-medium">
                    Timezone
                  </Label>
                  <Select
                    value={schedulerConfig?.timezone || 'UTC'}
                    onValueChange={(value) => handleSchedulerChange({ timezone: value })}
                    disabled={updateSchedulerMutation.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                      <SelectItem value="Europe/Paris">Paris (CET/CEST)</SelectItem>
                      <SelectItem value="Europe/Berlin">Berlin (CET/CEST)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                      <SelectItem value="Asia/Shanghai">Shanghai (CST)</SelectItem>
                      <SelectItem value="Asia/Mumbai">Mumbai (IST)</SelectItem>
                      <SelectItem value="Australia/Sydney">Sydney (AEST/AEDT)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Timezone for scheduled notifications
                  </p>
                </div>
              </div>

              {/* Scheduler Status and Information */}
              {schedulerConfig?.enabled && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Scheduler Status</span>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      <strong>Next notification:</strong> Daily at {schedulerConfig.time} ({schedulerConfig.timezone})
                    </p>
                    <p>
                      <strong>Status:</strong> {schedulerConfig.status.running ? 'Active and running' : 'Inactive'}
                    </p>
                    {schedulerConfig.status.nextRun && (
                      <p>
                        <strong>Next run:</strong> {schedulerConfig.status.nextRun}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}