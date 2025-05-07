import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { type Control } from 'react-hook-form';
import { User } from '@shared/schema';

interface AvatarFieldProps {
  control: Control<any>;
  name: string;
  label: string;
  placeholder: string;
  includeUnassigned?: boolean;
}

export default function AvatarField({ 
  control, 
  name, 
  label, 
  placeholder, 
  includeUnassigned = false 
}: AvatarFieldProps) {
  // Fetch users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            value={field.value?.toString() || '-1'}
            onValueChange={(value) => {
              if (value === '-1') {
                field.onChange(null);
              } else {
                field.onChange(parseInt(value));
              }
            }}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {includeUnassigned && (
                <SelectItem value="-1">Unassigned</SelectItem>
              )}
              
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id.toString()}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user.avatar || undefined} alt={user.name || user.username} />
                      <AvatarFallback>{user.username?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <span>{user.name || user.username}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}