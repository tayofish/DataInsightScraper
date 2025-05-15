import { FC, useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Search, MoreVertical, User, Phone, Plus } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
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

// Mocked WebSocket connection (will be implemented later)
let socket: WebSocket | null = null;

const DirectMessagesPage: FC = () => {
  const { id: userId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(userId ? parseInt(userId) : null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newConversationDialogOpen, setNewConversationDialogOpen] = useState(false);
  
  // Fetch all conversations
  const {
    data: conversations = [],
    isLoading: isLoadingConversations,
    error: conversationsError,
  } = useQuery<any[]>({
    queryKey: [`/api/direct-messages/conversations`],
    enabled: !!user,
  });

  // Fetch all users for new conversation
  const {
    data: allUsers = [],
    isLoading: isLoadingUsers,
    error: usersError,
  } = useQuery<any[]>({
    queryKey: [`/api/users`],
    enabled: !!user && newConversationDialogOpen,
  });

  // Fetch messages for the selected conversation
  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    error: messagesError,
  } = useQuery<any[]>({
    queryKey: [`/api/direct-messages/${selectedUserId}`],
    enabled: !!selectedUserId && !!user,
  });

  // Send a direct message
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { content: string; receiverId: number }) => {
      const response = await fetch(`/api/direct-messages/${messageData.receiverId}`, {
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
      queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/${selectedUserId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/conversations`] });
    },
    onError: (error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Start a new conversation
  const startConversation = (userId: number) => {
    setSelectedUserId(userId);
    setNewConversationDialogOpen(false);
  };

  // Handle message submission
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !selectedUserId) return;

    sendMessageMutation.mutate({
      content: message,
      receiverId: selectedUserId,
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
        if (data.type === "new_direct_message") {
          // If this is a message from or to the currently selected user
          if (
            (data.message.senderId === selectedUserId && data.message.receiverId === user.id) ||
            (data.message.senderId === user.id && data.message.receiverId === selectedUserId)
          ) {
            queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/${selectedUserId}`] });
          }
          
          // Update conversations list to show latest messages
          queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/conversations`] });
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
  }, [user, selectedUserId]);

  // Set selectedUserId when URL param changes
  useEffect(() => {
    if (userId) {
      setSelectedUserId(parseInt(userId));
    }
  }, [userId]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold">Please sign in to access messages</h1>
        <Link href="/auth">
          <Button className="mt-4">Sign In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Conversations Sidebar */}
      <div className="w-80 bg-background border-r flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Direct Messages</h2>
          <Dialog open={newConversationDialogOpen} onOpenChange={setNewConversationDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Conversation</DialogTitle>
                <DialogDescription>
                  Select a user to start a new conversation.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="relative mb-4">
                  <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search users" className="pl-8" />
                </div>
                <ScrollArea className="h-72">
                  {isLoadingUsers ? (
                    <div className="space-y-2">
                      {Array(5).fill(0).map((_, i) => (
                        <div key={i} className="p-2 flex items-center space-x-3">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div>
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24 mt-1" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : usersError ? (
                    <div className="p-4 text-center text-destructive">
                      Failed to load users
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {allUsers
                        ?.filter((u: any) => u.id !== user.id) // Filter out current user
                        .map((otherUser: any) => (
                          <Button
                            key={otherUser.id}
                            variant="ghost"
                            className="w-full justify-start p-2"
                            onClick={() => startConversation(otherUser.id)}
                          >
                            <div className="flex items-center space-x-3">
                              <Avatar>
                                <AvatarImage src={otherUser.avatar} />
                                <AvatarFallback>
                                  {otherUser.name 
                                    ? otherUser.name.substring(0, 2).toUpperCase() 
                                    : otherUser.username.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{otherUser.name || otherUser.username}</div>
                                <div className="text-xs text-muted-foreground">
                                  {otherUser.email || `@${otherUser.username}`}
                                </div>
                              </div>
                            </div>
                          </Button>
                        ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
              <DialogFooter>
                <Button onClick={() => setNewConversationDialogOpen(false)}>
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="p-2">
          <div className="relative">
            <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search conversations" className="pl-8" />
          </div>
        </div>
        <ScrollArea className="flex-grow">
          {isLoadingConversations ? (
            <div className="space-y-2 p-2">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="p-3 flex items-center space-x-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversationsError ? (
            <div className="p-4 text-center text-destructive">
              Failed to load conversations
            </div>
          ) : conversations?.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No conversations yet. Start a new one!
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {conversations?.map((convo: any) => (
                <Button
                  key={convo.user.id}
                  variant={selectedUserId === convo.user.id ? "secondary" : "ghost"}
                  className="w-full justify-start p-3"
                  onClick={() => setSelectedUserId(convo.user.id)}
                >
                  <div className="flex items-center space-x-3 w-full">
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src={convo.user.avatar} />
                        <AvatarFallback>
                          {convo.user.name 
                            ? convo.user.name.substring(0, 2).toUpperCase() 
                            : convo.user.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {convo.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                          {convo.unreadCount}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                        <div className="font-medium truncate">{convo.user.name || convo.user.username}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(convo.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {convo.lastMessage.senderId === user.id ? "You: " : ""}
                        {convo.lastMessage.content}
                      </div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedUserId ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarImage src={conversations?.find((c: any) => c.user.id === selectedUserId)?.user.avatar} />
                  <AvatarFallback>
                    {conversations?.find((c: any) => c.user.id === selectedUserId)?.user.name?.substring(0, 2).toUpperCase() || "??"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-lg font-semibold">
                    {conversations?.find((c: any) => c.user.id === selectedUserId)?.user.name || 
                     allUsers?.find((u: any) => u.id === selectedUserId)?.name || 
                     "Loading..."}
                  </h2>
                  <div className="text-sm text-muted-foreground">
                    {conversations?.find((c: any) => c.user.id === selectedUserId)?.user.email || 
                     allUsers?.find((u: any) => u.id === selectedUserId)?.email}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="icon">
                  <Phone className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View profile</DropdownMenuItem>
                    <DropdownMenuItem>Mute notifications</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">Block user</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                  No messages in this conversation yet. Send a message to start the conversation!
                </div>
              ) : (
                <div className="space-y-4">
                  {messages?.map((msg: any) => {
                    const isCurrentUser = msg.senderId === user.id;
                    return (
                      <div key={msg.id} className={`flex items-start space-x-3 ${isCurrentUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        <Avatar>
                          <AvatarImage src={isCurrentUser ? user.avatar : msg.sender?.avatar} />
                          <AvatarFallback>
                            {isCurrentUser 
                              ? (user.name ? user.name.substring(0, 2).toUpperCase() : user.username.substring(0, 2).toUpperCase())
                              : (msg.sender?.name ? msg.sender.name.substring(0, 2).toUpperCase() : msg.sender?.username.substring(0, 2).toUpperCase())}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`max-w-[70%] ${isCurrentUser ? 'text-right' : ''}`}>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold">
                              {isCurrentUser ? 'You' : (msg.sender?.name || msg.sender?.username || "Unknown User")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className={`mt-1 p-3 rounded-lg ${isCurrentUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
            <User className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Your Direct Messages</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Connect one-on-one with your team members. Select a conversation from the sidebar or start a new one.
            </p>
            <Dialog open={newConversationDialogOpen} onOpenChange={setNewConversationDialogOpen}>
              <DialogTrigger asChild>
                <Button>Start a Conversation</Button>
              </DialogTrigger>
              {/* Dialog content is defined above */}
            </Dialog>
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectMessagesPage;