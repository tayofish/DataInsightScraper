import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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

  const options = [
    ...(includeAll ? [{
      value: "-2",
      label: "All Users",
      avatar: (
        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
          <span className="text-blue-600 text-xs">All</span>
        </div>
      )
    }] : []),
    ...(includeUnassigned ? [{
      value: "-1",
      label: "Unassigned",
      avatar: (
        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
          <span className="text-gray-500 text-xs">+</span>
        </div>
      )
    }] : []),
    ...users.map((user) => ({
      value: user.id.toString(),
      label: user.name,
      avatar: (
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.avatar || ""} alt={user.name} />
          <AvatarFallback>
            {user.name.split(' ').map(n => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
      )
    }))
  ];

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <SearchableSelect
            options={options}
            value={field.value?.toString() || ""}
            placeholder={placeholder}
            searchPlaceholder="Search users..."
            emptyText="No users found."
            onValueChange={(value) => {
              if (value === "-1") {
                field.onChange(null);
              } else if (value === "-2") {
                field.onChange(-2);
              } else if (value === "") {
                field.onChange(includeAll ? -2 : null);
              } else {
                field.onChange(parseInt(value));
              }
            }}
          />
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
