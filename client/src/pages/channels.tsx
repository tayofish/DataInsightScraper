import { useState, useEffect, useRef, KeyboardEvent, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, Link as WouterLink } from "wouter";
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
  AtSign,
  AlertTriangle,
  RefreshCw,
  Bold,
  Italic,
  Underline,
  Code,
  Link2,
  Paperclip,
  FileUp,
  Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { Skeleton } from "@/components/ui/skeleton";
import { FormattingToolbar } from "@/components/formatting-toolbar";
import { FileUploadPreview } from "@/components/file-upload-preview";
import { FormatMessage } from "@/components/format-message";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Channel, channelFormSchema } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";

// Tabs component for channel settings
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";

type ChannelFormValues = z.infer<typeof channelFormSchema>;

export default function ChannelsPage() {
  const { user } = useAuth();
  const { sendMessage, status: wsStatus } = useWebSocket();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{userId: number, username: string}[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Channel creation form setup
  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "public",
    },
  });
  
  // Channel settings form setup
  const settingsForm = useForm<ChannelFormValues>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "public",
    },
  });
  
  const { toast } = useToast();
  
  // Mention functionality
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionDropdownOpen, setMentionDropdownOpen] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [messageText, setMessageText] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Get all users
  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    refetchOnWindowFocus: false,
  });
  
  // Directly fetch channels data for debugging
  useEffect(() => {
    if (user) {
      fetch('/api/channels')
        .then(res => res.json())
        .then(data => {
          console.log("Direct API call result:", data);
          if (Array.isArray(data) && data.length > 0) {
            console.log("Setting channels directly:", data.length);
            setChannels(data);
            if (!selectedChannelId) {
              setSelectedChannelId(data[0].id);
            }
          }
        })
        .catch(err => console.error("Error fetching channels directly:", err));
    }
  }, [user, selectedChannelId]);

  // Keep the query for reactive updates
  const channelsQuery = useQuery({
    queryKey: ["/api/channels"],
    enabled: !!user, // Fetch channels if user is authenticated, regardless of WebSocket state
    onSuccess: (data) => {
      console.log("Channel data received from query:", data);
      if (Array.isArray(data)) {
        console.log("Setting channels from query:", data.length);
        setChannels(data);
        if (data.length > 0 && !selectedChannelId) {
          console.log("Setting selected channel ID from query:", data[0].id);
          setSelectedChannelId(data[0].id);
        }
      } else {
        console.error("Channels data is not an array:", data);
      }
    },
  });
  
  // Get channel messages - always fetch messages regardless of WebSocket status
  const messagesQuery = useQuery({
    queryKey: [`/api/channels/${selectedChannelId}/messages`],
    enabled: !!selectedChannelId && !!user
  });
  
  // Effect to remove optimistic messages when they're confirmed by the server
  useEffect(() => {
    if (Array.isArray(messagesQuery.data) && messagesQuery.data.length > 0 && messages.length > 0) {
      // Find optimistic messages that are now in server data and should be removed
      const messagesToRemove = messages.filter(optimisticMsg => 
        optimisticMsg.isOptimistic && 
        messagesQuery.data.some(serverMsg => 
          serverMsg.content === optimisticMsg.content && 
          serverMsg.userId === optimisticMsg.userId
        )
      );
      
      if (messagesToRemove.length > 0) {
        console.log("Removing confirmed optimistic messages:", messagesToRemove.length);
        setMessages(prev => prev.filter(msg => 
          !messagesToRemove.some(toRemove => toRemove.id === msg.id)
        ));
      }
    }
  }, [messagesQuery.data, messages]);
  
  // Combine server messages with optimistic ones
  const combinedMessages = useMemo(() => {
    const serverMessages = Array.isArray(messagesQuery.data) ? messagesQuery.data : [];
    
    // Only include optimistic messages that haven't been confirmed yet
    const pendingMessages = messages.filter(msg => {
      return msg.isOptimistic && 
        !serverMessages.some(serverMsg => 
          serverMsg.content === msg.content && 
          serverMsg.userId === msg.userId
        );
    });
    
    console.log(`Combined messages: ${serverMessages.length} server + ${pendingMessages.length} pending`);
    
    // Combine and sort messages by creation time to ensure newest messages are at the bottom
    return [...serverMessages, ...pendingMessages].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateA - dateB; // ascending order (oldest first, newest last)
    });
  }, [messagesQuery.data, messages]);
  
  // Get channel details
  const channelQuery = useQuery({
    queryKey: [`/api/channels/${selectedChannelId}`],
    enabled: !!selectedChannelId,
  });
  
  // Get channel members
  const membersQuery = useQuery({
    queryKey: [`/api/channels/${selectedChannelId}/members`],
    enabled: !!selectedChannelId,
  });
  
  // Create a new channel
  const createChannelMutation = useMutation({
    mutationFn: async (values: ChannelFormValues) => {
      const response = await fetch("/api/channels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        throw new Error("Failed to create channel");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setCreateDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      setSelectedChannelId(data.id);
      toast({
        title: "Channel created",
        description: `${data.name} has been created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create channel",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Add a member to the channel
  const addMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/channels/${selectedChannelId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        throw new Error("Failed to add member");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannelId}/members`] });
      toast({
        title: "Member added",
        description: "The user has been added to the channel",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add member",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update channel settings
  const updateChannelMutation = useMutation({
    mutationFn: async (values: ChannelFormValues) => {
      const response = await fetch(`/api/channels/${selectedChannelId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
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
    onError: (error: any) => {
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
        description: "The channel has been deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete channel",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Remove a member from the channel
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: number) => {
      const response = await fetch(`/api/channels/${selectedChannelId}/members/${memberId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to remove member");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannelId}/members`] });
      toast({
        title: "Member removed",
        description: "The user has been removed from the channel",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove member",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Setup channel settings form when channel changes
  useEffect(() => {
    if (channelQuery.data) {
      settingsForm.reset({
        name: channelQuery.data.name,
        description: channelQuery.data.description,
        type: channelQuery.data.type,
      });
    }
  }, [channelQuery.data, settingsForm]);
  
  // Send typing indicator when user is typing
  useEffect(() => {
    let typingTimeout: NodeJS.Timeout | null = null;
    
    if (isTyping && selectedChannelId) {
      // Send typing indicator through WebSocket
      sendMessage({
        type: "typing",
        channelId: selectedChannelId,
        isTyping: true
      });
      
      // Auto-clear typing indicator after 3 seconds of inactivity
      typingTimeout = setTimeout(() => {
        setIsTyping(false);
        if (selectedChannelId) {
          sendMessage({
            type: "typing",
            channelId: selectedChannelId,
            isTyping: false
          });
        }
      }, 3000);
    }
    
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    };
  }, [isTyping, selectedChannelId, sendMessage]);
  
  // Scroll to bottom of messages when new messages arrive or when a channel is selected
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [messages, selectedChannelId, messagesQuery.data]);
  
  // Handle @ mentions
  useEffect(() => {
    if (messageText.includes('@') && users) {
      const lastAtPos = messageText.lastIndexOf('@', cursorPosition);
      
      if (lastAtPos !== -1 && cursorPosition >= lastAtPos) {
        const query = messageText.substring(lastAtPos + 1, cursorPosition).toLowerCase();
        setMentionQuery(query);
        
        // Show all users when just @ is typed, otherwise filter
        if (query.trim() === '' && cursorPosition === lastAtPos + 1) {
          // Just show all users when only @ is typed
          setFilteredUsers(users);
          setMentionDropdownOpen(users.length > 0);
          setSelectedMentionIndex(0);
          return;
        } else if (query.trim() !== '') {
          // Filter users based on query
          const filtered = users.filter((user: any) => 
            user.username.toLowerCase().includes(query) || 
            (user.name && user.name.toLowerCase().includes(query))
          );
          
          setFilteredUsers(filtered);
          setMentionDropdownOpen(filtered.length > 0);
          setSelectedMentionIndex(0);
          return;
        }
      }
    }
    
    setMentionDropdownOpen(false);
  }, [messageText, cursorPosition, users]);
  
  // Handle message form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim() === '' && !selectedFile) return;
    
    if (selectedChannelId) {
      console.log("Sending message to channel:", selectedChannelId, messageText);
      
      // Extract mentions from the message
      const mentionedUserIds: number[] = [];
      // Updated regex to support mentions with underscores for full names
      const mentionRegex = /@([a-zA-Z0-9_\.]+)/g;
      let match;
      
      while ((match = mentionRegex.exec(messageText)) !== null) {
        const mention = match[1];
        console.log("Found mention:", mention);
        
        // Try to match by full name (with spaces converted to underscores)
        // or by username as fallback
        const mentionedUser = users?.find(user => 
          (user.name && user.name.replace(/\s+/g, '_') === mention) || 
          user.username === mention
        );
        
        if (mentionedUser) {
          console.log("Adding mentioned user:", mentionedUser.id);
          mentionedUserIds.push(mentionedUser.id);
        }
      }
      
      // Create an optimistic update object with timestamp as ID for tracking
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage = {
        id: tempId, // Temporary ID that will be replaced when the real message arrives
        channelId: selectedChannelId,
        userId: user.id,
        content: messageText,
        createdAt: new Date().toISOString(),
        mentions: mentionedUserIds.length > 0 ? JSON.stringify(mentionedUserIds) : null,
        user: user, // Add the current user object
        type: 'text',
        isOptimistic: true // Flag to identify this as an optimistic update
      };
      
      // Optimistically update the UI immediately
      setMessages(prevMessages => [...prevMessages, optimisticMessage]);
      
      // Auto-cleanup for stuck messages after timeout (10 seconds)
      setTimeout(() => {
        console.log(`Message timeout check for: ${tempId}`);
        setMessages(prev => {
          const stillExists = prev.some(msg => msg.id === tempId);
          if (stillExists) {
            console.log(`Message still pending after timeout, cleaning up: ${tempId}`);
            // Force refresh messages from server to make sure we're in sync
            messagesQuery.refetch();
            // Remove the stuck message
            return prev.filter(msg => msg.id !== tempId);
          }
          return prev;
        });
      }, 10000); // 10-second timeout for message delivery
      
      // Send via WebSocket for real-time messaging
      sendMessage({
        type: "channel_message", 
        channelId: selectedChannelId,
        content: messageText,
        mentions: mentionedUserIds
      });
      
      // Add direct API call as fallback for WebSocket issues
      if (wsStatus !== 'connected') {
        console.log("WebSocket not connected or send failed, using API fallback");
        
        fetch(`/api/channels/${selectedChannelId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: messageText,
            mentions: mentionedUserIds
          }),
        })
        .then(response => response.json())
        .then(data => {
          console.log("Message sent via API:", data);
          
          // Replace the optimistic message with the real one
          setMessages(prevMessages => 
            prevMessages.map(msg => 
              (msg.id === optimisticMessage.id) ? data : msg
            )
          );
          
          // Also refresh messages to ensure consistency
          messagesQuery.refetch();
        })
        .catch(error => {
          console.error("Error sending message via API:", error);
          
          // If there's an error, remove the optimistic message
          setMessages(prevMessages => 
            prevMessages.filter(msg => msg.id !== optimisticMessage.id)
          );
          
          // Show an error toast
          toast({
            title: "Error sending message",
            description: "Your message couldn't be sent. Please try again.",
            variant: "destructive"
          });
        });
      }
      
      setMessageText("");
      setIsTyping(false);
      setMentionDropdownOpen(false);
    }
  };
  
  // Handle message input changes
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setMessageText(newText);
    setCursorPosition(e.target.selectionStart || 0);
    
    // Set typing indicator
    if (!isTyping && newText.trim() !== '') {
      setIsTyping(true);
    } else if (newText.trim() === '') {
      setIsTyping(false);
    }
    
    // Check for mentions
    const lastAtIndex = e.target.value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = e.target.value.slice(lastAtIndex + 1);
      const match = textAfterAt.match(/^([a-zA-Z0-9_]*)(?:\s|$)/);
      
      if (match && e.target.selectionStart <= lastAtIndex + match[0].length + 1) {
        setMentionQuery(match[1]);
        setMentionDropdownOpen(true);
        setSelectedMentionIndex(0);
      } else {
        setMentionDropdownOpen(false);
      }
    } else {
      setMentionDropdownOpen(false);
    }
  };
  
  const handleFormatClick = (format: string) => {
    if (!inputRef.current) return;
    
    const input = inputRef.current;
    const selStart = input.selectionStart || 0;
    const selEnd = input.selectionEnd || 0;
    const selectedText = messageText.substring(selStart, selEnd);
    
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
      messageText.substring(0, selStart) + 
      formattedText + 
      messageText.substring(selEnd);
    
    setMessageText(newText);
    
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
      fileInputRef.current.accept = "*/*"; // Accept any file type
      fileInputRef.current.click();
    }
  };
  
  const handleImageUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = "image/*"; // Only accept images
      fileInputRef.current.click();
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Set the selected file for preview
      setSelectedFile(file);
      setUploadProgress(0);
      
      // Start upload progress animation (this is just visual feedback)
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 10;
        });
      }, 200);
    }
    
    // Reset the input so the same file can be selected again if needed
    if (e.target.value) {
      e.target.value = '';
    }
  };
  
  const cancelFileUpload = () => {
    setSelectedFile(null);
    setUploadProgress(0);
  };
  
  // Handle keyboard events for message input
  const handleMessageKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle mention selection with arrow keys
    if (mentionDropdownOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => prev > 0 ? prev - 1 : 0);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        insertMention(filteredUsers[selectedMentionIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setMentionDropdownOpen(false);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredUsers[selectedMentionIndex]);
      }
      return;
    }
    
    // Submit with Enter (but allow Shift+Enter for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  // Insert @mention into the message text
  const insertMention = (user: any) => {
    if (!user) return;
    
    // Use full name if available, otherwise fall back to username
    // Replace spaces with underscores for mentions with full names
    const mentionName = user.name ? user.name.replace(/\s+/g, '_') : user.username;
    
    const lastAtPos = messageText.lastIndexOf('@', cursorPosition);
    const beforeMention = messageText.substring(0, lastAtPos);
    const afterMention = messageText.substring(cursorPosition);
    const newText = `${beforeMention}@${mentionName} ${afterMention}`;
    
    setMessageText(newText);
    
    // Focus and set cursor position after the inserted mention
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = lastAtPos + mentionName.length + 2; // +2 for @ and space
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        setCursorPosition(newCursorPos);
      }
    }, 0);
    
    setMentionDropdownOpen(false);
    setSelectedMentionIndex(0);
  };
  
  // Format message content with @mentions highlighted
  const formatMessageWithMentions = (content: string) => {
    if (!content) return "";
    
    // Updated regex to support mentions with underscores for full names
    const regex = /@([a-zA-Z0-9_]+)/g;
    const fragments: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    
    // Match all @mentions in the content
    while ((match = regex.exec(content)) !== null) {
      const matchIndex = match.index;
      
      // Add text before this mention
      if (matchIndex > lastIndex) {
        fragments.push(
          <span key={`text-${lastIndex}-${matchIndex}`}>{content.substring(lastIndex, matchIndex)}</span>
        );
      }
      
      // Get the mention text
      const mentionText = match[0];
      // Convert underscores back to spaces for display to show proper full names
      const displayText = mentionText.replace(/@([a-zA-Z0-9_]+)/, (_, name) => 
        `@${name.replace(/_/g, ' ')}`
      );
      
      // Add the mention with highlighting
      fragments.push(
        <span 
          key={`mention-${matchIndex}`} 
          className="bg-primary/20 text-primary font-medium rounded px-1 py-0.5"
        >
          {displayText}
        </span>
      );
      
      // Update lastIndex to after this mention
      lastIndex = matchIndex + match[0].length;
    }
    
    // Add any remaining text after the last mention
    if (lastIndex < content.length) {
      fragments.push(
        <span key={`text-end`}>{content.substring(lastIndex)}</span>
      );
    }
    
    return fragments.length > 0 ? fragments : content;
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold">Please sign in to access channels</h1>
        <WouterLink href="/auth">
          <Button className="mt-4">Sign In</Button>
        </WouterLink>
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
                  Create a new channel for team communication
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((values) => createChannelMutation.mutate(values))} className="space-y-4">
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
                        <FormLabel>Description</FormLabel>
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
                        <FormLabel>Channel Type</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select channel type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="public">Public</SelectItem>
                            <SelectItem value="private">Private</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Public channels are visible to everyone, while private channels are invitation-only.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={createChannelMutation.isPending}>
                      {createChannelMutation.isPending ? "Creating..." : "Create Channel"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="px-2 py-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search channels"
              className="pl-8"
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          {(() => {
            console.log("Rendering channel section. isLoading:", channelsQuery.isLoading);
            console.log("Current channels state:", channels);
            return null;
          })()}
          {channelsQuery.isLoading ? (
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-2 p-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : channels.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No channels available. Create a new channel to get started.
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {channels.map((channel) => (
                <Button
                  key={channel.id}
                  variant={selectedChannelId === channel.id ? "secondary" : "ghost"}
                  className="w-full justify-start font-normal"
                  onClick={() => setSelectedChannelId(channel.id)}
                >
                  {channel.type === "private" ? (
                    <Shield className="mr-2 h-4 w-4" />
                  ) : (
                    <MessagesSquare className="mr-2 h-4 w-4" />
                  )}
                  <span className="truncate">{channel.name}</span>
                  {channel.unreadCount && channel.unreadCount > 0 ? (
                    <Badge variant="default" className="ml-auto">
                      {channel.unreadCount}
                    </Badge>
                  ) : null}
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
      
      {/* Channel Content */}
      {selectedChannelId ? (
        <div className="flex-1 flex flex-col h-full">
          {/* Channel Header */}
          <header className="flex items-center justify-between px-6 py-3 border-b">
            <div className="flex items-center">
              <h2 className="text-lg font-semibold">
                {channelQuery.data?.type === "private" ? (
                  <Shield className="inline-block mr-2 h-5 w-5" />
                ) : (
                  <MessagesSquare className="inline-block mr-2 h-5 w-5" />
                )}
                {channelQuery.data?.name}
              </h2>
              {channelQuery.data?.description && (
                <span className="ml-4 text-sm text-muted-foreground">
                  {channelQuery.data.description}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSettingsSheetOpen(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="ghost" size="icon">
                <Users className="h-5 w-5" />
              </Button>
            </div>
          </header>
          
          {/* Messages - with fixed height to prevent overflow issues */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar max-h-[calc(100vh-230px)]">
            {messagesQuery.isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-16 w-80" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messagesQuery.isError ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
                <h3 className="text-lg font-medium">Error loading messages</h3>
                <p className="text-muted-foreground mb-4">
                  There was an error loading the messages. Please try again.
                </p>
                <Button onClick={() => messagesQuery.refetch()}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Retry
                </Button>
              </div>
            ) : (!combinedMessages.length) ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessagesSquare className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No messages yet</h3>
                <p className="text-muted-foreground">
                  Be the first to send a message in this channel!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Display all messages using our combined messages array */}
                {combinedMessages.map((message) => (
                  <div 
                    key={message.id} 
                    className={`flex items-start gap-3 group ${message.isOptimistic ? 'opacity-60' : ''}`}
                  >
                    <Avatar>
                      <AvatarFallback>{message.user?.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{message.user?.name || message.user?.username}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.createdAt).toLocaleDateString()} {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {message.isOptimistic && (
                          <span className="text-xs text-muted-foreground italic flex items-center">
                            <span className="animate-pulse mr-1">•</span> sending...
                          </span>
                        )}
                      </div>
                      {/* Display message content based on type */}
                      {message.type === 'image' && message.fileUrl && (
                        <div className="mt-1">
                          <a href={message.fileUrl} target="_blank" rel="noopener noreferrer">
                            <img 
                              src={message.fileUrl} 
                              alt={message.fileName || "Attached image"} 
                              className="max-w-xs max-h-48 rounded-md object-cover" 
                            />
                          </a>
                          {message.content && (
                            <div className="mt-1 text-sm">
                              <FormatMessage content={message.content} />
                            </div>
                          )}
                        </div>
                      )}
                      
                      {message.type === 'file' && message.fileUrl && (
                        <div className="mt-1">
                          <a 
                            href={message.fileUrl} 
                            className="flex items-center gap-2 p-2 bg-muted/50 rounded-md hover:bg-muted w-fit"
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <Paperclip className="h-4 w-4" />
                            <span className="text-sm font-medium">{message.fileName || "Attached file"}</span>
                          </a>
                          {message.content && (
                            <div className="mt-1 text-sm">
                              <FormatMessage content={message.content} />
                            </div>
                          )}
                        </div>
                      )}
                      
                      {(!message.type || message.type === 'text') && (
                        <div className="text-sm">
                          <FormatMessage content={message.content} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {/* Messages are now handled in the combinedMessages logic above */}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          
          {/* Message Input */}
          <div className="p-4 border-t">
            {typingUsers.length > 0 && (
              <div className="text-xs text-muted-foreground mb-1">
                {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="relative">
              {mentionDropdownOpen && (
                <div className="absolute bottom-full mb-1 w-64 bg-popover border rounded-md shadow-md z-50">
                  <div className="p-1 max-h-60 overflow-y-auto">
                    {filteredUsers.map((user, index) => (
                      <div 
                        key={user.id}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer",
                          index === selectedMentionIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                        )}
                        onClick={() => insertMention(user)}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {user.name ? user.name[0]?.toUpperCase() : user.username[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.name || user.username}</span>
                        {user.name && user.username !== user.name && 
                          <span className="text-xs text-muted-foreground">({user.username})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
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
              
              <div className="flex items-start gap-2">
                <div className="relative flex-1">
                  <Textarea 
                    ref={inputRef}
                    placeholder={`Message ${channelQuery.data?.name || 'the channel'}...`}
                    value={messageText}
                    onChange={handleMessageChange}
                    onKeyDown={handleMessageKeyDown}
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
                <Button type="submit" size="icon" disabled={messageText.trim() === '' && !selectedFile}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">
                Type @ to mention someone • Press Enter to send • Shift+Enter for new line • Use toolbar for formatting
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessagesSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No channel selected</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mt-2">
              Select a channel from the sidebar or create a new one to start messaging.
            </p>
          </div>
        </div>
      )}
      
      {/* Channel Settings */}
      <Sheet open={settingsSheetOpen} onOpenChange={setSettingsSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Channel Settings</SheetTitle>
            <SheetDescription>
              Manage channel details and members
            </SheetDescription>
          </SheetHeader>
          <div className="py-4">
            <Tabs defaultValue="general">
              <TabsList className="w-full">
                <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
                <TabsTrigger value="members" className="flex-1">Members</TabsTrigger>
              </TabsList>
              <TabsContent value="general" className="mt-4">
                <Form {...settingsForm}>
                  <form onSubmit={settingsForm.handleSubmit((values) => updateChannelMutation.mutate(values))} className="space-y-4">
                    <FormField
                      control={settingsForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Channel Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={settingsForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={settingsForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Channel Type</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select channel type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="public">Public</SelectItem>
                              <SelectItem value="private">Private</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Public channels are visible to everyone, while private channels are invitation-only.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-between pt-4">
                      <Button 
                        type="button" 
                        variant="destructive"
                        onClick={() => setConfirmDeleteOpen(true)}
                      >
                        Delete Channel
                      </Button>
                      <Button type="submit" disabled={updateChannelMutation.isPending}>
                        {updateChannelMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </TabsContent>
              <TabsContent value="members" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Add Members</h4>
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(value) => {
                          const userId = parseInt(value);
                          if (!isNaN(userId)) {
                            addMemberMutation.mutate(userId);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a user" />
                        </SelectTrigger>
                        <SelectContent>
                          {users?.filter((user: any) => 
                            !membersQuery.data?.some((member: any) => member.userId === user.id)
                          ).map((user: any) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.name || user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="icon"
                        disabled={addMemberMutation.isPending}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Current Members</h4>
                    <div className="border rounded-md">
                      {membersQuery.isLoading ? (
                        <div className="p-2 space-y-2">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <Skeleton className="h-8 w-full" />
                            </div>
                          ))}
                        </div>
                      ) : membersQuery.data?.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No members in this channel
                        </div>
                      ) : (
                        <div className="divide-y">
                          {membersQuery.data?.map((member: any) => (
                            <div key={member.id} className="flex items-center justify-between p-3">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>
                                    {member.user?.username?.[0]?.toUpperCase() || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">
                                    {member.user?.name || member.user?.username}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {member.role === "owner" ? (
                                      <span className="flex items-center">
                                        <Crown className="h-3 w-3 inline mr-1 text-amber-500" />
                                        Owner
                                      </span>
                                    ) : member.role === "admin" ? (
                                      <span className="flex items-center">
                                        <ShieldCheck className="h-3 w-3 inline mr-1 text-primary" />
                                        Admin
                                      </span>
                                    ) : (
                                      <span className="flex items-center">
                                        <User className="h-3 w-3 inline mr-1" />
                                        Member
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Don't allow removing the owner or yourself */}
                              {member.role !== "owner" && member.userId !== user.id && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeMemberMutation.mutate(member.id)}
                                  disabled={removeMemberMutation.isPending}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Confirm Delete Dialog */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the channel
              and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteChannelMutation.mutate()}
              disabled={deleteChannelMutation.isPending}
            >
              {deleteChannelMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}