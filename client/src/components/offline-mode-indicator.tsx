import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function OfflineModeIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [databaseDown, setDatabaseDown] = useState(false);

  // Check if we're offline or the database is down
  useEffect(() => {
    // Check network status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    // Check for database errors in localStorage
    const checkDatabaseStatus = () => {
      const lastDatabaseError = localStorage.getItem('last_database_error');
      const lastDatabaseSuccess = localStorage.getItem('last_database_success');
      
      if (lastDatabaseError && (!lastDatabaseSuccess || new Date(lastDatabaseError) > new Date(lastDatabaseSuccess))) {
        setDatabaseDown(true);
      } else {
        setDatabaseDown(false);
      }
    };

    // Initial check
    setIsOffline(!navigator.onLine);
    checkDatabaseStatus();

    // Set up listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check database status every 30 seconds
    const interval = setInterval(checkDatabaseStatus, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (!isOffline && !databaseDown) return null;

  return (
    <Alert variant="destructive" className="fixed bottom-4 right-4 z-50 max-w-md">
      <WifiOff className="h-4 w-4" />
      <AlertTitle>
        {isOffline ? 'You are offline' : 'Database connection issues'}
      </AlertTitle>
      <AlertDescription>
        {isOffline 
          ? 'Your network connection is unavailable. The app is running in offline mode.'
          : 'The database connection is currently unavailable. The app is using cached data.'
        }
      </AlertDescription>
    </Alert>
  );
}