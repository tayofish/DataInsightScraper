import React, { useState } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Bell, Filter, Trash2, ExternalLink, Check, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  } = useNotifications();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tab, setTab] = useState("all");

  // Filter notifications based on search, type, and tab
  const filteredNotifications = notifications.filter((notification) => {
    // Filter by search text
    const matchesSearch =
      search === "" ||
      notification.title.toLowerCase().includes(search.toLowerCase()) ||
      notification.message.toLowerCase().includes(search.toLowerCase());

    // Filter by notification type
    const matchesType =
      typeFilter === "all" || notification.type === typeFilter;

    // Filter by tab (All, Unread, Read)
    const matchesTab =
      tab === "all" ||
      (tab === "unread" && !notification.isRead) ||
      (tab === "read" && notification.isRead);

    return matchesSearch && matchesType && matchesTab;
  });

  // Helper function to handle navigation to referenced items
  const handleNavigate = (notification: any) => {
    // Mark the notification as read
    markAsRead(notification.id);

    // Navigate based on reference type
    if (notification.referenceType === "task" && notification.referenceId) {
      setLocation(`/tasks?id=${notification.referenceId}`);
    } else if (notification.referenceType === "project" && notification.referenceId) {
      setLocation(`/projects/${notification.referenceId}`);
    }
  };

  // Function to get icon based on notification type
  const getNotificationIcon = (type: string, isRead: boolean | null) => {
    const baseClass = "mr-3 h-5 w-5";
    const className = isRead === true ? baseClass : cn(baseClass, "text-blue-500");

    // Return different icons based on notification type
    switch (type) {
      case "task_assignment":
        return <Bell className={className} />;
      case "task_comment":
        return <Bell className={className} />;
      case "project_task_created":
        return <Bell className={className} />;
      case "task_mention":
        return <Bell className={className} />;
      case "project_assignment":
        return <Bell className={className} />;
      case "task_collaboration":
        return <Bell className={className} />;
      default:
        return <Bell className={className} />;
    }
  };

  // Format the date in a readable way
  const formatDate = (date: string) => {
    try {
      return format(new Date(date), "MMM d, yyyy h:mm a");
    } catch (error) {
      return "Invalid date";
    }
  };

  // Get human-readable notification type
  const getNotificationType = (type: string) => {
    switch (type) {
      case "task_assignment":
        return "Task Assignment";
      case "task_comment":
        return "Task Comment";
      case "project_task_created":
        return "New Task in Project";
      case "task_mention":
        return "Mention in Task";
      case "project_assignment":
        return "Project Assignment";
      case "task_collaboration":
        return "Task Collaboration";
      default:
        return type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    }
  };

  // Get unique notification types for the filter
  const notificationTypes = [
    ...new Set(notifications.map((notification) => notification.type)),
  ];

  return (
    <div className="container py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => markAllAsRead()}
            disabled={unreadCount === 0}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Mark All as Read
          </Button>
          <Button
            variant="outline"
            onClick={() => clearAllNotifications()}
            disabled={notifications.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear All
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="w-full md:w-64">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <div className="flex items-center">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by type" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {notificationTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {getNotificationType(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="all" value={tab} onValueChange={setTab} className="mb-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">
            All
            <Badge variant="outline" className="ml-2">
              {notifications.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            <Badge variant="outline" className="ml-2">
              {unreadCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="read">
            Read
            <Badge variant="outline" className="ml-2">
              {notifications.length - unreadCount}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="text-center py-8">Loading notifications...</div>
      ) : filteredNotifications.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Bell className="mx-auto h-12 w-12 mb-4 opacity-20" />
          <h3 className="text-lg font-medium mb-2">No notifications found</h3>
          <p>
            {search || typeFilter !== "all" || tab !== "all"
              ? "Try changing your filters or search query"
              : "You don't have any notifications yet"}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredNotifications.map((notification) => (
            <Card
              key={notification.id}
              className={cn(
                "p-4 transition-colors",
                !notification.isRead && "bg-muted/50 border-blue-200"
              )}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-1">
                  {getNotificationIcon(notification.type, notification.isRead)}
                </div>
                <div 
                  className="flex-1 cursor-pointer" 
                  onClick={() => handleNavigate(notification)}
                >
                  <div className="flex items-center mb-1">
                    <h3 className="font-medium text-lg">
                      {notification.title}
                    </h3>
                    {!notification.isRead && (
                      <Badge className="ml-2 bg-blue-500 text-white">New</Badge>
                    )}
                  </div>
                  <p className="text-sm mb-2">{notification.message}</p>
                  <div className="flex items-center text-xs text-muted-foreground space-x-3">
                    <span>{formatDate(notification.createdAt)}</span>
                    <Separator orientation="vertical" className="h-3" />
                    <span>{getNotificationType(notification.type)}</span>
                    {notification.referenceType && notification.referenceId && (
                      <>
                        <Separator orientation="vertical" className="h-3" />
                        <div className="flex items-center">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          <span className="capitalize">{notification.referenceType} #{notification.referenceId}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  {!notification.isRead && (
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => markAsRead(notification.id)}
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => deleteNotification(notification.id)}
                    title="Delete notification"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}