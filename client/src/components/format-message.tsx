import React, { useMemo } from 'react';

interface FormatMessageProps {
  content: string;
  fileUrl?: string;
  fileName?: string;
  type?: string;
}

export const FormatMessage: React.FC<FormatMessageProps> = ({ 
  content, 
  fileUrl, 
  fileName, 
  type 
}) => {
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
      {/* Display the formatted text content */}
      {content && content.trim() !== "" && <div dangerouslySetInnerHTML={{ __html: formattedContent }} />}
      
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
    </div>
  );
};