import { Button } from "@/components/ui/button";
import { Database, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";

export default function DatabaseErrorPage() {
  const [_, navigate] = useLocation();
  
  // Store that we're in offline mode
  const setOfflineMode = () => {
    localStorage.setItem('last_database_error', new Date().toISOString());
    localStorage.setItem('offline_mode', 'true');
    navigate('/');
  };
  
  const retryConnection = () => {
    window.location.reload();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <div className="bg-red-100 p-3 rounded-full inline-flex items-center justify-center mb-4">
            <Database className="h-10 w-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Database Connection Issue</h1>
          <div className="text-red-500 text-sm font-mono p-3 bg-red-50 rounded mb-4 overflow-auto">
            Error: Control plane request failed: endpoint is disabled
          </div>
          <p className="text-gray-600 mb-6">
            The database is currently unavailable. You can continue using the app in offline mode,
            where you'll have access to cached data and can create messages that will sync when 
            the database connection is restored.
          </p>
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
            >
              <RefreshCw className="h-4 w-4" />
              Retry Connection
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}