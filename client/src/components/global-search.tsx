import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, MessageSquare, MessagesSquare, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface SearchResult {
  id: number;
  type: 'task' | 'channel_message' | 'direct_message';
  title: string;
  content: string;
  snippet: string;
  createdAt: string;
  user?: {
    id: number;
    name: string;
    username: string;
    avatar?: string;
  };
  channel?: {
    id: number;
    name: string;
  };
  priority?: string;
  status?: string;
}

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  // Search API call with debouncing
  const { data: searchResults = [], isLoading, isFetching } = useQuery({
    queryKey: ['/api/search', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: query.trim().length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Handle outside clicks
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen || !searchResults.length) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, searchResults.length - 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          event.preventDefault();
          if (searchResults[selectedIndex]) {
            handleResultClick(searchResults[selectedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchResults, selectedIndex]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults]);

  // Handle search input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(value.trim().length > 0);
  };

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    
    switch (result.type) {
      case 'task':
        // Navigate to tasks page, the task list will auto-open the task details
        setLocation(`/tasks`);
        // Use a timeout to allow the page to load, then trigger task opening
        setTimeout(() => {
          const taskRow = document.querySelector(`[data-task-id="${result.id}"]`);
          if (taskRow) {
            (taskRow as HTMLElement).click();
          }
        }, 500);
        break;
      case 'channel_message':
        if (result.channel) {
          setLocation(`/messages`);
          // Use localStorage to store the target message and channel
          localStorage.setItem('targetChannel', result.channel.id.toString());
          localStorage.setItem('targetMessage', result.id.toString());
        }
        break;
      case 'direct_message':
        if (result.user) {
          // Navigate to direct messages with the specific user
          setLocation(`/direct-messages/${result.user.id}`);
          // Store target message for highlighting
          localStorage.setItem('targetMessage', result.id.toString());
        }
        break;
    }
  };

  // Get icon for result type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'task':
        return <FileText size={16} className="text-blue-600" />;
      case 'channel_message':
        return <MessagesSquare size={16} className="text-green-600" />;
      case 'direct_message':
        return <MessageSquare size={16} className="text-purple-600" />;
      default:
        return <Search size={16} className="text-gray-400" />;
    }
  };

  // Get type label
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'task':
        return 'Task';
      case 'channel_message':
        return 'Channel';
      case 'direct_message':
        return 'Direct Message';
      default:
        return 'Unknown';
    }
  };

  // Get badge color for result type
  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'task':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'channel_message':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'direct_message':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search tasks, messages, channels..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.trim() && setIsOpen(true)}
          className="pl-10 pr-10 w-80 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900 transition-colors"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <X size={14} />
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          {isLoading || isFetching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Searching...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {query.trim() ? 'No results found' : 'Start typing to search'}
            </div>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{query}"
                </span>
              </div>
              <ScrollArea className="max-h-80">
                {searchResults.map((result: SearchResult, index: number) => (
                  <div
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    className={cn(
                      "flex items-start gap-3 p-3 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors",
                      index === selectedIndex 
                        ? "bg-blue-50 dark:bg-blue-900/20" 
                        : "hover:bg-gray-50 dark:hover:bg-gray-700"
                    )}
                  >
                    <div className="flex-shrink-0 mt-1">
                      {getTypeIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className={cn("text-xs", getBadgeColor(result.type))}>
                          {getTypeLabel(result.type)}
                        </Badge>
                        {result.channel && (
                          <span className="text-xs text-gray-500">#{result.channel.name}</span>
                        )}
                        {result.priority && result.type === 'task' && (
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              result.priority === 'Critical' && "border-red-500 text-red-700",
                              result.priority === 'High' && "border-orange-500 text-orange-700",
                              result.priority === 'Medium' && "border-yellow-500 text-yellow-700",
                              result.priority === 'Low' && "border-green-500 text-green-700"
                            )}
                          >
                            {result.priority}
                          </Badge>
                        )}
                      </div>
                      <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {result.title}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {result.snippet}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {result.user && (
                          <div className="flex items-center gap-1">
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={result.user.avatar} />
                              <AvatarFallback className="text-xs">
                                {result.user.name?.charAt(0) || result.user.username.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-gray-500">
                              {result.user.name || result.user.username}
                            </span>
                          </div>
                        )}
                        <span className="text-xs text-gray-400">
                          {format(new Date(result.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </ScrollArea>
              <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Use ↑↓ to navigate • Enter to select • Esc to close
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}