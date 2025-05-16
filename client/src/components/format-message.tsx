import React, { useMemo, useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FormattingToolbar } from './formatting-toolbar';

interface FormatMessageProps {
  content: string;
  fileUrl?: string;
  fileName?: string;
  type?: string;
  messageId?: number;
  userId?: number;
  currentUserId?: number;
  createdAt?: Date | string;
  onEditMessage?: (messageId: number, content: string) => void;
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
  onEditMessage
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [showToolbar, setShowToolbar] = useState(false);
  
  // Check if current user is the message author and message is editable
  const canEdit = userId === currentUserId && messageId !== undefined && type !== 'system' && type !== 'file';
  
  const handleSaveEdit = () => {
    if (messageId && onEditMessage && editedContent.trim() !== '') {
      onEditMessage(messageId, editedContent);
      setIsEditing(false);
      setShowToolbar(false);
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
              className="min-h-[100px] text-sm resize-none"
              placeholder="Edit your message..."
            />
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCancelEdit}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleSaveEdit}
                disabled={editedContent.trim() === ''}
              >
                <Check className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="group relative">
          {/* Display the formatted text content */}
          {content && content.trim() !== "" && (
            <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
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
            <div className={content && content.trim() !== "" ? "mt-2" : ""}>
              {isImage ? (
                <div>
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                    <img 
                      src={fileUrl} 
                      alt={fileName || "Attached image"} 
                      className="max-w-full max-h-[300px] rounded-md border border-border" 
                    />
                  </a>
                  {fileName && <div className="text-xs text-muted-foreground mt-1">{fileName}</div>}
                </div>
              ) : (
                <a 
                  href={fileUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 border border-border rounded-md hover:bg-accent/10 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span className="text-sm font-medium">{fileName || "Download attachment"}</span>
                </a>
              )}
            </div>
          )}
          
          {/* Display edited indicator if message was edited */}
          {createdAt && type !== 'system' && (
            <div className="text-xs text-muted-foreground mt-1">
              {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {content.includes('(edited)') && <span className="ml-1">(edited)</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};