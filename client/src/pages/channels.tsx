import { FC, useState, useEffect, useRef, KeyboardEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { 
  Shield, 
  ChevronRight, 
  Plus, 
  Users, 
  MessagesSquare, 
  Settings, 
  Search,
  UserPlus,
  Trash,
  Edit,
  X,
  Crown,
  ShieldCheck,
  User,
  AtSign
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

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
} from "@/components/ui/alert-dialog";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

// Schema for channel creation
const channelFormSchema = z.object({
  name: z.string().min(2, "Channel name must be at least 2 characters"),
  description: z.string().optional(),
  type: z.enum(["public", "private"]).default("public"),
});

type ChannelFormValues = z.infer<typeof channelFormSchema>;

// WebSocket connection for real-time messaging
let socket: WebSocket | null = null;

const ChannelsPage: FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [membersSheetOpen, setMembersSheetOpen] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [newMemberId, setNewMemberId] = useState<number | null>(null);
  const [memberRole, setMemberRole] = useState("member");
  const [confirmRemoveMemberId, setConfirmRemoveMemberId] = useState<number | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  
  // Mention functionality
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionDropdownOpen, setMentionDropdownOpen] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const messageInputRef = useRef<HTMLInputElement>(null);
  
  // Fetch all available channels
  const {
    data: channels = [],
    isLoading: isLoadingChannels,
    error: channelsError,
  } = useQuery<any[]>({
    queryKey: [`/api/channels`],
    enabled: !!user,
  });

  // Fetch detailed info for the selected channel
  const {
    data: channelDetails,
    isLoading: isLoadingChannelDetails,
    error: channelDetailsError,
  } = useQuery<any>({
    queryKey: [`/api/channels/${selectedChannelId}`],
    enabled: !!selectedChannelId && !!user
  });
  
  // Fetch messages for the selected channel
  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    error: messagesError,
  } = useQuery<any[]>({
    queryKey: [`/api/channels/${selectedChannelId}/messages`],
    enabled: !!selectedChannelId && !!user
  });
  
  // Fetch all users for member management
  const {
    data: allUsers = [],
    isLoading: isLoadingUsers,
  } = useQuery<any[]>({
    queryKey: ['/api/users'],
    enabled: !!user
  });

  // Create a new channel
  const createChannelMutation = useMutation({
    mutationFn: async (data: ChannelFormValues) => {
      const response = await fetch("/api/channels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to create channel");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/channels`] });
      setCreateDialogOpen(false);
      toast({
        title: "Channel created",
        description: "Your channel has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create channel",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send a message to the channel
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { content: string; channelId: number }) => {
      const response = await fetch(`/api/channels/${messageData.channelId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: messageData.content }),
      });
      if (!response.ok) {
        throw new Error("Failed to send message");
      }
      return response.json();
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannelId}/messages`] });
    },
    onError: (error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Add a member to the channel
  const addMemberMutation = useMutation({
    mutationFn: async (data: { userId: number; role: string }) => {
      const response = await fetch(`/api/channels/${selectedChannelId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to add member");
      }
      return response.json();
    },
    onSuccess: () => {
      setNewMemberId(null);
      setAddMemberDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannelId}`] });
      toast({
        title: "Member added",
        description: "User has been added to the channel",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to add member",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Remove a member from the channel
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/channels/${selectedChannelId}/members/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to remove member");
      }
      return response.json();
    },
    onSuccess: () => {
      setConfirmRemoveMemberId(null);
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannelId}`] });
      toast({
        title: "Member removed",
        description: "User has been removed from the channel",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove member",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update a member's role
  const updateMemberRoleMutation = useMutation({
    mutationFn: async (data: { userId: number; role: string }) => {
      const response = await fetch(`/api/channels/${selectedChannelId}/members/${data.userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: data.role }),
      });
      if (!response.ok) {
        throw new Error("Failed to update member role");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannelId}`] });
      toast({
        title: "Role updated",
        description: "Member's role has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update role",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update channel settings
  const updateChannelMutation = useMutation({
    mutationFn: async (data: { name?: string; description?: string; type?: string }) => {
      const response = await fetch(`/api/channels/${selectedChannelId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to update channel");
      }
      return response.json();
    },
    onSuccess: () => {
      setSettingsSheetOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannelId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/channels`] });
      toast({
        title: "Channel updated",
        description: "Channel settings have been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update channel",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Delete a channel
  const deleteChannelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/channels/${selectedChannelId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete channel");
      }
      return response.json();
    },
    onSuccess: () => {
      setConfirmDeleteOpen(false);
      setSettingsSheetOpen(false);
      setSelectedChannelId(null);
      queryClient.invalidateQueries({ queryKey: [`/api/channels`] });
      toast({
        title: "Channel deleted",
        description: "Channel has been deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete channel",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form for creating a new channel
  const createForm = useForm<ChannelFormValues>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "public",
    },
  });

  // Form for editing a channel
  const editForm = useForm<ChannelFormValues>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      name: channelDetails?.name || "",
      description: channelDetails?.description || "",
      type: channelDetails?.type || "public",
    },
  });
  
  // Update form values when channel details change
  useEffect(() => {
    if (channelDetails) {
      editForm.reset({
        name: channelDetails.name || "",
        description: channelDetails.description || "",
        type: channelDetails.type || "public",
      });
    }
  }, [channelDetails, editForm]);

  // Submit handler for channel creation form
  const onCreateSubmit = (values: ChannelFormValues) => {
    createChannelMutation.mutate(values);
  };
  
  // Submit handler for channel edit form
  const onEditSubmit = (values: ChannelFormValues) => {
    updateChannelMutation.mutate(values);
  };

  // Handle input change and detect mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessage(value);
    
    // Check for @ mentions
    const cursorPos = e.target.selectionStart || 0;
    setCursorPosition(cursorPos);
    
    // Find the last @ symbol before cursor
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtPos !== -1 && (lastAtPos === 0 || /\s/.test(value[lastAtPos - 1]))) {
      // Extract the partial username after @
      const afterAt = textBeforeCursor.substring(lastAtPos + 1);
      
      // If there's no space after the @username part being typed
      if (!afterAt.includes(' ')) {
        setMentionQuery(afterAt);
        setMentionStartIndex(lastAtPos);
        
        // Calculate position for mention dropdown
        if (messageInputRef.current) {
          const inputRect = messageInputRef.current.getBoundingClientRect();
          // Rough calculation - can be refined
          const charWidth = 8; // Approximate width of a character
          
          setMentionPosition({
            top: inputRect.height + 5,
            left: Math.min((lastAtPos * charWidth), inputRect.width - 200)
          });
        }
        
        setMentionDropdownOpen(true);
        return;
      }
    }
    
    // If we get here, we're not in a mention context
    setMentionDropdownOpen(false);
  };
  
  // Insert a mention at cursor position
  const insertMention = (username: string) => {
    if (mentionStartIndex === -1) return;
    
    const beforeMention = message.substring(0, mentionStartIndex);
    const afterMention = message.substring(cursorPosition);
    
    const newMessage = `${beforeMention}@${username} ${afterMention}`;
    setMessage(newMessage);
    setMentionDropdownOpen(false);
    
    // Focus back on input
    if (messageInputRef.current) {
      messageInputRef.current.focus();
      // Set cursor position after the inserted mention
      const newCursorPos = mentionStartIndex + username.length + 2; // +2 for @ and space
      setTimeout(() => {
        if (messageInputRef.current) {
          messageInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  // Handle message submission
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !selectedChannelId) return;

    sendMessageMutation.mutate({
      content: message,
      channelId: selectedChannelId,
    });
  };

  // Scroll to bottom of messages when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("WebSocket connection established");
      // Authenticate the WebSocket connection
      if (socket && user) {
        socket.send(JSON.stringify({
          type: "auth",
          userId: user.id,
          username: user.username,
        }));
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WebSocket message received:", data);

        // Handle different message types
        if (data.type === "new_channel_message" && data.message.channelId === selectedChannelId) {
          // Add the new message to the current messages
          queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannelId}/messages`] });
        } else if (data.type === "auth_success") {
          console.log("WebSocket authentication successful");
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
    };

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [user, selectedChannelId]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold">Please sign in to access channels</h1>
        <Link href="/auth">
          <Button className="mt-4">Sign In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Channel Sidebar */}
      <div className="w-64 bg-background border-r flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Channels</h2>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a new channel</DialogTitle>
                <DialogDescription>
                  Channels are where your team communicates. They're best organized around a topic.
                </DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                  <FormField
                    control={createForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Channel Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. marketing" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="What's this channel about?" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Privacy</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select channel type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="public">
                                Public - Anyone in the workspace can join
                              </SelectItem>
                              <SelectItem value="private">
                                Private - Only invited people can join
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button 
                      type="submit" 
                      disabled={createChannelMutation.isPending}
                    >
                      {createChannelMutation.isPending ? "Creating..." : "Create Channel"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="p-2">
          <div className="relative">
            <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search channels" className="pl-8" />
          </div>
        </div>
        <ScrollArea className="flex-grow">
          {isLoadingChannels ? (
            <div className="space-y-2 p-2">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="p-2 flex items-center space-x-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : channelsError ? (
            <div className="p-4 text-center text-destructive">
              Failed to load channels
            </div>
          ) : channels?.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No channels available
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {channels?.map((channel: any) => (
                <Button
                  key={channel.id}
                  variant={selectedChannelId === channel.id ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setSelectedChannelId(channel.id)}
                >
                  <span className="truncate">
                    {channel.type === "private" ? (
                      <Shield className="inline-block mr-2 h-4 w-4" />
                    ) : (
                      <MessagesSquare className="inline-block mr-2 h-4 w-4" />
                    )}
                    {channel.name}
                  </span>
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChannelId ? (
          <>
            {/* Channel Header */}
            <div className="p-4 border-b flex justify-between items-center">
              <div className="flex items-center">
                <h2 className="text-lg font-semibold">
                  {channels?.find((c: any) => c.id === selectedChannelId)?.name || "Loading..."}
                </h2>
                <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {channels?.find((c: any) => c.id === selectedChannelId)?.description || "No description"}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Sheet open={membersSheetOpen} onOpenChange={setMembersSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Users className="h-4 w-4 mr-2" />
                      Members
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                    <SheetHeader>
                      <SheetTitle className="flex items-center">
                        <Users className="mr-2 h-5 w-5" />
                        Channel Members
                      </SheetTitle>
                      <SheetDescription>
                        Manage members and their roles in this channel
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-4">
                      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="mb-4">
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add Member
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add a new member</DialogTitle>
                            <DialogDescription>
                              Select a user and role to add them to this channel.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                              <label htmlFor="user" className="text-sm font-medium">User</label>
                              <Select
                                onValueChange={(value) => setNewMemberId(parseInt(value))}
                                value={newMemberId?.toString() || ""}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a user" />
                                </SelectTrigger>
                                <SelectContent>
                                  {allUsers
                                    .filter(u => 
                                      // Filter out users who are already members
                                      !channelDetails?.members?.some(m => m.userId === u.id)
                                    )
                                    .map(u => (
                                      <SelectItem key={u.id} value={u.id.toString()}>
                                        {u.username}
                                      </SelectItem>
                                    ))
                                  }
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label htmlFor="role" className="text-sm font-medium">Role</label>
                              <Select
                                onValueChange={setMemberRole}
                                defaultValue="member"
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="member">Member</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="owner">Owner</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button 
                              onClick={() => {
                                if (newMemberId) {
                                  addMemberMutation.mutate({
                                    userId: newMemberId,
                                    role: memberRole,
                                  });
                                }
                              }}
                              disabled={!newMemberId || addMemberMutation.isPending}
                            >
                              {addMemberMutation.isPending ? "Adding..." : "Add Member"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      
                      <div className="space-y-2">
                        {isLoadingChannelDetails ? (
                          <div className="space-y-2">
                            {Array(3).fill(0).map((_, i) => (
                              <Skeleton key={i} className="h-14 w-full" />
                            ))}
                          </div>
                        ) : channelDetailsError ? (
                          <div className="text-center text-destructive">
                            Failed to load channel members
                          </div>
                        ) : channelDetails?.members?.length === 0 ? (
                          <div className="text-center text-muted-foreground py-4">
                            No members in this channel yet
                          </div>
                        ) : (
                          <div>
                            {channelDetails?.members?.map((member: any) => (
                              <div key={member.id} className="flex items-center justify-between p-2 border-b last:border-b-0">
                                <div className="flex items-center space-x-3">
                                  <Avatar>
                                    <AvatarImage src={member.user?.avatar} />
                                    <AvatarFallback>
                                      {member.user?.username ? member.user.username.substring(0, 2).toUpperCase() : "??"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium flex items-center">
                                      {member.user?.username}
                                      {member.role === 'owner' && (
                                        <Crown className="h-4 w-4 ml-1 text-amber-500" />
                                      )}
                                      {member.role === 'admin' && (
                                        <ShieldCheck className="h-4 w-4 ml-1 text-blue-500" />
                                      )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>

                                {/* Current user is owner or admin or site admin */}
                                {(channelDetails?.members?.some((m: any) => 
                                  m.userId === user?.id && ['owner', 'admin'].includes(m.role)
                                ) || user?.isAdmin) && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <Settings className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Member Actions</DropdownMenuLabel>
                                      
                                      {/* Role selection - only owners can change roles */}
                                      {(channelDetails?.members?.some((m: any) => 
                                        m.userId === user?.id && m.role === 'owner'
                                      ) || user?.isAdmin) && (
                                        <>
                                          <DropdownMenuItem
                                            onClick={() => updateMemberRoleMutation.mutate({
                                              userId: member.userId,
                                              role: 'member'
                                            })}
                                            disabled={member.role === 'member'}
                                          >
                                            Make Member
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => updateMemberRoleMutation.mutate({
                                              userId: member.userId,
                                              role: 'admin'
                                            })}
                                            disabled={member.role === 'admin'}
                                          >
                                            Make Admin
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => updateMemberRoleMutation.mutate({
                                              userId: member.userId,
                                              role: 'owner'
                                            })}
                                            disabled={member.role === 'owner'}
                                          >
                                            Make Owner
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                        </>
                                      )}

                                      {/* Remove option - with restrictions */}
                                      {/* Cannot remove self if owner (must transfer ownership first) */}
                                      {((member.userId !== user?.id || member.role !== 'owner') &&
                                        // Owners can remove anyone
                                        (channelDetails?.members?.some((m: any) => 
                                          m.userId === user?.id && m.role === 'owner'
                                        ) || 
                                        // Admins can remove members but not owners
                                        (channelDetails?.members?.some((m: any) => 
                                          m.userId === user?.id && m.role === 'admin'
                                        ) && member.role !== 'owner') ||
                                        // Site admin can remove anyone
                                        user?.isAdmin)
                                      ) && (
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() => setConfirmRemoveMemberId(member.userId)}
                                        >
                                          <Trash className="h-4 w-4 mr-2" />
                                          Remove
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}

                                {/* Confirmation dialog for member removal */}
                                <AlertDialog 
                                  open={confirmRemoveMemberId === member.userId} 
                                  onOpenChange={(open) => !open && setConfirmRemoveMemberId(null)}
                                >
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to remove {member.user?.username} from this channel? 
                                        This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => removeMemberMutation.mutate(member.userId)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        {removeMemberMutation.isPending ? "Removing..." : "Remove"}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
                
                <Sheet open={settingsSheetOpen} onOpenChange={setSettingsSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle className="flex items-center">
                        <Settings className="mr-2 h-5 w-5" />
                        Channel Settings
                      </SheetTitle>
                      <SheetDescription>
                        Update channel details and permissions
                      </SheetDescription>
                    </SheetHeader>
                    <div className="py-4">
                      <Form {...editForm}>
                        <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                          <FormField
                            control={editForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Channel Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. marketing" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Input placeholder="What's this channel about?" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editForm.control}
                            name="type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Privacy</FormLabel>
                                <FormControl>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select channel type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="public">
                                        Public - Anyone in the workspace can join
                                      </SelectItem>
                                      <SelectItem value="private">
                                        Private - Only invited people can join
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="pt-4 space-y-4">
                            <Button 
                              type="submit" 
                              className="w-full"
                              disabled={updateChannelMutation.isPending}
                            >
                              {updateChannelMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                            
                            {/* Delete channel option */}
                            {(user?.isAdmin || channelDetails?.members?.some((m: any) => 
                              m.userId === user?.id && ['owner', 'admin'].includes(m.role)
                            )) && (
                              <Button 
                                type="button"
                                variant="destructive" 
                                className="w-full"
                                onClick={() => setConfirmDeleteOpen(true)}
                              >
                                <Trash className="h-4 w-4 mr-2" />
                                Delete Channel
                              </Button>
                            )}
                          </div>
                          
                          {/* Delete confirmation dialog */}
                          <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Channel</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this channel? This action cannot be undone 
                                  and all messages will be permanently deleted.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteChannelMutation.mutate()}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  disabled={deleteChannelMutation.isPending}
                                >
                                  {deleteChannelMutation.isPending ? "Deleting..." : "Delete Channel"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </form>
                      </Form>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              {isLoadingMessages ? (
                <div className="space-y-4">
                  {Array(5).fill(0).map((_, i) => (
                    <div key={i} className="flex items-start space-x-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-64" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : messagesError ? (
                <div className="p-4 text-center text-destructive">
                  Failed to load messages
                </div>
              ) : messages?.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No messages in this channel yet. Be the first to send a message!
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Sort messages chronologically - oldest at the top, newest at the bottom */}
                  {[...messages || []].sort((a, b) => 
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                  ).map((msg: any) => (
                    <div key={msg.id} className="flex items-start space-x-3">
                      <Avatar>
                        <AvatarImage src={msg.user?.avatar} />
                        <AvatarFallback>
                          {msg.user?.username ? msg.user.username.substring(0, 2).toUpperCase() : "??"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold">{msg.user?.username || "Unknown User"}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.type === "system" && (
                            <Badge variant="outline">System</Badge>
                          )}
                        </div>
                        <p className="text-sm mt-1">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <Input
                  placeholder="Type a message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={sendMessageMutation.isPending}
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={sendMessageMutation.isPending || !message.trim()}
                >
                  {sendMessageMutation.isPending ? "Sending..." : "Send"}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <MessagesSquare className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Welcome to Channels</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              This is where your team communications happen. Select a channel from the sidebar or create a new one to get started.
            </p>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>Create a Channel</Button>
              </DialogTrigger>
              {/* Dialog content is defined above */}
            </Dialog>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChannelsPage;