import React from "react";
import { Bell, Check, Trash2, X, CheckCircle } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useLocation } from "wouter";

export function NotificationDropdown() {
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
    const baseClass = "mr-2 h-4 w-4";
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
      return format(new Date(date), "MMM d, h:mm a");
    } catch (error) {
      return "Invalid date";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px]">
        <DropdownMenuLabel className="flex justify-between items-center">
          <span>Notifications</span>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => markAllAsRead()}
              title="Mark all as read"
              className="h-7 w-7"
              disabled={unreadCount === 0}
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => clearAllNotifications()}
              title="Clear all notifications"
              className="h-7 w-7"
              disabled={notifications.length === 0}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="px-2 py-1.5">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setLocation("/notifications")}
          >
            View All Notifications
          </Button>
        </div>
        <DropdownMenuSeparator />
        
        {isLoading ? (
          <div className="p-4 text-center">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">No notifications</div>
        ) : (
          <ScrollArea className="h-[400px]">
            {notifications.map((notification) => (
              <div key={notification.id} className={cn(
                "flex flex-col p-3 border-b last:border-b-0 cursor-pointer",
                !notification.isRead && "bg-muted/50"
              )}>
                <div className="flex justify-between items-start">
                  <div 
                    className="flex-1"
                    onClick={() => handleNavigate(notification)}
                  >
                    <div className="flex items-center">
                      {getNotificationIcon(notification.type, notification.isRead)}
                      <div className="font-medium truncate pr-2">
                        {notification.title}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground pl-6 mt-1">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>
                  <div className="flex ml-2 space-x-1">
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        title="Mark as read"
                        className="h-6 w-6"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      title="Delete notification"
                      className="h-6 w-6"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}