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
  Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isActive: boolean;
}

const NavItem = ({ href, icon, children, isActive }: NavItemProps) => {
  return (
    <div
      onClick={() => window.location.href = href}
      className={cn(
        "group flex items-center px-2 py-2 text-sm font-medium rounded-md cursor-pointer",
        isActive 
          ? "bg-blue-600 text-white" 
          : "text-gray-700 hover:bg-gray-50"
      )}
    >
      <div className={cn(
        "mr-3",
        isActive ? "text-white" : "text-gray-500"
      )}>
        {icon}
      </div>
      {children}
    </div>
  );
};

export function Sidebar() {
  const [location] = useLocation();
  const isMobile = useMobile();
  const [showMobileSidebar, setShowMobileSidebar] = React.useState(false);

  const toggleMobileSidebar = () => {
    setShowMobileSidebar(!showMobileSidebar);
  };

  const sidebarContent = (
    <>
      <div className="flex items-center flex-shrink-0 px-4 mb-5">
        <span className="text-xl font-semibold text-blue-600">TaskScout</span>
      </div>
      <nav className="mt-5 flex-1 px-2 bg-white space-y-1">
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
        <NavItem href="#" icon={<Globe size={20} />} isActive={false}>
          Web Scraping
        </NavItem>
        <NavItem href="#" icon={<Database size={20} />} isActive={false}>
          SQL Translator
        </NavItem>
        <NavItem href="#" icon={<Users size={20} />} isActive={false}>
          Team
        </NavItem>
        <NavItem href="#" icon={<Settings size={20} />} isActive={false}>
          Settings
        </NavItem>
      </nav>
    </>
  );

  if (isMobile) {
    return (
      <>
        {/* Mobile menu button */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden fixed top-4 left-4 z-50"
          onClick={toggleMobileSidebar}
        >
          <Menu />
        </Button>

        {/* Mobile sidebar */}
        {showMobileSidebar && (
          <div className="fixed inset-0 flex z-40">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-gray-600 bg-opacity-75"
              onClick={() => setShowMobileSidebar(false)}
            />

            {/* Sidebar */}
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
              <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
                {sidebarContent}
              </div>
              <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
                <div className="flex-shrink-0 group block">
                  <div className="flex items-center">
                    <div>
                      <Avatar>
                        <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt="Profile" />
                        <AvatarFallback>TC</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Tom Cook</p>
                      <p className="text-xs font-medium text-gray-500 group-hover:text-gray-700">Product Manager</p>
                    </div>
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
      <div className="flex flex-col w-64 border-r border-gray-200 bg-white">
        <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
          {sidebarContent}
        </div>
        <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
          <div className="flex-shrink-0 group block">
            <div className="flex items-center">
              <div>
                <Avatar>
                  <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt="Profile" />
                  <AvatarFallback>TC</AvatarFallback>
                </Avatar>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Tom Cook</p>
                <p className="text-xs font-medium text-gray-500 group-hover:text-gray-700">Product Manager</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
