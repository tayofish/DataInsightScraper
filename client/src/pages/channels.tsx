import { FC, useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { Shield, ChevronRight, Plus, Users, MessagesSquare, Settings, Search } from "lucide-react";
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

// Mocked WebSocket connection (will be implemented later)
let socket: WebSocket | null = null;

const ChannelsPage: FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  // Fetch all available channels
  const {
    data: channels,
    isLoading: isLoadingChannels,
    error: channelsError,
  } = useQuery({
    queryKey: ["/api/channels"],
    enabled: !!user,
  });

  // Fetch messages for the selected channel
  const {
    data: messages,
    isLoading: isLoadingMessages,
    error: messagesError,
  } = useQuery({
    queryKey: ["/api/channels", selectedChannelId, "messages"],
    enabled: !!selectedChannelId && !!user,
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
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/channels", selectedChannelId, "messages"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form for creating a new channel
  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "public",
    },
  });

  // Submit handler for channel creation form
  const onSubmit = (values: ChannelFormValues) => {
    createChannelMutation.mutate(values);
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
          queryClient.invalidateQueries({ queryKey: ["/api/channels", selectedChannelId, "messages"] });
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
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
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
                    control={form.control}
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
                    control={form.control}
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
                <Button variant="outline" size="sm">
                  <Users className="h-4 w-4 mr-2" />
                  Members
                </Button>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
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
                  {messages?.map((msg: any) => (
                    <div key={msg.id} className="flex items-start space-x-3">
                      <Avatar>
                        <AvatarImage src={msg.user?.avatar} />
                        <AvatarFallback>
                          {msg.user?.name ? msg.user.name.substring(0, 2).toUpperCase() : "??"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold">{msg.user?.name || msg.user?.username || "Unknown User"}</span>
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