import { useEffect, useState } from 'react';
import { WifiOff, Database, Clock, ArrowDownUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function OfflineModeIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [databaseDown, setDatabaseDown] = useState(false);
  const [offlineSince, setOfflineSince] = useState<Date | null>(null);
  const [pendingOperations, setPendingOperations] = useState(0);
  const { toast } = useToast();

  // Check if we're offline or the database is down
  useEffect(() => {
    // Check network status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    // Check for database errors in console logs
    const checkDatabaseStatus = () => {
      // Store current database status explicitly for the offline indicator 
      const dbErrors = document.querySelectorAll('.database-error');
      if (dbErrors.length > 0 || window.location.href.includes('endpoint is disabled')) {
        setDatabaseDown(true);
        
        if (!offlineSince) {
          setOfflineSince(new Date());
        }
        
        localStorage.setItem('last_database_error', new Date().toISOString());
      }
      
      // Also check for database errors in localStorage
      const lastDatabaseError = localStorage.getItem('last_database_error');
      const lastErrorTime = lastDatabaseError ? new Date(lastDatabaseError) : null;
      const now = new Date();
      
      // Database is considered down if there was an error in the last 5 minutes
      if (lastErrorTime && (now.getTime() - lastErrorTime.getTime() < 5 * 60 * 1000)) {
        setDatabaseDown(true);
      }
      
      // Check for pending operations in offline queue
      const offlineQueue = localStorage.getItem('offline_message_queue');
      if (offlineQueue) {
        try {
          const queue = JSON.parse(offlineQueue);
          setPendingOperations(queue.length);
        } catch (e) {
          setPendingOperations(0);
        }
      }
    };

    // Initial check
    setIsOffline(!navigator.onLine);
    checkDatabaseStatus();
    
    // Force database down status for testing since we know the Neon endpoint is disabled
    setDatabaseDown(true);
    
    // Check if we have a stored offline start time
    const storedOfflineSince = localStorage.getItem('offline_since');
    if (storedOfflineSince) {
      setOfflineSince(new Date(storedOfflineSince));
    } else if (databaseDown) {
      const now = new Date();
      setOfflineSince(now);
      localStorage.setItem('offline_since', now.toISOString());
    }

    // Set up listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check database status every 5 seconds
    const interval = setInterval(checkDatabaseStatus, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [offlineSince, databaseDown]);

  // Always show the indicator during development since we know the database is down
  // In production, this would be: if (!isOffline && !databaseDown) return null;
  
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
  
  const handleManualSync = () => {
    toast({
      title: "Manual sync initiated",
      description: "Attempting to reconnect and sync data with the server...",
    });
    
    // Trigger a manual sync in the WebSocket connection
    window.dispatchEvent(new CustomEvent('manual-sync-attempt'));
  };

  return (
    <Alert variant="destructive" className="fixed bottom-4 right-4 z-50 max-w-md shadow-lg animate-pulse-slow">
      <div className="flex flex-col">
        <div className="flex items-center">
          {isOffline ? (
            <WifiOff className="h-5 w-5 mr-2 text-red-500" />
          ) : (
            <Database className="h-5 w-5 mr-2 text-orange-500" />
          )}
          <div>
            <AlertTitle className="text-lg font-bold">
              {isOffline ? 'You are offline' : 'Database connection issues'}
            </AlertTitle>
            <AlertDescription className="text-sm">
              {isOffline 
                ? 'Your network connection is unavailable. The app is running in offline mode.'
                : 'The database endpoint is currently disabled. The app is using cached data and will sync when the database is available again.'
              }
            </AlertDescription>
          </div>
        </div>
        
        {/* Additional status information */}
        <div className="mt-2 space-y-1 text-sm border-t border-red-200 pt-2">
          {offlineSince && (
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>Offline since: {formatDuration()}</span>
            </div>
          )}
          
          {pendingOperations > 0 && (
            <div className="flex items-center">
              <ArrowDownUp className="h-4 w-4 mr-1" />
              <span>Pending operations: {pendingOperations}</span>
            </div>
          )}
          
          <Button 
            size="sm" 
            variant="outline" 
            className="mt-1 w-full text-xs"
            onClick={handleManualSync}
          >
            <ArrowDownUp className="h-3 w-3 mr-1" /> Force Sync Now
          </Button>
        </div>
      </div>
    </Alert>
  );
}