import { useState, useEffect, useRef, KeyboardEvent, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, Link as WouterLink } from "wouter";
import { 
  Shield, 
  ChevronRight, 
  Plus, 
  Users, 
  MessagesSquare, 
  MessageSquare,
  Settings, 
  Search,
  UserPlus,
  Trash,
  Edit,
  X,
  Crown,
  ShieldCheck,
  User,
  UserMinus,
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
} from "@/components/ui/command";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { channelFormSchema } from "../../../shared/schema";
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

type ChannelFormValues = z.infer<typeof channelFormSchema>;

export default function ChannelsPage() {
  const { user } = useAuth();
  const { sendMessage, status: wsStatus } = useWebSocket();
  const queryClient = useQueryClient();
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [localMessages, setLocalMessages] = useState<any[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Channel creation form
  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "public",
    },
  });
  
  // Channel settings form
  const settingsForm = useForm<ChannelFormValues>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "public",
    },
  });
  
  // State for channel member management
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  
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
  
  // Directly fetch channels data for debugging with offline resilience
  useEffect(() => {
    if (user) {
      // Try to load cached channels first for immediate display
      try {
        const cachedChannels = localStorage.getItem('cached_channels');
        if (cachedChannels) {
          const parsedChannels = JSON.parse(cachedChannels);
          if (Array.isArray(parsedChannels) && parsedChannels.length > 0) {
            console.log("Using cached channels from localStorage:", parsedChannels.length);
            setChannels(parsedChannels);
            if (!selectedChannelId) {
              setSelectedChannelId(parsedChannels[0].id);
              setSelectedChannel(parsedChannels[0]);
            } else {
              // Update selected channel object based on ID
              const channel = parsedChannels.find((c) => c.id === selectedChannelId);
              if (channel) {
                setSelectedChannel(channel);
              }
            }
          }
        }
      } catch (cacheError) {
        console.warn("Error loading cached channels:", cacheError);
      }
      
      // Then fetch from API to get latest data
      fetch('/api/channels')
        .then(res => res.json())
        .then(data => {
          console.log("Direct API call result:", data);
          if (Array.isArray(data) && data.length > 0) {
            console.log("Setting channels directly:", data.length);
            setChannels(data);
            
            // Cache the channels for offline usage
            try {
              localStorage.setItem('cached_channels', JSON.stringify(data));
            } catch (err) {
              console.warn("Failed to cache channels:", err);
            }
            
            if (!selectedChannelId) {
              setSelectedChannelId(data[0].id);
              // Also set the selected channel object
              setSelectedChannel(data[0]);
            } else {
              // Update selected channel object based on ID
              const channel = data.find((c) => c.id === selectedChannelId);
              if (channel) {
                setSelectedChannel(channel);
              }
            }
          }
        })
        .catch(err => {
          console.error("Error fetching channels:", err);
          // No further action needed here as we already loaded from cache
        });
    }
  }, [user, selectedChannelId]);
  
  // Query for channels
  const channelsQuery = useQuery({
    queryKey: ["/api/channels"],
    enabled: !!user,
  });
  
  // Update channels when query data changes
  useEffect(() => {
    if (channelsQuery.data && Array.isArray(channelsQuery.data)) {
      console.log("Channel data received from query:", channelsQuery.data);
      setChannels(channelsQuery.data);
      if (channelsQuery.data.length > 0 && !selectedChannelId) {
        console.log("Setting channels from query:", channelsQuery.data.length);
        setSelectedChannelId(channelsQuery.data[0].id);
        setSelectedChannel(channelsQuery.data[0]);
      }
    }
  }, [channelsQuery.data, selectedChannelId]);
  
  // Query for messages with offline resilience
  const messagesQuery = useQuery({
    queryKey: [`/api/channels/${selectedChannelId}/messages`],
    enabled: !!selectedChannelId && !!user,
    // Add this to handle errors and fallback to cache
    onError: (error) => {
      console.error("Error fetching messages:", error);
      
      // Try to load from cache on error
      if (selectedChannelId) {
        try {
          const cachedData = localStorage.getItem(`channel_${selectedChannelId}_messages`);
          if (cachedData) {
            let parsedMessages;
            try {
              // Try to parse as the new format first
              const cacheItem = JSON.parse(cachedData);
              parsedMessages = cacheItem.messages;
            } catch {
              // Fall back to old format if new format parsing fails
              parsedMessages = JSON.parse(cachedData);
            }
            
            if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
              console.log(`Using ${parsedMessages.length} cached messages for channel ${selectedChannelId} due to API error`);
              queryClient.setQueryData([`/api/channels/${selectedChannelId}/messages`], parsedMessages);
            }
          }
        } catch (cacheError) {
          console.error("Error reading from cache:", cacheError);
        }
      }
    }
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
  
  // Handle editing channel messages with enhanced offline-first approach
  const handleEditMessage = async (messageId: number, newContent: string) => {
    if (!newContent.trim() || !selectedChannelId || !messageId) return;
    
    // Get the existing message
    const messageToEdit = combinedMessages.find(msg => msg.id === messageId);
    if (!messageToEdit) return;
    
    console.log("Editing message with enhanced offline resilience:", messageId);
    
    // Timestamp for both optimistic updates and offline storage
    const editTimestamp = new Date().toISOString();
    
    // Store edit in localStorage for offline resilience
    try {
      const pendingEditsKey = `pending_edits_channel_${selectedChannelId}`;
      const existingEditsStr = localStorage.getItem(pendingEditsKey) || '[]';
      const existingEdits = JSON.parse(existingEditsStr);
      
      // Add this edit to pending edits, replacing any previous edit for the same message
      const newPendingEdits = existingEdits.filter((edit: any) => edit.messageId !== messageId);
      newPendingEdits.push({
        messageId,
        channelId: selectedChannelId,
        content: newContent,
        originalContent: messageToEdit.content,
        updatedAt: editTimestamp,
        timestamp: editTimestamp,
      });
      
      localStorage.setItem(pendingEditsKey, JSON.stringify(newPendingEdits));
      console.log(`Stored edit in offline cache (${newPendingEdits.length} pending edits)`);
    } catch (err) {
      console.error("Failed to store edit in localStorage:", err);
    }
    
    // Optimistically update the UI with explicit edited flag
    const updatedMessages = messages.map(msg => 
      msg.id === messageId 
        ? { 
            ...msg, 
            content: newContent, 
            updatedAt: editTimestamp, 
            isEdited: true // Explicitly mark as edited for UI indicator
          }
        : msg
    );
    setMessages(updatedMessages);
    
    // Update in the tanstack query cache as well
    queryClient.setQueryData(
      [`/api/channels/${selectedChannelId}/messages`],
      (oldData: any[] = []) => {
        if (!oldData || !Array.isArray(oldData)) return updatedMessages;
        return oldData.map(msg => 
          msg.id === messageId 
            ? { 
                ...msg, 
                content: newContent, 
                updatedAt: new Date().toISOString(), 
                isEdited: true 
              }
            : msg
        );
      }
    );
    
    // Store edit in localStorage for offline resilience
    try {
      // Keep track of pending edits
      const pendingEdits = JSON.parse(localStorage.getItem('pendingChannelMessageEdits') || '[]');
      const editIndex = pendingEdits.findIndex((edit: any) => edit.messageId === messageId);
      
      const editData = {
        messageId,
        channelId: selectedChannelId,
        content: newContent,
        timestamp: new Date().toISOString()
      };
      
      if (editIndex >= 0) {
        pendingEdits[editIndex] = editData;
      } else {
        pendingEdits.push(editData);
      }
      
      localStorage.setItem('pendingChannelMessageEdits', JSON.stringify(pendingEdits));
    } catch (err) {
      console.error('Failed to save message edit to localStorage', err);
    }
    
    // Attempt to send via WebSocket first
    try {
      sendMessage({
        type: 'edit_channel_message',
        messageId,
        channelId: selectedChannelId,
        content: newContent
      });
      
      console.log('Edit message request sent via WebSocket');
      return true;
    } catch (error) {
      console.error('Failed to send message edit via WebSocket:', error);
      
      // Websocket attempt failed, let's try direct API call
      try {
        const response = await fetch(`/api/channels/${selectedChannelId}/messages/${messageId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content: newContent })
        });
        
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        
        // On success, remove from pending edits
        const pendingEdits = JSON.parse(localStorage.getItem('pendingChannelMessageEdits') || '[]');
        const updatedPendingEdits = pendingEdits.filter((edit: any) => edit.messageId !== messageId);
        localStorage.setItem('pendingChannelMessageEdits', JSON.stringify(updatedPendingEdits));
        
        // Refresh the messages after successful edit
        if (messagesQuery.refetch) {
          messagesQuery.refetch();
        }
        
        console.log('Successfully edited message:', messageId);
        return true;
      } catch (apiError) {
        console.error('Failed to save message edit via API:', apiError);
        
        // Set up background sync retry
        setTimeout(() => {
          const pendingEdits = JSON.parse(localStorage.getItem('pendingChannelMessageEdits') || '[]');
          const pendingEdit = pendingEdits.find((edit: any) => edit.messageId === messageId);
          
          if (pendingEdit) {
            console.log('Retrying message edit in background:', messageId);
            // Try again silently in the background
            handleEditMessage(messageId, newContent);
          }
        }, 30000); // Retry after 30 seconds
        
        return false;
      }
    }
  };

  // Combine server messages with optimistic ones
  const combinedMessages = useMemo(() => {
    const serverMessages = Array.isArray(messagesQuery.data) ? messagesQuery.data : [];
    
    // Create a map of content-userId pairs from server messages to avoid duplicates
    const serverMessageMap = new Map();
    serverMessages.forEach(msg => {
      const key = `${msg.content}-${msg.userId}`;
      serverMessageMap.set(key, true);
    });
    
    // Only include optimistic messages that haven't been confirmed yet by comparing content and userId
    const pendingMessages = messages.filter(msg => {
      if (!msg.isOptimistic) return false;
      const key = `${msg.content}-${msg.userId}`;
      return !serverMessageMap.has(key);
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
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create channel");
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
      const errorMessage = error.message === "A channel with this name already exists" 
        ? "Cannot create duplicate channel name" 
        : error.message;
      
      toast({
        title: "Failed to create channel",
        description: errorMessage,
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
        description: "Channel settings have been updated",
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
  
  // Listen for real-time channel messages
  useEffect(() => {
    const handleChannelMessage = (event: CustomEvent) => {
      console.log('*** CHANNELS PAGE: Received channel message event ***');
      const { detail } = event;
      
      if (detail && detail.message && detail.message.channelId === selectedChannelId) {
        console.log('Processing channel message for current channel:', detail.message);
        
        // Add message to local state immediately for real-time updates
        setMessages(prevMessages => {
          const messageExists = prevMessages.some(msg => msg.id === detail.message.id);
          if (!messageExists) {
            return [...prevMessages, detail.message].sort((a, b) => 
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          }
          return prevMessages;
        });
        
        // Also invalidate queries to keep cache in sync
        queryClient.invalidateQueries({ queryKey: [`/api/channels/${detail.message.channelId}/messages`] });
      }
    };
    
    // Add event listener for channel messages
    window.addEventListener('channel-message-received', handleChannelMessage as EventListener);
    
    // Cleanup on unmount
    return () => {
      window.removeEventListener('channel-message-received', handleChannelMessage as EventListener);
    };
  }, [selectedChannelId, queryClient]);

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
  
  // Effect to periodically try to sync pending message edits with the server
  useEffect(() => {
    if (!selectedChannelId || !user || wsStatus !== 'connected') return;
    
    // Attempt to sync pending edits with the server
    const syncPendingEdits = async () => {
      try {
        const pendingEditsKey = `pending_edits_channel_${selectedChannelId}`;
        const pendingEditsStr = localStorage.getItem(pendingEditsKey);
        
        if (!pendingEditsStr) return;
        
        const pendingEdits = JSON.parse(pendingEditsStr);
        if (!Array.isArray(pendingEdits) || pendingEdits.length === 0) return;
        
        console.log(`Attempting to sync ${pendingEdits.length} pending edits for channel ${selectedChannelId}`);
        
        // Try to send each edit to the server
        const successfulEdits = [];
        
        for (const edit of pendingEdits) {
          try {
            // Try to send via WebSocket first
            sendMessage({
              type: 'edit_channel_message',
              messageId: edit.messageId,
              channelId: selectedChannelId,
              content: edit.content
            });
            
            // Mark as successfully sent
            successfulEdits.push(edit.messageId);
            console.log(`Successfully synced edit for message ${edit.messageId}`);
          } catch (editError) {
            console.error(`Failed to sync edit for message ${edit.messageId}:`, editError);
          }
        }
        
        // Remove successful edits from pending list
        if (successfulEdits.length > 0) {
          const remainingEdits = pendingEdits.filter((edit: any) => 
            !successfulEdits.includes(edit.messageId)
          );
          
          localStorage.setItem(pendingEditsKey, JSON.stringify(remainingEdits));
          console.log(`Removed ${successfulEdits.length} successfully synced edits, ${remainingEdits.length} remaining`);
        }
      } catch (error) {
        console.error("Error syncing pending edits:", error);
      }
    };
    
    // Run immediately and then every 30 seconds
    syncPendingEdits();
    const interval = setInterval(syncPendingEdits, 30000);
    
    return () => clearInterval(interval);
  }, [selectedChannelId, user, wsStatus, sendMessage]);
  
  // Handle @ mentions
  useEffect(() => {
    if (messageText.includes('@') && users) {
      const lastAtIndex = messageText.lastIndexOf('@');
      const isAtEndOfWord = lastAtIndex === messageText.length - 1 || 
                           messageText.charAt(lastAtIndex + 1) === ' ';
      
      // Only process if the @ is at cursor position or earlier
      if (lastAtIndex <= cursorPosition) {
        if (isAtEndOfWord) {
          // @ just typed, show all users
          setMentionQuery("");
          setMentionDropdownOpen(true);
          setFilteredUsers(users);
        } else {
          // Get what's after the @ symbol and before the next space
          const textAfterAt = messageText.substring(lastAtIndex + 1, cursorPosition);
          const mentionQuery = textAfterAt.split(' ')[0];
          
          if (mentionQuery && mentionQuery.length > 0) {
            setMentionQuery(mentionQuery);
            setMentionDropdownOpen(true);
            
            // Filter users based on query (allowing for case-insensitive partial matches)
            const filtered = users.filter(user => 
              user.name?.toLowerCase().includes(mentionQuery.toLowerCase()) || 
              user.username.toLowerCase().includes(mentionQuery.toLowerCase())
            );
            
            setFilteredUsers(filtered);
            setSelectedMentionIndex(0);
          } else {
            setMentionDropdownOpen(false);
          }
        }
      }
    } else {
      setMentionDropdownOpen(false);
    }
  }, [messageText, cursorPosition, users]);
  
  // Add members to channel
  const addMembersToChannel = async (userIds: number[]) => {
    if (!selectedChannelId || userIds.length === 0) return;
    
    try {
      const response = await fetch(`/api/channels/${selectedChannelId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add members to channel');
      }
      
      // Success handling
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannelId}/members`] });
      setSelectedUserIds([]);
      toast({
        title: "Members added",
        description: "New members have been added to the channel"
      });
    } catch (error: any) {
      toast({
        title: "Failed to add members",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };
  
  // Remove member from channel
  const removeMemberFromChannel = async (memberId: number) => {
    if (!selectedChannelId) return;
    
    try {
      const response = await fetch(`/api/channels/${selectedChannelId}/members/${memberId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove member from channel');
      }
      
      // Success handling
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannelId}/members`] });
      toast({
        title: "Member removed",
        description: "Member has been removed from the channel"
      });
    } catch (error: any) {
      toast({
        title: "Failed to remove member",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };
  
  // Handle message input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Track cursor position for mention handling
    setCursorPosition(e.target.selectionStart || 0);
    
    // Set typing indicator
    if (!isTyping && value.trim() !== '') {
      setIsTyping(true);
    } else if (value.trim() === '') {
      setIsTyping(false);
    }
    
    setMessageText(value);
  };
  
  // Handle keyboard events in the input
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Handle escape key to close dropdown
    if (e.key === 'Escape') {
      setMentionQuery("");
      setMentionDropdownOpen(false);
      setSelectedMentionIndex(0);
    }
    
    // Submit form on Enter (if not shift+enter for newlines)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setMentionDropdownOpen(false);
      handleSubmit(e as any);
    }
    
    // Handle arrow keys for mention selection
    if (mentionDropdownOpen && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < filteredUsers.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev > 0 ? prev - 1 : filteredUsers.length - 1
        );
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        if (mentionDropdownOpen) {
          e.preventDefault();
          const selectedUser = filteredUsers[selectedMentionIndex];
          handleMentionSelect(selectedUser);
        }
      }
    }
  };
  
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
      
      // Determine message type based on file type (if any)
      const messageType = selectedFile 
        ? (selectedFile.type.startsWith('image/') ? 'image' : 'file')
        : 'text';
      
      // Create temporary file URL for preview (for files only)
      const tempFileUrl = selectedFile ? URL.createObjectURL(selectedFile) : null;
      
      const optimisticMessage = {
        id: tempId, // Temporary ID that will be replaced when the real message arrives
        channelId: selectedChannelId,
        userId: user.id,
        content: messageText,
        createdAt: new Date().toISOString(),
        mentions: mentionedUserIds.length > 0 ? JSON.stringify(mentionedUserIds) : null,
        user: user, // Add the current user object
        type: messageType,
        fileUrl: tempFileUrl,
        fileName: selectedFile?.name,
        isOptimistic: true // Flag to identify this as an optimistic update
      };
      
      // Optimistically update the UI immediately
      setMessages(prevMessages => [...prevMessages, optimisticMessage]);
      
      // Store message in localStorage for offline resilience
      try {
        // Get existing pending messages or initialize empty array
        const storageKey = `pendingChannelMessages_${selectedChannelId}`;
        const pendingMessagesJson = localStorage.getItem(storageKey);
        const pendingMessages = pendingMessagesJson ? JSON.parse(pendingMessagesJson) : [];
        
        // Add this message to pending list
        pendingMessages.push({
          ...optimisticMessage,
          timestamp: Date.now(),
          retryCount: 0,
          // Don't store the file URL as it's not serializable
          fileUrl: null
        });
        
        // Save back to localStorage
        localStorage.setItem(storageKey, JSON.stringify(pendingMessages));
        console.log("Message saved to localStorage for offline resilience");
      } catch (error) {
        console.error("Error saving message to localStorage:", error);
      }
      
      // Auto-cleanup for stuck messages after timeout (10 seconds)
      setTimeout(() => {
        console.log(`Message timeout check for: ${tempId}`);
        setMessages(prev => {
          const stillExists = prev.some(msg => msg.id === tempId);
          if (stillExists) {
            console.log(`Message still pending after timeout, but keeping for offline sync`);
            // Update the message to show offline state instead of removing it
            return prev.map(msg => 
              msg.id === tempId 
                ? { ...msg, offlineMode: true, retrying: false } 
                : msg
            );
          }
          return prev;
        });
        
        // Cleanup object URL if one was created
        if (tempFileUrl) {
          URL.revokeObjectURL(tempFileUrl);
        }
      }, 10000); // 10-second timeout for message delivery
      
      // If there's a file to upload, use FormData and a direct fetch call
      if (selectedFile) {
        console.log("Uploading file:", selectedFile.name);
        
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('channelId', selectedChannelId.toString());
        formData.append('content', messageText);
        
        if (mentionedUserIds.length > 0) {
          formData.append('mentions', JSON.stringify(mentionedUserIds));
        }
        
        // Send file using fetch
        fetch('/api/channels/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log("File uploaded successfully:", data);
          
          // Remove the optimistic message
          setMessages(prevMessages => 
            prevMessages.filter(msg => msg.id !== tempId)
          );
          
          // Clean up the object URL if one was created
          if (tempFileUrl) {
            URL.revokeObjectURL(tempFileUrl);
          }
          
          // Reset file state
          setSelectedFile(null);
          setUploadProgress(0);
          
          // Refresh messages to get the server-created message with file
          messagesQuery.refetch();
        })
        .catch(error => {
          console.error("Error uploading file:", error);
          
          // Remove the optimistic message
          setMessages(prevMessages => 
            prevMessages.filter(msg => msg.id !== tempId)
          );
          
          // Clean up the object URL if one was created
          if (tempFileUrl) {
            URL.revokeObjectURL(tempFileUrl);
          }
          
          // Reset file state
          setSelectedFile(null);
          setUploadProgress(0);
          
          // Show error message
          toast({
            title: "Error uploading file",
            description: error.message || "Your file couldn't be uploaded. Please try again.",
            variant: "destructive"
          });
        });
      } 
      // For text-only messages, use WebSocket (with API fallback)
      else {
        // Try both WebSocket and direct API call for better reliability
        console.log("Attempting to send channel message via both WebSocket and API");
        
        // Send via WebSocket for real-time messaging
        sendMessage({
          type: "channel_message", 
          channelId: selectedChannelId,
          content: messageText,
          mentions: mentionedUserIds,
          tempId: tempId // Include the tempId to link back to our optimistic message
        });
        
        // Always use direct API call for reliability regardless of WebSocket status
        console.log("Sending direct API message to ensure delivery");
        
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
          
          // If there's an error, update the optimistic message with error state
          setMessages(prevMessages => 
            prevMessages.map(msg => 
              msg.id === optimisticMessage.id 
                ? { ...msg, error: true, errorMessage: error.message } 
                : msg
            )
          );
          
          // Show an error toast
          toast({
            title: "Message saved offline",
            description: "Network issue detected. Your message will be sent when connection is restored.",
            variant: "default"
          });
        });
      }
      
      // Clear input after sending
      setMessageText("");
      setSelectedFile(null);
      setMentionDropdownOpen(false);
      
      // Clear mention state
      setMentionQuery("");
      setFilteredUsers([]);
      setSelectedMentionIndex(0);
    }
  };
  
  // Handle selecting a user from mention dropdown
  const handleMentionSelect = (user: any) => {
    // Replace the mention in the text with user info
    const lastAtIndex = messageText.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      // Get name for mention (with underscores instead of spaces)
      const mentionName = user.name ? user.name.replace(/\s+/g, '_') : user.username;
      
      // Replace the partial mention with the full one
      const textBefore = messageText.substring(0, lastAtIndex);
      const textAfter = messageText.substring(cursorPosition);
      const newText = `${textBefore}@${mentionName} ${textAfter}`;
      
      setMessageText(newText);
      
      // Set the cursor after the mention
      const newCursorPos = lastAtIndex + mentionName.length + 2; // +2 for @ and space
      
      // Need to wait for input to update before setting cursor position
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          setCursorPosition(newCursorPos);
        }
      }, 0);
    }
    
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                          Public channels can be joined by anyone, private channels require an invitation
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={createChannelMutation.isPending}>
                      {createChannelMutation.isPending ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Channel"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="relative px-2 pt-2">
          <div className="flex items-center gap-2 border rounded-md px-3 py-2 mb-2">
            <Search className="h-4 w-4 opacity-50" />
            <input 
              type="text" 
              placeholder="Search channels" 
              className="bg-transparent border-none outline-none w-full placeholder:text-muted-foreground text-sm"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {channelsQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 p-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ))
            ) : (
              channels.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p>No channels found.</p>
                  <p className="text-sm">Create a new channel to get started.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="px-2 text-xs font-medium text-muted-foreground pb-1">PUBLIC CHANNELS</p>
                  {channels
                    .filter(channel => channel.type === "public")
                    .map(channel => {
                      const isSelected = selectedChannelId === channel.id;
                      const hasUnread = channel.unreadCount && channel.unreadCount > 0;
                      
                      return (
                        <button
                          key={channel.id}
                          onClick={() => setSelectedChannelId(channel.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm",
                            isSelected ? "bg-secondary font-medium" : "hover:bg-secondary/50 text-muted-foreground",
                            hasUnread && !isSelected && "font-medium text-foreground"
                          )}
                        >
                          <MessagesSquare className="h-4 w-4" />
                          <span className="truncate flex-1 text-left">{channel.name}</span>
                          {hasUnread && !isSelected && (
                            <Badge variant="default" className="text-[10px] px-1 h-5 min-w-5">
                              {channel.unreadCount > 99 ? "99+" : channel.unreadCount}
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                </div>
              )
            )}
            
            {/* Private Channels */}
            {channels.filter(channel => channel.type === "private").length > 0 && (
              <div className="pt-4 space-y-1">
                <p className="px-2 text-xs font-medium text-muted-foreground pb-1">PRIVATE CHANNELS</p>
                {channels
                  .filter(channel => channel.type === "private")
                  .map(channel => {
                    const isSelected = selectedChannelId === channel.id;
                    const hasUnread = channel.unreadCount && channel.unreadCount > 0;
                    
                    return (
                      <button
                        key={channel.id}
                        onClick={() => setSelectedChannelId(channel.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm",
                          isSelected ? "bg-secondary font-medium" : "hover:bg-secondary/50 text-muted-foreground",
                          hasUnread && !isSelected && "font-medium text-foreground"
                        )}
                      >
                        <Shield className="h-4 w-4" />
                        <span className="truncate flex-1 text-left">{channel.name}</span>
                        {hasUnread && !isSelected && (
                          <Badge variant="default" className="text-[10px] px-1 h-5 min-w-5">
                            {channel.unreadCount > 99 ? "99+" : channel.unreadCount}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedChannelId ? (
          <>
            {/* Channel Header */}
            <div className="border-b p-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-semibold">
                  {selectedChannel?.type === 'private' ? <Shield className="h-5 w-5 inline mr-1" /> : <MessagesSquare className="h-5 w-5 inline mr-1" />}
                  {selectedChannel?.name}
                </h2>
                {selectedChannel?.description && (
                  <p className="text-sm text-muted-foreground hidden md:block">
                    {selectedChannel.description}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    // Fetch members and available users when opening dialog
                    setShowMembersDialog(true);
                    
                    // Get all users (for adding new members)
                    if (users) {
                      const currentMembers = Array.isArray(membersQuery.data) 
                        ? membersQuery.data.map(m => m.userId) 
                        : [];
                      
                      // Filter out users who are already members
                      const availableForAdding = users.filter(u => !currentMembers.includes(u.id));
                      setAvailableUsers(availableForAdding);
                    }
                  }}
                >
                  <Users className="h-5 w-5" />
                </Button>
                <Sheet open={settingsSheetOpen} onOpenChange={setSettingsSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Settings className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-[400px] sm:w-[540px]">
                    <SheetHeader>
                      <SheetTitle>Channel Settings</SheetTitle>
                      <SheetDescription>
                        Manage channel settings and permissions
                      </SheetDescription>
                    </SheetHeader>
                    <div className="py-6">
                      <Tabs defaultValue="settings">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="settings">Settings</TabsTrigger>
                          <TabsTrigger value="members">Members</TabsTrigger>
                        </TabsList>
                        <TabsContent value="settings" className="space-y-4 mt-4">
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
                                      <Input {...field} value={field.value || ''} />
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
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                      Public channels can be joined by anyone, private channels require an invitation
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <div className="flex justify-between pt-4">
                                <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                                  <DialogTrigger asChild>
                                    <Button variant="destructive" type="button">Delete Channel</Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Are you sure?</DialogTitle>
                                      <DialogDescription>
                                        This action cannot be undone. All messages and files in this channel will be permanently deleted.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                      <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
                                      <Button 
                                        variant="destructive" 
                                        onClick={() => deleteChannelMutation.mutate()}
                                        disabled={deleteChannelMutation.isPending}
                                      >
                                        {deleteChannelMutation.isPending ? "Deleting..." : "Delete Channel"}
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                                <Button 
                                  type="submit" 
                                  disabled={updateChannelMutation.isPending}
                                >
                                  {updateChannelMutation.isPending ? "Saving..." : "Save Changes"}
                                </Button>
                              </div>
                            </form>
                          </Form>
                        </TabsContent>
                        <TabsContent value="members" className="mt-4">
                          <div className="space-y-4">
                            <div>
                              <h3 className="font-medium mb-2">Current Members</h3>
                              {membersQuery.isLoading ? (
                                <div className="space-y-2">
                                  {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                      <Skeleton className="h-8 w-8 rounded-full" />
                                      <div className="space-y-1">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-3 w-16" />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : membersQuery.data && membersQuery.data.length > 0 ? (
                                <div className="space-y-2">
                                  {membersQuery.data.map(member => (
                                    <div key={member.id} className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8">
                                          <AvatarImage src={member.user?.avatar || undefined} />
                                          <AvatarFallback>{member.user?.name?.[0] || member.user?.username?.[0] || '?'}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                          <p className="text-sm font-medium">{member.user?.name || member.user?.username}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {member.role === 'owner' ? (
                                              <span className="flex items-center">
                                                <Crown className="h-3 w-3 mr-1 text-yellow-500" />
                                                Owner
                                              </span>
                                            ) : member.role === 'admin' ? (
                                              <span className="flex items-center">
                                                <ShieldCheck className="h-3 w-3 mr-1 text-blue-500" />
                                                Admin
                                              </span>
                                            ) : (
                                              <span>Member</span>
                                            )}
                                          </p>
                                        </div>
                                      </div>
                                      {/* Only show remove button for non-owners */}
                                      {member.role !== 'owner' && (
                                        <Button 
                                          variant="ghost" 
                                          size="icon"
                                          onClick={() => removeMemberFromChannel(member.userId)}
                                        >
                                          <UserMinus className="h-4 w-4 text-destructive" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-4 text-muted-foreground">
                                  No members found
                                </div>
                              )}
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
            
            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              {messagesQuery.isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : combinedMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="h-12 w-12 text-primary/20 mb-4" />
                  <h3 className="text-lg font-medium">No messages yet</h3>
                  <p className="text-muted-foreground">Start the conversation by sending a message below</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {combinedMessages.map(message => {
                    const isOptimistic = message.isOptimistic;
                    const isOffline = message.offlineMode;
                    const hasError = message.error;
                    
                    return (
                      <div key={message.id} className="flex gap-3 group">
                        <Avatar className="h-10 w-10 rounded-full">
                          <AvatarImage src={message.user?.avatar || undefined} alt={message.user?.name || message.user?.username} />
                          <AvatarFallback>{message.user?.name?.[0] || message.user?.username?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="space-y-1 flex-1 overflow-hidden">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{message.user?.name || message.user?.username}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(message.createdAt).toLocaleTimeString(undefined, {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                              {(message.updatedAt && message.updatedAt !== message.createdAt) || message.isEdited ? (
                                <> · <span className="italic">Edited</span></>
                              ) : null}
                            </span>
                            {isOptimistic && !isOffline && (
                              <span className="text-xs text-muted-foreground animate-pulse">
                                Sending...
                              </span>
                            )}
                            {isOffline && (
                              <span className="text-xs text-warning flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Saved offline
                              </span>
                            )}
                            {hasError && (
                              <span className="text-xs text-destructive flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Failed to send
                              </span>
                            )}
                          </div>
                          <div className="text-sm">
                            {message.type === 'text' && (
                              <div data-message-id={message.id} className="message-content">
                                <FormatMessage 
                                  content={message.content} 
                                  messageId={message.id}
                                  userId={message.userId}
                                  currentUserId={user?.id}
                                  createdAt={message.createdAt}
                                  updatedAt={message.updatedAt}
                                  isEdited={message.isEdited}
                                  onEditMessage={(messageId, newContent) => handleEditMessage(messageId, newContent)}
                                />
                              </div>
                            )}
                            {message.type === 'file' && (
                              <div>
                                <a 
                                  href={message.fileUrl || message.fileUrl} 
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-3 border rounded-md hover:bg-secondary/30 transition-colors w-fit"
                                >
                                  <FileUp className="h-4 w-4" />
                                  <span className="font-medium">{message.fileName || "File"}</span>
                                </a>
                                {message.content && (
                                  <p className="mt-2 message-content" data-message-id={message.id}>
                                    <FormatMessage 
                                      content={message.content}
                                      messageId={message.id}
                                      userId={message.userId}
                                      currentUserId={user?.id}
                                      createdAt={message.createdAt}
                                      onEditMessage={(messageId, newContent) => handleEditMessage(messageId, newContent)} 
                                    />
                                  </p>
                                )}
                              </div>
                            )}
                            {message.type === 'image' && (
                              <div>
                                <a 
                                  href={message.fileUrl} 
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block w-fit"
                                >
                                  {isOptimistic ? (
                                    <div className="relative">
                                      <img 
                                        src={message.fileUrl}
                                        alt="Uploading"
                                        className="max-w-full h-auto max-h-96 rounded-md"
                                      />
                                      <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                                        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                                      </div>
                                    </div>
                                  ) : (
                                    <img 
                                      src={message.fileUrl}
                                      alt="Uploaded image"
                                      className="max-w-full h-auto max-h-96 rounded-md"
                                    />
                                  )}
                                </a>
                                {message.content && (
                                  <p className="mt-2 message-content" data-message-id={message.id}>
                                    <FormatMessage 
                                      content={message.content}
                                      messageId={message.id}
                                      userId={message.userId}
                                      currentUserId={user?.id}
                                      createdAt={message.createdAt} 
                                      onEditMessage={(messageId, newContent) => handleEditMessage(messageId, newContent)}
                                    />
                                  </p>
                                )}
                              </div>
                            )}
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
            <div className="border-t p-4">
              <div className="relative">
                {showFormatToolbar && (
                  <FormattingToolbar 
                    onFormat={(tag) => {
                      // Add formatting tag at cursor position
                      const newText = messageText.substring(0, cursorPosition) + 
                                     tag + 
                                     messageText.substring(cursorPosition);
                      setMessageText(newText);
                      
                      // Move cursor to between tags if needed
                      if (['**', '__', '~~', '`', '```'].includes(tag)) {
                        setTimeout(() => {
                          if (inputRef.current) {
                            const newPos = cursorPosition + tag.length / 2;
                            inputRef.current.focus();
                            inputRef.current.setSelectionRange(newPos, newPos);
                            setCursorPosition(newPos);
                          }
                        }, 0);
                      } else {
                        setCursorPosition(cursorPosition + tag.length);
                      }
                    }}
                    onClose={() => setShowFormatToolbar(false)}
                  />
                )}
                
                {/* Mention dropdown */}
                {mentionDropdownOpen && filteredUsers && filteredUsers.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 bg-popover border rounded-md shadow-md w-64 max-h-48 overflow-y-auto z-50">
                    <Command>
                      <CommandInput placeholder="Search users..." autoFocus={false} disabled />
                      <CommandGroup>
                        {filteredUsers.map((user, index) => (
                          <CommandItem
                            key={user.id}
                            onSelect={() => handleMentionSelect(user)}
                            className={cn(
                              index === selectedMentionIndex && "bg-accent"
                            )}
                          >
                            <Avatar className="h-6 w-6 mr-2">
                              <AvatarImage src={user.avatar || undefined} />
                              <AvatarFallback>{user.name?.[0] || user.username[0]}</AvatarFallback>
                            </Avatar>
                            <span>{user.name || user.username}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
                  {/* Formatting Toolbar Toggle */}
                  <div className="flex items-center mb-1">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowFormatToolbar(!showFormatToolbar)}
                      className="h-8 gap-1.5 w-fit text-xs font-normal"
                    >
                      <Bold className="h-3.5 w-3.5" />
                      <Italic className="h-3.5 w-3.5" />
                      <Underline className="h-3.5 w-3.5" />
                      Format
                    </Button>
                  </div>
                  
                  {/* File Upload Preview */}
                  {selectedFile && (
                    <FileUploadPreview
                      file={selectedFile}
                      onRemove={() => setSelectedFile(null)}
                      progress={uploadProgress}
                    />
                  )}
                  
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <Input
                        ref={inputRef}
                        value={messageText}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onClick={() => setCursorPosition(inputRef.current?.selectionStart || 0)}
                        placeholder={`Message ${selectedChannel?.name || 'channel'}`}
                        className="pr-20"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex space-x-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.click();
                            }
                          }}
                        >
                          <Paperclip className="h-4 w-4" />
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setSelectedFile(file);
                                if (fileInputRef.current) {
                                  fileInputRef.current.value = '';
                                }
                              }
                            }}
                          />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.accept = "image/*";
                              fileInputRef.current.click();
                            }
                          }}
                        >
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button type="submit" size="icon" disabled={isUploading}>
                      {isUploading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Select a channel</h2>
              <p className="text-muted-foreground">Choose a channel from the sidebar or create a new one</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Channel Members Management Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Channel Members</DialogTitle>
            <DialogDescription>
              Add or remove members from this channel.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="mb-4">
              <Label htmlFor="add-members">Add Members</Label>
              <div className="flex items-center space-x-2 mt-1.5">
                <Select
                  onValueChange={(value) => {
                    const userId = parseInt(value);
                    if (!selectedUserIds.includes(userId)) {
                      setSelectedUserIds([...selectedUserIds, userId]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select users to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.length === 0 ? (
                      <SelectItem value="no-users" disabled>No users available</SelectItem>
                    ) : (
                      availableUsers.map(user => (
                        <SelectItem 
                          key={user.id} 
                          value={user.id.toString()}
                          disabled={selectedUserIds.some(id => id === user.id)}
                        >
                          {user.name || user.username}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={() => addMembersToChannel(selectedUserIds)}
                  disabled={selectedUserIds.length === 0}
                >
                  Add
                </Button>
              </div>
              
              {/* Selected users list */}
              {selectedUserIds.length > 0 && (
                <div className="mt-3 space-y-2">
                  <Label>Selected users:</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedUserIds.map(userId => {
                      const user = availableUsers.find(u => u.id === userId);
                      return (
                        <Badge key={userId} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1">
                          {user?.name || user?.username || `User ${userId}`}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 rounded-full"
                            onClick={() => setSelectedUserIds(selectedUserIds.filter(id => id !== userId))}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Current Members</h3>
              {membersQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : membersQuery.data && membersQuery.data.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {membersQuery.data.map(member => (
                    <div key={member.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.user?.avatar || undefined} />
                          <AvatarFallback>{member.user?.name?.[0] || member.user?.username?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{member.user?.name || member.user?.username}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.role === 'owner' ? (
                              <span className="flex items-center">
                                <Crown className="h-3 w-3 mr-1 text-yellow-500" />
                                Owner
                              </span>
                            ) : member.role === 'admin' ? (
                              <span className="flex items-center">
                                <ShieldCheck className="h-3 w-3 mr-1 text-blue-500" />
                                Admin
                              </span>
                            ) : (
                              <span>Member</span>
                            )}
                          </p>
                        </div>
                      </div>
                      {/* Only show remove button for non-owners */}
                      {member.role !== 'owner' && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeMemberFromChannel(member.userId)}
                        >
                          <UserMinus className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No members found
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMembersDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

