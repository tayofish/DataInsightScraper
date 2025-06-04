import React from 'react';
import { Link, useLocation } from 'wouter';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  CheckSquare, 
  FolderKanban, 
  Tag,
  Globe,
  Database,
  Users,
  Settings,
  Menu,
  Building2,
  LogOut,
  Shield,
  BarChart2,
  MessageSquare,
  MessagesSquare
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isActive: boolean;
}

const NavItem = ({ href, icon, children, isActive }: NavItemProps) => {
  return (
    <Link href={href}>
      <div
        className={cn(
          "group flex items-center px-4 py-3 text-sm font-medium rounded-xl cursor-pointer transition-all duration-200",
          isActive 
            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20" 
            : "text-gray-700 hover:bg-gray-100/60"
        )}
      >
        <div className={cn(
          "mr-3 flex items-center justify-center",
          isActive ? "text-white" : "text-blue-600"
        )}>
          {icon}
        </div>
        <span className="font-medium">{children}</span>
      </div>
    </Link>
  );
};

export function Sidebar() {
  const [location] = useLocation();
  const isMobile = useMobile();
  const [showMobileSidebar, setShowMobileSidebar] = React.useState(false);
  const { user, logoutMutation } = useAuth();

  const toggleMobileSidebar = () => {
    setShowMobileSidebar(!showMobileSidebar);
  };
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);

  // Fetch app name
  const { data: appNameSetting } = useQuery({
    queryKey: ["/api/app-settings/app-name"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/app-settings/app-name");
        if (res.status === 404) {
          return { value: "Task Management System" }; // Default name
        }
        if (!res.ok) throw new Error("Failed to fetch app name");
        return res.json();
      } catch (error) {
        return { value: "Task Management System" }; // Default name
      }
    }
  });

  React.useEffect(() => {
    // Fetch the logo URL from the server
    async function fetchLogo() {
      try {
        const response = await fetch('/api/app-settings/logo');
        if (response.ok) {
          const data = await response.json();
          if (data && data.value) {
            setLogoUrl(data.value);
          }
        }
      } catch (error) {
        console.error('Error fetching logo:', error);
      }
    }
    
    fetchLogo();
  }, []);

  const sidebarContent = (
    <>
      <div className="flex items-center flex-shrink-0 px-6 py-6 gap-3">
        {logoUrl && (
          <img 
            src={logoUrl} 
            alt="Company Logo" 
            className="h-10 w-auto object-contain flex-shrink-0" 
          />
        )}
        <span className="text-2xl font-bold gradient-heading truncate">
          {appNameSetting?.value || "Task Management System"}
        </span>
      </div>
      <nav className="mt-2 flex-1 px-4 space-y-2 custom-scrollbar">
        <NavItem href="/" icon={<LayoutDashboard size={20} />} isActive={location === '/'}>
          Dashboard
        </NavItem>
        <NavItem href="/tasks" icon={<CheckSquare size={20} />} isActive={location === '/tasks'}>
          Tasks
        </NavItem>
        <NavItem href="/projects" icon={<FolderKanban size={20} />} isActive={location === '/projects'}>
          Projects
        </NavItem>
        {/* Common for all users */}
        <NavItem href="/reports" icon={<BarChart2 size={20} />} isActive={location === '/reports'}>
          Reports
        </NavItem>

        {/* Collaboration features */}
        <div className="pt-4 pb-2">
          <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Collaboration
          </h3>
        </div>
        <NavItem href="/channels" icon={<MessagesSquare size={20} />} isActive={location === '/channels'}>
          Channels
        </NavItem>
        <NavItem href="/direct-messages" icon={<MessageSquare size={20} />} isActive={location.startsWith('/direct-messages')}>
          Messages
        </NavItem>
        
        <NavItem href="/settings" icon={<Settings size={20} />} isActive={location === '/settings'}>
          Settings
        </NavItem>
        
        {/* Admin-only sections */}
        {user?.isAdmin && (
          <>
            <NavItem href="/categories" icon={<Tag size={20} />} isActive={location === '/categories'}>
              Categories
            </NavItem>
            <NavItem href="/departments" icon={<Building2 size={20} />} isActive={location === '/departments'}>
              Departments
            </NavItem>
            <NavItem href="/teams" icon={<Users size={20} />} isActive={location === '/teams'}>
              Teams
            </NavItem>
            <NavItem href="/admin" icon={<Shield size={20} />} isActive={location === '/admin'}>
              Admin Dashboard
            </NavItem>
          </>
        )}
      </nav>
    </>
  );

  if (isMobile) {
    return (
      <>
        {/* Mobile menu button */}
        <Button 
          variant="outline" 
          size="icon" 
          className="md:hidden fixed top-4 left-4 z-50 shadow-md rounded-full bg-white h-10 w-10"
          onClick={toggleMobileSidebar}
        >
          <Menu className="text-blue-600" />
        </Button>

        {/* Mobile sidebar */}
        {showMobileSidebar && (
          <div className="fixed inset-0 flex z-40">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-gray-800/70 backdrop-blur-sm"
              onClick={() => setShowMobileSidebar(false)}
            />

            {/* Sidebar */}
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-xl">
              <div className="absolute right-0 p-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full"
                  onClick={() => setShowMobileSidebar(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </Button>
              </div>
              <div className="flex flex-col flex-grow h-full overflow-y-auto custom-scrollbar">
                {sidebarContent}
              </div>
              <div className="flex-shrink-0 p-4">
                <div className="flex-shrink-0 group block w-full">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 shadow-sm border border-gray-100">
                    <div className="flex items-center">
                      <div className="relative">
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                          <AvatarImage src={user?.avatar || undefined} alt="Profile" />
                          <AvatarFallback className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                            {user?.name?.substring(0, 2).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white"></div>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-800">{user?.name || 'User'}</p>
                        <p className="text-xs text-gray-500">{user?.username}</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="rounded-full hover:bg-gray-200"
                      onClick={handleLogout}
                      disabled={logoutMutation.isPending}
                    >
                      <LogOut size={18} className="text-gray-600" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-72 border-r border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col flex-grow h-full overflow-y-auto custom-scrollbar">
          {sidebarContent}
        </div>
        <div className="flex-shrink-0 px-4 py-4">
          <div className="flex-shrink-0 group block w-full">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 shadow-sm border border-gray-100">
              <div className="flex items-center">
                <div className="relative">
                  <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                    <AvatarImage src={user?.avatar || undefined} alt="Profile" />
                    <AvatarFallback className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                      {user?.name?.substring(0, 2).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white"></div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-800">{user?.name || 'User'}</p>
                  <p className="text-xs text-gray-500">{user?.username}</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                className="rounded-full hover:bg-gray-200"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
              >
                <LogOut size={18} className="text-gray-600" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
