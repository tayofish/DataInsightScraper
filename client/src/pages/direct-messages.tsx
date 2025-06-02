import { FC, useState, useEffect, useRef, useMemo, KeyboardEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { 
  Search, 
  MoreVertical, 
  User, 
  Phone, 
  Plus, 
  Bold, 
  Italic, 
  Underline, 
  Code, 
  Link2, 
  Paperclip,
  FileUp,
  Image as ImageIcon,
  ChevronRight
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { FormattingToolbar } from "@/components/formatting-toolbar";
import { FileUploadPreview } from "@/components/file-upload-preview";
import { FormatMessage } from "@/components/format-message";
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
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [newConversationDialogOpen, setNewConversationDialogOpen] = useState(false);
  
  // Local state for optimistic messages
  const [localMessages, setLocalMessages] = useState<any[]>([]);
  
  // Mention functionality
  const [mentionDropdownOpen, setMentionDropdownOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  
  // Formatting and file upload state
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  // Flag to control markdown visibility in text input
  const [textFormattingEnabled, setTextFormattingEnabled] = useState(true);
  
  // Utility function to format date for headers
  const formatDateHeader = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const messageDate = new Date(date);
    messageDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    
    if (messageDate.getTime() === today.getTime()) {
      return "Today";
    } else if (messageDate.getTime() === yesterday.getTime()) {
      return "Yesterday";
    } else {
      return messageDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };
  
  // This will modify the displayed text in the text area (hiding/showing markdown symbols)
  const displayText = useMemo(() => {
    if (textFormattingEnabled) {
      return message;
    } else {
      // Hide markdown symbols for a cleaner view
      return message
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1')     // Italic
        .replace(/__(.*?)__/g, '$1')     // Underline
        .replace(/`(.*?)`/g, '$1')       // Code
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1'); // Links
    }
  }, [message, textFormattingEnabled]);
  
  // Format toolbar action handlers
  const handleFormatClick = (format: string) => {
    if (!messageInputRef.current) return;
    
    const input = messageInputRef.current;
    const selStart = input.selectionStart || 0;
    const selEnd = input.selectionEnd || 0;
    const selectedText = message.substring(selStart, selEnd);
    
    let formattedText = '';
    let newCursorPosition = 0;
    
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        newCursorPosition = selStart + 2;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        newCursorPosition = selStart + 1;
        break;
      case 'underline':
        formattedText = `__${selectedText}__`;
        newCursorPosition = selStart + 2;
        break;
      case 'code':
        formattedText = `\`${selectedText}\``;
        newCursorPosition = selStart + 1;
        break;
      case 'link':
        formattedText = `[${selectedText}](url)`;
        newCursorPosition = selEnd + 3;
        break;
      default:
        return;
    }
    
    const newText = 
      message.substring(0, selStart) + 
      formattedText + 
      message.substring(selEnd);
    
    setMessage(newText);
    
    // Force a re-render first
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(
        selectedText ? selStart + formattedText.length : newCursorPosition,
        selectedText ? selStart + formattedText.length : newCursorPosition + (selectedText ? 0 : 3)
      );
    }, 0);
  };
  
  const handleFileUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = "";
      fileInputRef.current.click();
    }
  };
  
  const handleImageUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = "image/*";
      fileInputRef.current.click();
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadProgress(0);
      
      // Simulate upload progress for now
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 300);
    }
  };
  
  const cancelFileUpload = () => {
    setSelectedFile(null);
    setUploadProgress(0);
  };
  
  // Helper function to highlight mentions in messages
  const renderMessageContent = (content: string) => {
    if (!content) return "";
    
    // Updated regex to support mentions with underscores for full names
    const mentionRegex = /@([a-zA-Z0-9_\.]+)/g;
    
    // Create a temporary div to hold the content
    const fragments: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // Use exec to find all matches with their positions
    let matches = [];
    let match;
    const regex = new RegExp(mentionRegex);
    
    while ((match = regex.exec(content)) !== null) {
      matches.push({
        match: match[0],
        username: match[1],
        index: match.index
      });
    }
    
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
      
      // Get the mention name and convert underscores back to spaces
      const mentionName = match.username.replace(/_/g, ' '); // Convert underscores back to spaces
      
      // Add the mention with highlighting
      fragments.push(
        <span 
          key={`mention-${match.index}`} 
          className="bg-accent text-accent-foreground px-1.5 rounded font-medium"
        >
          @{mentionName}
        </span>
      );
      
      // Update lastIndex to after this mention
      lastIndex = (match.index || 0) + match.match.length;
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
  
  // Combine server messages with optimistic ones (improved for offline support)
  const messages = useMemo(() => {
    const serverMessages = Array.isArray(messagesQuery.data) ? messagesQuery.data : [];
    
    // Use a more resilient approach to identify and keep optimistic messages
    // Include any local messages that are marked as optimistic and don't have a matching server message
    const pendingMessages = localMessages.filter(localMsg => {
      // Keep optimistic messages that haven't been confirmed yet
      if (!localMsg.isOptimistic) return false;
      
      // Generate a client-side ID if none exists
      const clientId = localMsg.clientId || `local-${localMsg.content.substring(0, 10)}-${Date.now()}`;
      
      // Check if this message exists on the server by content and rough timestamp
      return !serverMessages.some(serverMsg => {
        // Check for exact content match
        const contentMatch = serverMsg.content === localMsg.content;
        
        // If sender IDs don't match, it's definitely not a match
        if (serverMsg.senderId !== user?.id) return false;
        
        // If we have a direct ID match based on clientId, it's a match
        if (serverMsg.clientId === clientId) return true;
        
        // Fallback: use content matching
        return contentMatch;
      });
    });
    
    console.log(`Combining ${serverMessages.length} server messages with ${pendingMessages.length} pending messages`);
    
    // Combine and sort messages by creation time to ensure newest messages are at the bottom
    return [...serverMessages, ...pendingMessages].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateA - dateB; // ascending order (oldest first, newest last)
    });
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
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
  
  // Handle keyboard navigation in the mentions dropdown and message submission
  const handleMessageKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // First handle mentions dropdown if it's open
    if (mentionDropdownOpen) {
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
            insertMention(filteredUsers[selectedMentionIndex].username, filteredUsers[selectedMentionIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setMentionDropdownOpen(false);
          break;
      }
      return;
    }
    
    // If mentions dropdown is not open, handle Enter for message submission
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Create a synthetic submit event to ensure form submission works consistently
      const form = e.currentTarget.closest('form');
      if (form) {
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true }) as unknown as React.FormEvent;
        handleSendMessage(submitEvent);
      }
    }
  };
  
  // Insert a mention at cursor position
  const insertMention = (username: string, user?: any) => {
    if (mentionStartIndex === -1) return;
    
    // Use full name if available, otherwise use username
    // Replace spaces with underscores for mentions with full names
    const mentionName = user?.name ? user.name.replace(/\s+/g, '_') : username;
    
    const beforeMention = message.substring(0, mentionStartIndex);
    const afterMention = message.substring(cursorPosition);
    
    const newMessage = `${beforeMention}@${mentionName} ${afterMention}`;
    setMessage(newMessage);
    
    // Close the dropdown and reset mention state
    setMentionDropdownOpen(false);
    setMentionStartIndex(-1);
    
    // Focus back on input
    setTimeout(() => {
      if (messageInputRef.current) {
        messageInputRef.current.focus();
        
        // Position cursor right after the inserted mention and space
        const newCursorPos = mentionStartIndex + mentionName.length + 2; // @ + name + space
        messageInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Handle message submission
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !selectedFile) || !selectedUserId) return;

    // Check if we have a file to upload
    if (selectedFile) {
      // Create a FormData object to send file
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('receiverId', selectedUserId.toString());
      
      if (message.trim()) {
        formData.append('content', message.trim());
      }
      
      // Create an optimistic message for immediate UI feedback
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        senderId: user?.id,
        receiverId: selectedUserId,
        content: message.trim() || "", // Either trimmed message or empty, but not file info in content
        createdAt: new Date().toISOString(),
        sender: user,
        isOptimistic: true,
        type: "file",
        attachments: {
          fileName: selectedFile.name,
          originalName: selectedFile.name
        } // For proper UI display
      };
      
      // Immediately update the UI with the optimistic message
      setLocalMessages(prev => [...prev, optimisticMessage]);
      
      // Upload the file via REST API
      fetch(`/api/direct-messages/upload`, {
        method: 'POST',
        body: formData,
      })
      .then(response => {
        if (!response.ok) throw new Error('File upload failed');
        return response.json();
      })
      .then(data => {
        // File uploaded successfully
        queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/${selectedUserId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/conversations`] });
        
        // Clear the file selection and message
        setSelectedFile(null);
        setUploadProgress(0);
        setMessage("");
      })
      .catch(error => {
        console.error("Error uploading file:", error);
        toast({
          title: "File upload failed",
          description: error.message,
          variant: "destructive",
        });
        
        // Remove the optimistic message on error
        setLocalMessages(prev => 
          prev.filter(msg => msg.id !== optimisticMessage.id)
        );
      });
      
      return;
    }
    
    // Text-only message handling
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
    
    // Generate a client ID for message tracking
    const clientId = `dm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const connectionStatus = wsStatus; // Cache the current connection status
    const offline = connectionStatus !== 'connected';
    
    // Update local message with client ID for tracking
    setLocalMessages(prev => prev.map(msg => 
      msg.id === optimisticMessage.id 
        ? {...msg, clientId, pendingSync: true, offline} 
        : msg
    ));
    
    if (connectionStatus === 'connected' || offline) {
      try {
        // Send through WebSocket, which will queue if offline
        console.log("Sending direct message via WebSocket", {
          type: "direct_message",
          receiverId: selectedUserId,
          content: message,
          clientId
        });
        
        // Use REST API as primary method (more reliable)
        sendMessageMutation.mutate({
          content: message,
          receiverId: selectedUserId
        });
        
        // Also try WebSocket as backup
        sendMessage({
          type: "direct_message",
          receiverId: selectedUserId,
          content: message,
          clientId,
          timestamp: Date.now()
        });
        

      } catch (error) {
        console.error("Error sending message via WebSocket:", error);
        
        // Still keep optimistic message visible since it's in the queue
        if (!offline) {
          // Only try API if we're connected
          sendMessageMutation.mutate({
            content: message,
            receiverId: selectedUserId,
          });
        }
      }
    } else {
      // Check if we should attempt to use the API
      if (offline) {
        // We're offline but still want to show the message locally
        toast({
          title: "Message queued",
          description: "Your message will be sent when connection is restored.",
        });
      } else {
        // Use the API if WebSocket is not connected but we're online
        sendMessageMutation.mutate({
          content: message,
          receiverId: selectedUserId,
        });
      }
    }
    
    // Clear the input field immediately for better UX
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

  // Function to handle editing direct messages
  const handleEditMessage = async (messageId: number, newContent: string) => {
    if (!selectedUserId) return;
    
    try {
      console.log("Editing direct message:", messageId, "with new content:", newContent);
      
      // Optimistically update the UI
      setLocalMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === messageId 
            ? {...msg, content: newContent, edited: true} 
            : msg
        )
      );
      
      // Send the edit request to the server
      const response = await fetch(`/api/direct-messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newContent }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to edit message');
      }
      
      // The real update will come via WebSocket, but we can also update with the server response
      const updatedMessage = await response.json();
      console.log("Direct message edited successfully:", updatedMessage);
      
      // Refresh messages to ensure consistency
      messagesQuery.refetch();
      
    } catch (error) {
      console.error("Error editing direct message:", error);
      toast({
        title: "Error",
        description: "Failed to edit message. Please try again.",
        variant: "destructive"
      });
      
      // Revert the optimistic update
      messagesQuery.refetch();
    }
  };

  // Real-time message handler - direct WebSocket approach
  useEffect(() => {
    if (!user || !selectedUserId) return;
    
    // Set up direct WebSocket connection for real-time messages
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('Direct message WebSocket connected');
      // Authenticate
      ws.send(JSON.stringify({
        type: 'auth',
        userId: user.id,
        username: user.username
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Direct WebSocket message:', data.type, data);
        
        // Handle direct message events
        if ((data.type === 'new_direct_message' || data.type === 'direct_message_sent') && data.message) {
          const message = data.message;
          console.log('Processing real-time message:', message);
          
          // Only process messages for the current conversation
          if ((message.senderId === selectedUserId && message.receiverId === user.id) || 
              (message.senderId === user.id && message.receiverId === selectedUserId)) {
              
            console.log("Updating cache for conversation:", selectedUserId);
            
            // Immediately update the query cache
            queryClient.setQueryData(
              [`/api/direct-messages/${selectedUserId}`],
              (oldData: any[] = []) => {
                const exists = oldData.some((m: any) => m.id === message.id);
                if (!exists) {
                  console.log("Adding new message to cache:", message.id);
                  const updated = [...oldData, message].sort((a, b) => 
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                  );
                  return updated;
                }
                return oldData;
              }
            );
            
            // Scroll to show new message
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return () => {
      ws.close();
    };
  }, [user, selectedUserId, queryClient]);

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
                      <div className="font-medium truncate">{convo.user.name || convo.user.username}</div>
                      {convo.user.email && (
                        <div className="text-xs text-muted-foreground truncate">
                          {convo.user.email}
                        </div>
                      )}
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

            {/* Messages Area - with fixed height to prevent overflow issues */}
            <ScrollArea className="flex-1 p-4 max-h-[calc(100vh-230px)]">
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
                  {/* Sort messages chronologically and group by date */}
                  {(() => {
                    const sortedMessages = [...messages || []].sort((a, b) => 
                      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                    );
                    
                    // Group messages by date
                    const groups: { date: string; messages: any[] }[] = [];
                    let currentDate = '';
                    let currentGroup: any[] = [];

                    sortedMessages.forEach(message => {
                      const messageDate = new Date(message.createdAt).toDateString();
                      
                      if (messageDate !== currentDate) {
                        // Save previous group if it exists
                        if (currentGroup.length > 0) {
                          groups.push({ date: currentDate, messages: currentGroup });
                        }
                        
                        // Start new group
                        currentDate = messageDate;
                        currentGroup = [message];
                      } else {
                        currentGroup.push(message);
                      }
                    });

                    // Don't forget the last group
                    if (currentGroup.length > 0) {
                      groups.push({ date: currentDate, messages: currentGroup });
                    }

                    return groups.map((group, groupIndex) => (
                      <div key={groupIndex}>
                        {/* Date separator - sticky */}
                        <div className="sticky top-0 z-10 flex items-center justify-center my-6 bg-background/95 backdrop-blur-sm">
                          <div className="flex-1 border-t border-border"></div>
                          <div className="px-4 py-2 bg-muted rounded-full shadow-sm">
                            <span className="text-sm font-medium text-muted-foreground">
                              {formatDateHeader(new Date(group.date))}
                            </span>
                          </div>
                          <div className="flex-1 border-t border-border"></div>
                        </div>
                        
                        {/* Messages for this date */}
                        <div className="space-y-4">
                          {group.messages.map((msg: any) => {
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
                          <div className={`flex items-center ${isCurrentUser ? 'justify-end' : ''} space-x-2`}>
                            <span className="font-semibold">
                              {isCurrentUser ? 'You' : (msg.sender?.name || msg.sender?.username || "Unknown User")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {msg.isEdited && <span className="ml-1">(edited)</span>}
                            </span>
                          </div>
                          <div className={`mt-1 p-3 rounded-lg ${isCurrentUser ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}>
                            {msg.type === "file" ? (
                              <div>
                                {msg.content && msg.content.trim() !== "" && (
                                  <div className="mb-2">{msg.content}</div>
                                )}
                                {console.log("Rendering file message:", msg)}
                                <div>
                                  {msg.fileUrl && msg.fileUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? (
                                    <div>
                                      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                                        <img 
                                          src={msg.fileUrl} 
                                          alt={msg.fileName || "Attached image"} 
                                          className="max-w-full max-h-[300px] rounded-md border border-border" 
                                        />
                                      </a>
                                      {msg.fileName && <div className="text-xs text-muted-foreground mt-1">{msg.fileName}</div>}
                                    </div>
                                  ) : msg.fileUrl ? (
                                    <a 
                                      href={msg.fileUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 p-2 border border-border rounded-md hover:bg-accent/10 transition-colors"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                      </svg>
                                      <span className="text-sm font-medium">{msg.fileName || "Download attachment"}</span>
                                    </a>
                                  ) : msg.attachments ? (
                                    <div className="flex items-center gap-2 p-2 border border-border rounded-md">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                      </svg>
                                      <span className="text-sm font-medium">
                                        {typeof msg.attachments === 'string' && msg.attachments.startsWith('{') 
                                          ? JSON.parse(msg.attachments)?.originalName || "File attachment" 
                                          : "File attachment"}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-muted-foreground italic">File attachment not available</div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <FormatMessage 
                                content={msg.content} 
                                fileUrl={msg.fileUrl} 
                                fileName={msg.fileName}
                                type={msg.type}
                                messageId={msg.id}
                                userId={msg.senderId}
                                currentUserId={user?.id}
                                createdAt={msg.createdAt}
                                onEditMessage={handleEditMessage}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                        </div>
                      </div>
                    ));
                  })()}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex flex-col">
                {/* Formatting Toolbar */}
                {showFormatToolbar && (
                  <FormattingToolbar 
                    onFormatClick={handleFormatClick}
                    onFileUploadClick={handleFileUploadClick}
                    onImageUploadClick={handleImageUploadClick}
                  />
                )}
                
                {/* File Upload Preview */}
                {selectedFile && (
                  <FileUploadPreview 
                    file={selectedFile}
                    progress={uploadProgress}
                    onCancel={cancelFileUpload}
                  />
                )}
                
                {/* Hidden File Input */}
                <input 
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileChange}
                />
                
                <div className="flex items-center justify-between px-1 mb-1">
                  <div className="flex items-center gap-2">
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs"
                      onClick={(e) => {
                        e.preventDefault();
                        setTextFormattingEnabled(!textFormattingEnabled);
                      }}
                    >
                      {textFormattingEnabled ? "Hide Markdown" : "Show Markdown"}
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Textarea
                      ref={messageInputRef}
                      placeholder="Type a message... (use @ to mention users)"
                      value={textFormattingEnabled ? message : displayText}
                      onChange={handleInputChange}
                      onKeyDown={handleMessageKeyDown}
                      disabled={sendMessageMutation.isPending}
                      className="min-h-9 resize-none custom-scrollbar py-2 pr-8"
                      rows={1}
                      onFocus={() => setShowFormatToolbar(true)}
                    />
                    <Button 
                      type="button" 
                      size="icon" 
                      variant="ghost" 
                      className="absolute right-2 top-1.5 h-6 w-6 opacity-70 hover:opacity-100"
                      onClick={() => setShowFormatToolbar(prev => !prev)}
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  
                  <Button 
                    type="submit" 
                    size="icon" 
                    className="h-10 w-10 flex items-center justify-center" 
                    disabled={sendMessageMutation.isPending || (message.trim() === '' && !selectedFile)}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                  
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
                              onClick={() => insertMention(user.username, user)}
                            >
                              <Avatar className="h-6 w-6 mr-2">
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback>
                                  {user.name ? user.name.substring(0, 2).toUpperCase() : user.username.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{user.name || user.username}</span>
                              {user.name && user.username !== user.name && 
                               <span className="text-xs text-muted-foreground ml-1">({user.username})</span>}
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