import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { Control } from 'react-hook-form';

interface AvatarFieldProps {
  control: Control<any>;
  name: string;
  label: string;
  placeholder?: string;
  includeUnassigned?: boolean;
  includeAll?: boolean;
}

export function AvatarField({
  control,
  name,
  label,
  placeholder = "Select user",
  includeUnassigned = false,
  includeAll = false,
}: AvatarFieldProps) {
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
            value={field.value?.toString() || ""}
            onValueChange={(value) => {
              // Convert to number or null
              if (value === "-1") {
                field.onChange(null);
              } else if (value === "-2") {
                field.onChange(-2); // Special value for "All users"
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
              {includeAll && (
                <SelectItem value="-2">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                      <span className="text-blue-600 text-xs">All</span>
                    </div>
                    <span>All Users</span>
                  </div>
                </SelectItem>
              )}
              {includeUnassigned && (
                <SelectItem value="-1">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-2">
                      <span className="text-gray-500 text-xs">+</span>
                    </div>
                    <span>Unassigned</span>
                  </div>
                </SelectItem>
              )}
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id.toString()}>
                  <div className="flex items-center">
                    <Avatar className="h-8 w-8 mr-2">
                      <AvatarImage src={user.avatar || ""} alt={user.name} />
                      <AvatarFallback>
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span>{user.name}</span>
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
