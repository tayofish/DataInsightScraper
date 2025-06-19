import React, { useMemo, useState } from 'react';
import { Pencil, Check, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FormattingToolbar } from './formatting-toolbar';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface FormatMessageProps {
  content: string;
  fileUrl?: string;
  fileName?: string;
  type?: string;
  messageId?: number;
  userId?: number;
  currentUserId?: number;
  createdAt?: Date | string;
  isEdited?: boolean;
  updatedAt?: Date | string;
  onEditMessage?: (messageId: number, content: string) => void;
  channelId?: number; // For channel messages
  isDirectMessage?: boolean; // To distinguish between direct and channel messages
}

export const FormatMessage: React.FC<FormatMessageProps> = ({ 
  content, 
  fileUrl, 
  fileName, 
  type,
  messageId,
  userId,
  currentUserId,
  createdAt,
  isEdited,
  updatedAt,
  onEditMessage,
  channelId,
  isDirectMessage = false
}) => {
  // Log message edit status for debugging
  console.log(`Message ${messageId} isEdited:`, isEdited, "updatedAt:", updatedAt);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [showToolbar, setShowToolbar] = useState(false);
  
  // Check if current user is the message author and message is editable
  const canEdit = userId === currentUserId && messageId !== undefined && type !== 'system' && type !== 'file';
  const canDeleteFile = userId === currentUserId && messageId !== undefined && (type === 'file' || type === 'image') && fileUrl;
  
  // Debug logging for file deletion capability
  console.log(`Message ${messageId}: userId=${userId}, currentUserId=${currentUserId}, type=${type}, fileUrl=${fileUrl}, canDeleteFile=${canDeleteFile}`);
  
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // File deletion mutation
  const fileDeleteMutation = useMutation({
    mutationFn: async () => {
      if (!messageId) throw new Error('No message ID');
      
      const endpoint = isDirectMessage 
        ? `/api/direct-messages/${messageId}/file`
        : `/api/channels/${channelId}/messages/${messageId}/file`;
      
      const res = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete file');
      }
      
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'File deleted successfully',
        variant: 'default',
      });
      
      // Invalidate relevant queries to refresh the UI
      if (isDirectMessage) {
        queryClient.invalidateQueries({ queryKey: ['/api/direct-messages'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete file',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Enhanced message editing with offline-first approach for resilience to database rate limiting
  const handleSaveEdit = async () => {
    if (messageId && onEditMessage && editedContent.trim() !== '') {
      setIsSaving(true);
      setEditError(null);
      
      // Update the UI immediately for better perceived performance
      setIsEditing(false);
      setShowToolbar(false);
      
      // Apply optimistic update to the DOM for immediate visual feedback
      const messageElement = document.querySelector(`[data-message-id="${messageId}"] .message-content`);
      if (messageElement) {
        // Store original content in case we need to revert
        const originalContent = messageElement.innerHTML;
        messageElement.setAttribute('data-original-content', originalContent);
        
        // Apply new content with simple markdown formatting 
        let formattedContent = editedContent
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/__(.*?)__/g, '<u>$1</u>')
          .replace(/```(.*?)```/g, '<code>$1</code>')
          .replace(/`(.*?)`/g, '<code>$1</code>')
          .replace(/\n/g, '<br>');
        
        messageElement.innerHTML = formattedContent;
      }
      
      // Store edit in session storage for immediate retrieval even if page reloads
      const cacheKey = `message_${messageId}_content`;
      try {
        // Use sessionStorage for current session persistence
        sessionStorage.setItem(cacheKey, editedContent);
        
        // Also track this edit in localStorage for long-term persistence and background sync
        const pendingEdits = JSON.parse(localStorage.getItem('pendingMessageEdits') || '[]');
        const editIndex = pendingEdits.findIndex((edit: any) => edit.id === messageId);
        
        if (editIndex >= 0) {
          pendingEdits[editIndex] = {
            id: messageId,
            content: editedContent,
            timestamp: new Date().toISOString(),
            attempts: pendingEdits[editIndex].attempts + 1
          };
        } else {
          pendingEdits.push({
            id: messageId,
            content: editedContent,
            timestamp: new Date().toISOString(),
            attempts: 0
          });
        }
        
        localStorage.setItem('pendingMessageEdits', JSON.stringify(pendingEdits));
      } catch (err) {
        console.warn("Failed to save edit to storage", err);
      }
      
      // Set up background sync strategy with exponential backoff
      const scheduleBackgroundSync = (delay = 2000) => {
        setTimeout(async () => {
          try {
            // Check if edit is still pending
            const pendingEdits = JSON.parse(localStorage.getItem('pendingMessageEdits') || '[]');
            const pendingEdit = pendingEdits.find((edit: any) => edit.id === messageId);
            
            if (!pendingEdit) {
              console.log(`Edit for message ${messageId} no longer pending, sync canceled`);
              return; // Already synced by another process
            }
            
            // Attempt to save via API
            console.log(`Attempting background sync for message ${messageId}`);
            await onEditMessage(messageId, pendingEdit.content);
            
            // Success! Remove from pending edits
            const updatedEdits = pendingEdits.filter((edit: any) => edit.id !== messageId);
            localStorage.setItem('pendingMessageEdits', JSON.stringify(updatedEdits));
            sessionStorage.removeItem(cacheKey);
            console.log(`Background sync successful for message ${messageId}`);
          } catch (error: any) {
            console.error(`Background sync failed for message ${messageId}:`, error);
            
            // Update attempt count and reschedule with exponential backoff
            try {
              const pendingEdits = JSON.parse(localStorage.getItem('pendingMessageEdits') || '[]');
              const editIndex = pendingEdits.findIndex((edit: any) => edit.id === messageId);
              
              if (editIndex >= 0) {
                const attempts = pendingEdits[editIndex].attempts + 1;
                pendingEdits[editIndex].attempts = attempts;
                localStorage.setItem('pendingMessageEdits', JSON.stringify(pendingEdits));
                
                // Calculate next retry delay with exponential backoff (max 2 minutes)
                const nextDelay = Math.min(delay * 2, 120000);
                
                if (attempts < 10) { // Max 10 attempts
                  console.log(`Rescheduling sync for message ${messageId} in ${nextDelay}ms (attempt ${attempts})`);
                  scheduleBackgroundSync(nextDelay);
                } else {
                  console.warn(`Max retry attempts reached for message ${messageId}`);
                }
              }
            } catch (storageErr) {
              console.error("Failed to update pending edits:", storageErr);
            }
          }
        }, delay);
      };
      
      // Try saving right away
      try {
        await onEditMessage(messageId, editedContent);
        
        // Edit succeeded, remove from pending
        try {
          const pendingEdits = JSON.parse(localStorage.getItem('pendingMessageEdits') || '[]');
          const updatedEdits = pendingEdits.filter((edit: any) => edit.id !== messageId);
          localStorage.setItem('pendingMessageEdits', JSON.stringify(updatedEdits));
          sessionStorage.removeItem(cacheKey);
        } catch (err) {
          console.warn("Failed to update storage after successful edit", err);
        }
      } catch (error: any) {
        console.error("Initial edit save failed, scheduling background sync:", error);
        
        // Show friendly message to user but continue with background sync
        setEditError(
          error?.message?.includes('rate limit') || error?.message?.includes('Control plane')
            ? 'Database is experiencing high traffic. Your changes are saved locally and will be synced automatically.'
            : 'Network issue detected. Your changes are saved and will sync when connection improves.'
        );
        
        // Schedule background sync to try again
        scheduleBackgroundSync();
      }
      
      setIsSaving(false);
    }
  };
  
  const handleCancelEdit = () => {
    setEditedContent(content);
    setIsEditing(false);
    setShowToolbar(false);
  };
  
  const applyFormatting = (formatType: string) => {
    const textarea = document.getElementById(`edit-message-${messageId}`) as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = editedContent.substring(start, end);
    
    let formattedText = '';
    let cursorPosition = 0;
    
    switch (formatType) {
      case 'bold':
        formattedText = editedContent.substring(0, start) + `**${selection}**` + editedContent.substring(end);
        cursorPosition = end + 4;
        break;
      case 'italic':
        formattedText = editedContent.substring(0, start) + `*${selection}*` + editedContent.substring(end);
        cursorPosition = end + 2;
        break;
      case 'underline':
        formattedText = editedContent.substring(0, start) + `__${selection}__` + editedContent.substring(end);
        cursorPosition = end + 4;
        break;
      case 'code':
        formattedText = editedContent.substring(0, start) + `\`${selection}\`` + editedContent.substring(end);
        cursorPosition = end + 2;
        break;
      case 'link':
        formattedText = editedContent.substring(0, start) + `[${selection}](url)` + editedContent.substring(end);
        cursorPosition = end + 7;
        break;
      default:
        return;
    }
    
    setEditedContent(formattedText);
    
    // Set focus back to textarea and cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    }, 0);
  };
  
  const formattedContent = useMemo(() => {
    if (!content && !fileUrl) return '';
    
    // Process formatting with HTML
    let formattedHTML = content || '';
    
    // 1. First escape any HTML to prevent injection
    formattedHTML = formattedHTML
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    // 2. Apply text formatting
    
    // Bold: **text**
    formattedHTML = formattedHTML.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Italic: *text*
    formattedHTML = formattedHTML.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Underline: __text__
    formattedHTML = formattedHTML.replace(/__(.+?)__/g, '<u>$1</u>');
    
    // Code: `text`
    formattedHTML = formattedHTML.replace(/`(.+?)`/g, '<code class="bg-muted/70 px-1 rounded text-sm">$1</code>');
    
    // Link: [text](url)
    formattedHTML = formattedHTML.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary underline" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // 3. Handle mentions last
    formattedHTML = formattedHTML.replace(/@([a-zA-Z0-9_]+)/g, (match, username) => {
      // Replace underscores with spaces for display
      const displayName = username.replace(/_/g, ' ');
      return `<span class="bg-accent text-accent-foreground px-1.5 rounded font-medium">@${displayName}</span>`;
    });
    
    return formattedHTML;
  }, [content]);
  
  // Determine if this is an image file
  const isImage = useMemo(() => {
    if (!fileName) return false;
    
    const lowerCaseName = fileName.toLowerCase();
    return lowerCaseName.endsWith('.jpg') || 
           lowerCaseName.endsWith('.jpeg') || 
           lowerCaseName.endsWith('.png') || 
           lowerCaseName.endsWith('.gif') || 
           lowerCaseName.endsWith('.svg') || 
           lowerCaseName.endsWith('.webp');
  }, [fileName]);
  
  return (
    <div>
      {/* Editing mode */}
      {isEditing ? (
        <div className="space-y-2 mb-2">
          {showToolbar && (
            <FormattingToolbar 
              onFormatClick={applyFormatting}
              onFileUploadClick={() => {}}
              onImageUploadClick={() => {}}
            />
          )}
          <div className="flex flex-col space-y-2">
            <Textarea
              id={`edit-message-${messageId}`}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onFocus={() => setShowToolbar(true)}
              className="min-h-[100px] text-sm resize-none bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600"
              placeholder="Edit your message..."
            />
            {editError && (
              <div className="text-red-500 text-sm mb-2 p-2 bg-red-50 rounded border border-red-200">
                {editError}
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleSaveEdit}
                disabled={editedContent.trim() === '' || isSaving}
              >
                {isSaving ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="group relative">
          {/* Display the formatted text content */}
          {content && content.trim() !== "" && (
            <>
              <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
              {/* Display edit indicator if message has been edited */}
              {isEdited && (
                <div className="text-xs text-muted-foreground mt-1 italic">
                  (edited {updatedAt ? new Date(updatedAt).toLocaleString() : ''})
                </div>
              )}
            </>
          )}
          
          {/* Edit button (only visible on hover if user can edit) */}
          {canEdit && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
              onClick={() => {
                setEditedContent(content);
                setIsEditing(true);
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          
          {/* Display file attachment */}
          {fileUrl && (
            <div className={`group relative ${content && content.trim() !== "" ? "mt-2" : ""}`}>
              {isImage ? (
                <div className="relative">
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                    <img 
                      src={fileUrl} 
                      alt={fileName || "Attached image"} 
                      className="max-w-full max-h-[300px] rounded-md border border-border" 
                    />
                  </a>
                  {fileName && <div className="text-xs text-muted-foreground mt-1">{fileName}</div>}
                  
                  {/* Delete button for images */}
                  {(canDeleteFile || true) && (
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-6 w-6 bg-red-500 hover:bg-red-600"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        fileDeleteMutation.mutate();
                      }}
                      disabled={fileDeleteMutation.isPending}
                      title="Delete file"
                    >
                      <Trash2 className="h-3 w-3 text-white" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <a 
                    href={fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 border border-border rounded-md hover:bg-accent/10 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span className="text-sm font-medium">{fileName || "Download attachment"}</span>
                  </a>
                  
                  {/* Delete button for files */}
                  {(canDeleteFile || true) && (
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-6 w-6 bg-red-500 hover:bg-red-600"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        fileDeleteMutation.mutate();
                      }}
                      disabled={fileDeleteMutation.isPending}
                      title="Delete file"
                    >
                      <Trash2 className="h-3 w-3 text-white" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* We no longer need this timestamp display here since it's moved to the parent component */}
        </div>
      )}
    </div>
  );
};