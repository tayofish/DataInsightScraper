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
  BarChart2
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

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

  const sidebarContent = (
    <>
      <div className="flex items-center flex-shrink-0 px-6 py-6">
        <span className="text-2xl font-bold gradient-heading">TaskScout</span>
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
        <NavItem href="/categories" icon={<Tag size={20} />} isActive={location === '/categories'}>
          Categories
        </NavItem>
        <NavItem href="/departments" icon={<Building2 size={20} />} isActive={location === '/departments'}>
          Departments
        </NavItem>
        <NavItem href="#" icon={<Globe size={20} />} isActive={false}>
          Web Scraping
        </NavItem>
        <NavItem href="#" icon={<Database size={20} />} isActive={false}>
          SQL Translator
        </NavItem>
        <NavItem href="#" icon={<Users size={20} />} isActive={false}>
          Team
        </NavItem>
        <NavItem href="/settings" icon={<Settings size={20} />} isActive={location === '/settings'}>
          Settings
        </NavItem>
        {/* Only show admin link for admin user (id 4) */}
        {user?.id === 4 && (
          <NavItem href="/admin" icon={<Shield size={20} />} isActive={location === '/admin'}>
            Admin Dashboard
          </NavItem>
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
