import React, { useMemo } from 'react';

interface FormatMessageProps {
  content: string;
}

export const FormatMessage: React.FC<FormatMessageProps> = ({ content }) => {
  const formattedContent = useMemo(() => {
    if (!content) return '';
    
    // Process formatting with HTML
    let formattedHTML = content;
    
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
      return `<span class="text-primary font-semibold">@${displayName}</span>`;
    });
    
    return formattedHTML;
  }, [content]);
  
  return <div dangerouslySetInnerHTML={{ __html: formattedContent }} />;
};