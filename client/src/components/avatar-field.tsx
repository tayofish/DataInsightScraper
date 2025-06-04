import React, { useState } from 'react';
import { Control } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Check, Search } from 'lucide-react';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface User {
  id: number;
  username: string;
  name?: string;
  avatar?: string;
}

interface AvatarFieldProps {
  control: Control<any>;
  name: string;
  label: string;
  placeholder: string;
  includeUnassigned?: boolean;
  includeAll?: boolean;
}

export default function AvatarField({ 
  control, 
  name, 
  label, 
  placeholder, 
  includeUnassigned = false,
  includeAll = false 
}: AvatarFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  // Clear cache on mount to handle deleted users
  React.useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/users'] });
  }, [queryClient]);
  
  // Fetch users data
  const { data: users = [], isLoading, error } = useQuery<User[]>({
    queryKey: ['/api/users'],
    staleTime: 0,
    refetchOnMount: true,
  });

  // Debug logging
  React.useEffect(() => {
    console.log("AvatarField Debug:", {
      isLoading,
      usersCount: users.length,
      error: error?.message,
      hasUsers: users.length > 0,
      fieldName: name
    });
  }, [isLoading, users.length, error, name]);

  const getSelectedUser = (value: number | null) => {
    if (!value) return null;
    const foundUser = users.find(user => user.id === value);
    
    if (!foundUser && value) {
      console.log("User with ID", value, "not found. Clearing field value.");
      return null;
    }
    
    return foundUser;
  };

  // Filter users based on search term
  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selectedUser = getSelectedUser(field.value);
        
        // Auto-clear field if referenced user was deleted
        React.useEffect(() => {
          if (field.value && !selectedUser && users.length > 0) {
            console.log("Clearing orphaned user reference:", field.value);
            field.onChange(null);
          }
        }, [field.value, selectedUser, users.length, field]);
        
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <div className="relative">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onClick={(e) => {
                    console.log("Simple button clicked - toggling dropdown");
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                  }}
                >
                  <div className="flex items-center gap-2">
                    {selectedUser ? (
                      <>
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={selectedUser.avatar || undefined} alt={selectedUser.name || selectedUser.username} />
                          <AvatarFallback className="text-xs">
                            {selectedUser.name 
                              ? `${selectedUser.name.split(' ')[0][0]}${selectedUser.name.split(' ')[1]?.[0] || ''}`
                              : selectedUser.username.substring(0, 2)
                            }
                          </AvatarFallback>
                        </Avatar>
                        <span>{selectedUser.name || selectedUser.username}</span>
                      </>
                    ) : (
                      <span className="text-gray-500">{placeholder}</span>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
                
                {isOpen && (
                  <div className="absolute top-full left-0 right-0 z-[9999] mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-hidden">
                    {/* Search Input */}
                    <div className="sticky top-0 bg-white border-b border-gray-100 p-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search users..."
                          className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    
                    <div className="max-h-48 overflow-auto">
                      {includeAll && (
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-left"
                          onClick={() => {
                            field.onChange(-1);
                            setIsOpen(false);
                            setSearchTerm('');
                          }}
                        >
                          <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 text-xs">All</span>
                          </div>
                          <span>All Users</span>
                          {field.value === -1 && <Check className="ml-auto h-4 w-4 text-blue-600" />}
                        </button>
                      )}
                      
                      {includeUnassigned && (
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-left"
                          onClick={() => {
                            field.onChange(null);
                            setIsOpen(false);
                            setSearchTerm('');
                          }}
                        >
                          <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-gray-500 text-xs">-</span>
                          </div>
                          <span>Unassigned</span>
                          {!field.value && <Check className="ml-auto h-4 w-4 text-blue-600" />}
                        </button>
                      )}
                      
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-left"
                            onClick={() => {
                              field.onChange(user.id);
                              setIsOpen(false);
                              setSearchTerm('');
                            }}
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={user.avatar || undefined} alt={user.name || user.username} />
                              <AvatarFallback className="text-xs">
                                {user.name 
                                  ? `${user.name.split(' ')[0][0]}${user.name.split(' ')[1]?.[0] || ''}`
                                  : user.username.substring(0, 2)
                                }
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm">{user.name || user.username}</span>
                              {user.name && (
                                <span className="text-xs text-gray-500">@{user.username}</span>
                              )}
                            </div>
                            {field.value === user.id && <Check className="ml-auto h-4 w-4 text-blue-600" />}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-gray-500 text-sm">
                          {searchTerm ? 'No users match your search' : 'No users found'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}