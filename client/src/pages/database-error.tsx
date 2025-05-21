import { Button } from "@/components/ui/button";
import { Database, RefreshCw, Clock, ArrowDownUp, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";

export default function DatabaseErrorPage() {
  const [_, navigate] = useLocation();
  const [retryCount, setRetryCount] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [errorDetails, setErrorDetails] = useState("Control plane request failed: endpoint is disabled");
  const [pendingMessages, setPendingMessages] = useState(0);
  
  // Check for pending messages in offline queue
  useEffect(() => {
    try {
      const offlineQueue = localStorage.getItem('offline_message_queue');
      if (offlineQueue) {
        const queue = JSON.parse(offlineQueue);
        setPendingMessages(queue.length);
      }
    } catch (e) {
      console.error("Error checking pending messages:", e);
    }
  }, []);
  
  // Store that we're in offline mode
  const setOfflineMode = () => {
    localStorage.setItem('last_database_error', new Date().toISOString());
    localStorage.setItem('offline_since', new Date().toISOString());
    localStorage.setItem('offline_mode', 'true');
    
    // Dispatch an event for WebSocket to attempt reconnection
    window.dispatchEvent(new CustomEvent('manual-sync-attempt'));
    
    navigate('/');
  };
  
  const retryConnection = async () => {
    setIsChecking(true);
    setRetryCount(prev => prev + 1);
    
    try {
      // Try to fetch a simple endpoint to check database connectivity
      const response = await fetch('/api/user');
      if (response.ok) {
        // Database is available again
        localStorage.removeItem('last_database_error');
        localStorage.removeItem('offline_mode');
        
        // Trigger sync of any pending messages
        window.dispatchEvent(new CustomEvent('manual-sync-attempt'));
        
        // Redirect to home
        navigate('/');
      } else {
        // Still has issues
        const data = await response.text();
        setErrorDetails(data || "Database is still unavailable");
        setIsChecking(false);
      }
    } catch (error: any) {
      console.error("Connection retry failed:", error);
      setErrorDetails(error?.message || "Connection failed");
      setIsChecking(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <div className="text-center">
          <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full inline-flex items-center justify-center mb-4">
            <Database className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Database Connection Issue</h1>
          <div className="text-red-500 dark:text-red-400 text-sm font-mono p-3 bg-red-50 dark:bg-red-900/20 rounded mb-4 overflow-auto">
            Error: {errorDetails}
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            The database is currently unavailable. You can continue using the app in offline mode,
            where you'll have access to cached data and can create messages that will sync when 
            the database connection is restored.
          </p>
          
          {pendingMessages > 0 && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-left">
              <div className="flex items-center text-yellow-700 dark:text-yellow-400 font-medium mb-1">
                <ArrowDownUp className="h-4 w-4 mr-2" />
                Pending Messages
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                You have {pendingMessages} {pendingMessages === 1 ? 'message' : 'messages'} waiting to be 
                synchronized when the database connection is restored.
              </p>
            </div>
          )}
          
          <div className="flex flex-col gap-3">
            <Button 
              onClick={setOfflineMode}
              variant="default" 
              className="w-full flex items-center justify-center gap-2"
            >
              <Database className="h-4 w-4" />
              Continue in Offline Mode
            </Button>
            <Button 
              onClick={retryConnection}
              variant="outline" 
              className="w-full flex items-center justify-center gap-2"
              disabled={isChecking}
            >
              {isChecking ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Checking Connection...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Retry Connection {retryCount > 0 ? `(${retryCount})` : ''}
                </>
              )}
            </Button>
            
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              <Clock className="h-3 w-3 inline-block mr-1" />
              Your data will automatically sync when the database is back online.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}