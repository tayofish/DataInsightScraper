import { useEffect, useState } from 'react';
import { WifiOff, Database } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function OfflineModeIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [databaseDown, setDatabaseDown] = useState(false);

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
    };

    // Initial check
    setIsOffline(!navigator.onLine);
    checkDatabaseStatus();
    
    // Force database down status for testing since we know the Neon endpoint is disabled
    setDatabaseDown(true);

    // Set up listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check database status every 10 seconds
    const interval = setInterval(checkDatabaseStatus, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Always show the indicator during development since we know the database is down
  // In production, this would be: if (!isOffline && !databaseDown) return null;

  return (
    <Alert variant="destructive" className="fixed bottom-4 right-4 z-50 max-w-md shadow-lg animate-pulse-slow">
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
    </Alert>
  );
}