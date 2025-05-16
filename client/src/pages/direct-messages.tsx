import { FC, useState, useEffect, useRef, useMemo } from "react";
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
import { useWebSocket } from "@/hooks/use-websocket";
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

const DirectMessagesPage: FC = () => {
  const { id: userId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { sendMessage, status: wsStatus } = useWebSocket();
  const [message, setMessage] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(userId ? parseInt(userId) : null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const [newConversationDialogOpen, setNewConversationDialogOpen] = useState(false);
  
  // Local state for optimistic messages
  const [localMessages, setLocalMessages] = useState<any[]>([]);
  
  // Mention functionality
  const [mentionDropdownOpen, setMentionDropdownOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  // Helper function to highlight mentions in messages
  const renderMessageContent = (content: string) => {
    if (!content) return "";
    
    // Regular expression to match @username mentions (including those with dots)
    const mentionRegex = /@([\w\.]+)/g;
    
    // Create a temporary div to hold the content
    const fragments: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // Use matchAll to get all matches with their positions
    const matches = [...content.matchAll(mentionRegex)];
    
    if (matches.length === 0) {
      return content; // No mentions found
    }
    
    // Process each match
    for (const match of matches) {
      // Add text before the mention
      if (match.index && match.index > lastIndex) {
        fragments.push(
          <span key={`text-${lastIndex}`}>
            {content.substring(lastIndex, match.index)}
          </span>
        );
      }
      
      // Add the mention with highlighting
      const mentionName = match[1]; // The username without the @
      fragments.push(
        <span 
          key={`mention-${match.index}`} 
          className="bg-accent px-1.5 rounded font-medium"
        >
          @{mentionName}
        </span>
      );
      
      // Update lastIndex to after this mention
      lastIndex = (match.index || 0) + match[0].length;
    }
    
    // Add any remaining text after the last mention
    if (lastIndex < content.length) {
      fragments.push(
        <span key={`text-end`}>{content.substring(lastIndex)}</span>
      );
    }
    
    return fragments.length > 0 ? fragments : content;
  };
  
  // Fetch all conversations
  const {
    data: conversations = [],
    isLoading: isLoadingConversations,
    error: conversationsError,
  } = useQuery<any[]>({
    queryKey: [`/api/direct-messages/conversations`],
    enabled: !!user,
  });

  // Fetch all users (for mentions and new conversations)
  const {
    data: allUsers = [],
    isLoading: isLoadingUsers,
    error: usersError,
  } = useQuery<any[]>({
    queryKey: [`/api/users`],
    enabled: !!user, // Always fetch users when logged in
  });

  // Fetch messages for the selected conversation
  const messagesQuery = useQuery<any[]>({
    queryKey: [`/api/direct-messages/${selectedUserId}`],
    enabled: !!selectedUserId && !!user,
  });
  
  // Loading and error states from the query
  const isLoadingMessages = messagesQuery.isLoading;
  const messagesError = messagesQuery.error;
  
  // Combine server messages with optimistic ones
  const messages = useMemo(() => {
    const serverMessages = Array.isArray(messagesQuery.data) ? messagesQuery.data : [];
    
    // Only include optimistic messages that haven't been confirmed yet
    const pendingMessages = localMessages.filter(msg => 
      msg.isOptimistic && 
      !serverMessages.some(serverMsg => 
        serverMsg.content === msg.content && 
        serverMsg.senderId === user?.id
      )
    );
    
    return [...serverMessages, ...pendingMessages];
  }, [messagesQuery.data, localMessages, user?.id]);

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
    onSuccess: (data, variables) => {
      // Remove the optimistic message now that we have confirmation
      setLocalMessages(prev => 
        prev.filter(msg => 
          !(msg.isOptimistic && msg.content === variables.content)
        )
      );
      
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
        setSelectedMentionIndex(0); // Reset selection index when query changes
        
        setMentionDropdownOpen(true);
        return;
      }
    }
    
    // If we get here, we're not in a mention context
    setMentionDropdownOpen(false);
  };
  
  // Handle keyboard navigation in the mentions dropdown
  const handleMessageKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!mentionDropdownOpen) return;
    
    // Get filtered users based on current query
    const filteredUsers = allUsers.filter(user => {
      const query = mentionQuery.toLowerCase();
      const username = user.username.toLowerCase();
      
      if (username.startsWith(query)) return true;
      if (username.includes('_' + query) || username.includes('.' + query)) return true;
      return username.includes(query);
    }).sort((a, b) => {
      const queryLower = mentionQuery.toLowerCase();
      const aStartsWith = a.username.toLowerCase().startsWith(queryLower);
      const bStartsWith = b.username.toLowerCase().startsWith(queryLower);
      
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return a.username.localeCompare(b.username);
    }).slice(0, 5);
    
    const maxIndex = filteredUsers.length - 1;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedMentionIndex(prevIndex => 
          prevIndex < maxIndex ? prevIndex + 1 : prevIndex
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedMentionIndex(prevIndex => 
          prevIndex > 0 ? prevIndex - 1 : 0
        );
        break;
      case 'Tab':
      case 'Enter':
        if (filteredUsers.length > 0) {
          e.preventDefault();
          insertMention(filteredUsers[selectedMentionIndex].username);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setMentionDropdownOpen(false);
        break;
    }
  };
  
  // Insert a mention at cursor position
  const insertMention = (username: string) => {
    if (mentionStartIndex === -1) return;
    
    const beforeMention = message.substring(0, mentionStartIndex);
    const afterMention = message.substring(cursorPosition);
    
    const newMessage = `${beforeMention}@${username} ${afterMention}`;
    setMessage(newMessage);
    
    // Close the dropdown and reset mention state
    setMentionDropdownOpen(false);
    setMentionStartIndex(-1);
    
    // Focus back on input
    setTimeout(() => {
      if (messageInputRef.current) {
        messageInputRef.current.focus();
        
        // Position cursor right after the inserted mention and space
        const newCursorPos = mentionStartIndex + username.length + 2; // @ + username + space
        messageInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Handle message submission
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !selectedUserId) return;

    // Create an optimistic message for immediate UI feedback
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      senderId: user?.id,
      receiverId: selectedUserId,
      content: message,
      createdAt: new Date().toISOString(),
      sender: user,
      isOptimistic: true
    };
    
    // Immediately update the UI with the optimistic message
    setLocalMessages(prev => [...prev, optimisticMessage]);
    
    // Use WebSocket for real-time messaging
    if (wsStatus === 'connected') {
      try {
        sendMessage({
          type: "direct_message",
          receiverId: selectedUserId,
          content: message
        });
        
        setMessage("");
      } catch (error) {
        console.error("Error sending message via WebSocket:", error);
        // Fallback to API if WebSocket fails
        sendMessageMutation.mutate({
          content: message,
          receiverId: selectedUserId,
        });
      }
    } else {
      // Use the API if WebSocket is not connected
      sendMessageMutation.mutate({
        content: message,
        receiverId: selectedUserId,
      });
    }
    
    // Clear the input field immediately for better UX
  // Also invalidate the query to refresh the messages
    setMessage("");
    
    // Set up a timeout to clear the message if it gets stuck
    const messageId = optimisticMessage.id;
    const timeoutId = setTimeout(() => {
      // Check if the optimistic message is still in state and remove it if so
      setLocalMessages(prevMessages => {
        const messageStillExists = prevMessages.some(msg => msg.id === messageId);
        if (messageStillExists) {
          console.log(`Message timeout triggered for: ${messageId}`);
          return prevMessages.filter(msg => msg.id !== messageId);
        }
        return prevMessages;
      });
    }, 10000); // 10 seconds timeout
  };

  // Scroll to bottom of messages when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Use the global WebSocket context to handle direct message events
  useEffect(() => {
    if (!user || !queryClient) return;
    
    // The WebSocket connection is now managed by the global WebSocket context
    // We just need to react to messages related to direct messages
    
    // The lastMessage will be automatically updated by the WebSocket context
    // whenever a new message is received
    const handleNewMessage = () => {
      // If the global context has a lastMessage property, use it
      if (wsStatus === 'connected' && selectedUserId) {
        // When a new direct message is received, we need to update our queries
        queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/${selectedUserId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/conversations`] });
      }
    };
    
    // The useEffect cleanup function will run automatically when the component is unmounted
  }, [user, selectedUserId, queryClient, wsStatus]);

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
                  {/* Sort messages chronologically - oldest at the top, newest at the bottom */}
                  {[...messages || []].sort((a, b) => 
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                  ).map((msg: any) => {
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
                            {renderMessageContent(msg.content)}
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
                <div className="relative flex-1">
                  <Input
                    ref={messageInputRef}
                    placeholder="Type a message... (use @ to mention users)"
                    value={message}
                    onChange={handleInputChange}
                    onKeyDown={handleMessageKeyDown}
                    disabled={sendMessageMutation.isPending}
                    className="flex-1"
                  />
                  
                  {/* Mentions dropdown */}
                  {mentionDropdownOpen && (
                    <div 
                      className="absolute z-50 bg-background border rounded-md shadow-lg w-64 max-h-48 overflow-y-auto mt-1"
                      style={{ 
                        bottom: "45px", /* Position above the input field */
                        left: "10px"    /* Offset from the left edge */
                      }}
                    >
                      {allUsers
                        .filter(user => {
                          const query = mentionQuery.toLowerCase();
                          const username = user.username.toLowerCase();
                          // First prioritize exact prefix matches
                          if (username.startsWith(query)) {
                            return true;
                          }
                          // Then check for word boundary matches (underscore, period, etc)
                          if (username.includes('_' + query) || 
                              username.includes('.' + query)) {
                            return true;
                          }
                          // Finally, include any substring matches
                          return username.includes(query);
                        })
                        // Sort results: exact prefix matches first, then partial matches
                        .sort((a, b) => {
                          const queryLower = mentionQuery.toLowerCase();
                          const aStartsWith = a.username.toLowerCase().startsWith(queryLower);
                          const bStartsWith = b.username.toLowerCase().startsWith(queryLower);
                          
                          if (aStartsWith && !bStartsWith) return -1;
                          if (!aStartsWith && bStartsWith) return 1;
                          return a.username.localeCompare(b.username);
                        })
                        .slice(0, 5)
                        .map((user, idx) => {
                          // Highlight the matching portion of the username
                          const username = user.username;
                          const matchIndex = username.toLowerCase().indexOf(mentionQuery.toLowerCase());
                          
                          let usernameDisplay;
                          if (matchIndex >= 0 && mentionQuery.length > 0) {
                            const before = username.substring(0, matchIndex);
                            const match = username.substring(matchIndex, matchIndex + mentionQuery.length);
                            const after = username.substring(matchIndex + mentionQuery.length);
                            
                            usernameDisplay = (
                              <>
                                {before}
                                <span className="font-bold text-accent-foreground">{match}</span>
                                {after}
                              </>
                            );
                          } else {
                            usernameDisplay = username;
                          }
                          
                          return (
                            <div
                              key={user.id}
                              className={`p-2 cursor-pointer flex items-center ${
                                selectedMentionIndex === idx 
                                  ? 'bg-accent font-semibold' 
                                  : 'hover:bg-accent/50'
                              }`}
                              onClick={() => insertMention(user.username)}
                            >
                              <Avatar className="h-6 w-6 mr-2">
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback>
                                  {user.username.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span>{usernameDisplay}</span>
                            </div>
                          );
                        })}
                      {allUsers.filter(user => {
                        const query = mentionQuery.toLowerCase();
                        const username = user.username.toLowerCase();
                        return username.includes(query);
                      }).length === 0 && (
                        <div className="p-2 text-muted-foreground">
                          No users found matching "{mentionQuery}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
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