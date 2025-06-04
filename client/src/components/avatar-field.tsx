import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Check, ChevronsUpDown, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Control } from 'react-hook-form';
import { User } from '@shared/schema';

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
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // Clear cache on mount to handle deleted users
  React.useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/users'] });
  }, [queryClient]);
  
  // Fetch users data - force fresh data to handle deleted users
  const { data: users = [], isLoading, error } = useQuery<User[]>({
    queryKey: ['/api/users'],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
  });

  // Debug logging
  React.useEffect(() => {
    console.log("AvatarField Debug:", {
      isLoading,
      usersCount: users.length,
      error: error?.message,
      hasUsers: users.length > 0,
      fieldValue: name
    });
  }, [isLoading, users.length, error, name]);

  const getSelectedUser = (value: number | null) => {
    if (!value) return null;
    const foundUser = users.find(user => user.id === value);
    
    // If user was deleted but still referenced, clear the field
    if (!foundUser && value) {
      console.log("User with ID", value, "not found. Clearing field value.");
      return null;
    }
    
    return foundUser;
  };

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
          <FormItem className="flex flex-col">
            <FormLabel>{label}</FormLabel>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="justify-between"
                  >
                    {selectedUser ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={selectedUser.avatar || undefined} alt={selectedUser.name || selectedUser.username} />
                          <AvatarFallback className="text-xs">
                            {selectedUser.name 
                              ? `${selectedUser.name.split(' ')[0][0]}${selectedUser.name.split(' ')[1]?.[0] || ''}`
                              : selectedUser.username.substring(0, 2)
                            }
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{selectedUser.name || selectedUser.username}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Search users..." />
                  <CommandEmpty>No user found.</CommandEmpty>
                  <CommandGroup>
                    {includeAll && (
                      <CommandItem
                        value="all_users"
                        onSelect={() => {
                          field.onChange(-1);
                          setOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <UserX className="h-5 w-5 text-gray-400" />
                          <span>All Users</span>
                        </div>
                        <Check
                          className={cn(
                            "ml-auto h-4 w-4",
                            field.value === -1 ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </CommandItem>
                    )}
                    
                    {includeUnassigned && (
                      <CommandItem
                        value="unassigned"
                        onSelect={() => {
                          field.onChange(null);
                          setOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <UserX className="h-5 w-5 text-gray-400" />
                          <span>Unassigned</span>
                        </div>
                        <Check
                          className={cn(
                            "ml-auto h-4 w-4",
                            !field.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </CommandItem>
                    )}
                    
                    {users.map((user) => (
                      <CommandItem
                        key={user.id}
                        value={`${user.name || user.username} ${user.username}`}
                        onSelect={() => {
                          field.onChange(user.id);
                          setOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-2 w-full">
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
                            <span className="text-xs text-muted-foreground">@{user.username}</span>
                          </div>
                        </div>
                        <Check
                          className={cn(
                            "ml-auto h-4 w-4",
                            field.value === user.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}