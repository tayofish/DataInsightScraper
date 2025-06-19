import { useEffect, useState } from 'react';
import { WifiOff, Database, Clock, ArrowDownUp, RefreshCw, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from '@/hooks/websocket-provider';
import { useAuth } from '@/hooks/use-auth';

export function OfflineModeIndicator() {
  const { user } = useAuth();
  const [isOffline, setIsOffline] = useState(false);
  const [offlineSince, setOfflineSince] = useState<Date | null>(null);
  const { toast } = useToast();
  
  // Use our WebSocket context with all available properties
  const { 
    status, 
    isDatabaseDown,
    pendingMessageCount,
    lastConnectionAttempt,
    forceSyncNow
  } = useWebSocket();
  
  // Track offline status based on both network status and database status
  useEffect(() => {
    // Check network status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    // Initial network check
    setIsOffline(!navigator.onLine);
    
    // Set up network listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Record offline start time if it's the first time we're going offline
    if (isDatabaseDown && !offlineSince) {
      const storedOfflineSince = localStorage.getItem('offline_since');
      
      if (storedOfflineSince) {
        setOfflineSince(new Date(storedOfflineSince));
      } else {
        const now = new Date();
        setOfflineSince(now);
        localStorage.setItem('offline_since', now.toISOString());
      }
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isDatabaseDown, offlineSince]);
  
  // Reset offline time when database comes back online
  useEffect(() => {
    if (!isDatabaseDown && offlineSince) {
      const reconnectedTime = new Date();
      const offlineTime = offlineSince;
      const durationMs = reconnectedTime.getTime() - offlineTime.getTime();
      const durationMins = Math.floor(durationMs / 60000);
      
      toast({
        title: "Database connection restored",
        description: `Connection was down for ${durationMins} minute(s). Syncing pending messages...`,
      });
      
      localStorage.removeItem('offline_since');
      setOfflineSince(null);
    }
  }, [isDatabaseDown, offlineSince, toast]);
  
  // Don't show if everything is working normally or user is not authenticated
  const shouldShow = user && (isOffline || isDatabaseDown || pendingMessageCount > 0 || status !== 'connected');
  
  if (!shouldShow) return null;
  
  // Format offline duration
  const formatDuration = () => {
    if (!offlineSince) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - offlineSince.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const hours = Math.floor(diffMins / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  };
  
  // Format the time of the last connection attempt
  const formatLastConnectionAttempt = () => {
    if (!lastConnectionAttempt) return 'never';
    
    const now = new Date();
    // Convert to Date object if needed
    const attemptDate = lastConnectionAttempt instanceof Date ? 
      lastConnectionAttempt : new Date(lastConnectionAttempt);
    
    const diffMs = now.getTime() - attemptDate.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 5) return 'just now';
    if (diffSecs < 60) return `${diffSecs} seconds ago`;
    
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins === 1) return '1 minute ago';
    return `${diffMins} minutes ago`;
  };
  
  // Get status info to display
  const getStatusText = () => {
    if (isOffline) return 'You are offline';
    if (isDatabaseDown) return 'Database connection issues';
    if (status === 'disconnected') return 'WebSocket disconnected';
    if (status === 'connecting') return 'Connecting...';
    if (status === 'error') return 'Connection error';
    return 'Connection issues';
  };
  
  // Get detailed description
  const getDescriptionText = () => {
    if (isOffline) {
      return 'Your network connection is unavailable. The app is running in offline mode.';
    }
    if (isDatabaseDown) {
      return 'The database endpoint is currently disabled. The app is using cached data and will sync when the database is available again.';
    }
    if (status === 'disconnected') {
      return 'WebSocket connection lost. Real-time features may be limited.';
    }
    if (pendingMessageCount > 0) {
      return `You have ${pendingMessageCount} message(s) in your local cache.`;
    }
    return 'There are some connection issues. The app is still working, but some features may be limited.';
  };
  
  const handleManualSync = () => {
    toast({
      title: "Manual sync initiated",
      description: "Attempting to reconnect and sync data with the server...",
    });
    
    // Use our WebSocket context's forceSyncNow function
    forceSyncNow();
  };

  return (
    <Alert 
      variant={isDatabaseDown || isOffline ? "destructive" : "default"} 
      className="fixed bottom-4 right-4 z-50 max-w-md shadow-lg animate-pulse-slow"
    >
      <div className="flex flex-col">
        <div className="flex items-center">
          {isOffline ? (
            <WifiOff className="h-5 w-5 mr-2 text-red-500" />
          ) : isDatabaseDown ? (
            <Database className="h-5 w-5 mr-2 text-orange-500" />
          ) : status === 'error' || status === 'disconnected' ? (
            <AlertCircle className="h-5 w-5 mr-2 text-amber-500" />
          ) : (
            <RefreshCw className="h-5 w-5 mr-2 text-blue-500 animate-spin-slow" />
          )}
          <div>
            <AlertTitle className="text-lg font-bold">
              {getStatusText()}
            </AlertTitle>
            <AlertDescription className="text-sm">
              {getDescriptionText()}
            </AlertDescription>
          </div>
        </div>
        
        {/* Enhanced status information */}
        <div className="mt-2 space-y-1 text-sm border-t border-opacity-25 pt-2">
          {offlineSince && (
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>Offline since: {formatDuration()}</span>
            </div>
          )}
          
          {pendingMessageCount > 0 && (
            <div className="flex items-center">
              <ArrowDownUp className="h-4 w-4 mr-1" />
              <span>Pending messages: {pendingMessageCount}</span>
            </div>
          )}
          
          <div className="flex items-center">
            <RefreshCw className="h-4 w-4 mr-1" />
            <span>Last connection attempt: {formatLastConnectionAttempt()}</span>
          </div>
          
          <div className="flex items-center mt-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="w-full text-xs"
              onClick={handleManualSync}
              disabled={status === 'connecting'}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${status === 'connecting' ? 'animate-spin' : ''}`} /> 
              {status === 'connecting' ? 'Connecting...' : 'Force Sync Now'}
            </Button>
          </div>
        </div>
      </div>
    </Alert>
  );
}