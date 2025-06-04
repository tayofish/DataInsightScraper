import React, { useState } from 'react';
import { Control } from 'react-hook-form';
import { ChevronDown, Check, Search } from 'lucide-react';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

interface Option {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SearchableSelectProps {
  control: Control<any>;
  name: string;
  label: string;
  placeholder: string;
  options: Option[];
  searchPlaceholder?: string;
  emptyText?: string;
}

export default function SearchableSelect({
  control,
  name,
  label,
  placeholder,
  options,
  searchPlaceholder = "Search...",
  emptyText = "No options found"
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSelectedOption = (value: string | null) => {
    if (!value) return null;
    return options.find(option => option.value === value);
  };

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selectedOption = getSelectedOption(field.value);

        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <div className="relative">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                  }}
                >
                  <div className="flex items-center gap-2">
                    {selectedOption ? (
                      <>
                        {selectedOption.icon}
                        <span>{selectedOption.label}</span>
                      </>
                    ) : (
                      <span className="text-gray-500">{placeholder}</span>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
                
                {isOpen && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-hidden">
                    <div className="p-2 border-b border-gray-200">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder={searchPlaceholder}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-auto">
                      {filteredOptions.length > 0 ? (
                        filteredOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-left"
                            onClick={() => {
                              // Handle numeric conversion for ID fields
                              if (name === 'projectId' || name === 'categoryId' || name === 'departmentId') {
                                if (option.value === '-1') {
                                  field.onChange(null);
                                } else {
                                  field.onChange(parseInt(option.value));
                                }
                              } else {
                                field.onChange(option.value);
                              }
                              setIsOpen(false);
                              setSearchTerm('');
                            }}
                          >
                            {option.icon}
                            <span className="text-sm">{option.label}</span>
                            {(name === 'projectId' ? 
                              (field.value === null && option.value === '-1') || 
                              (field.value?.toString() === option.value) :
                              field.value === option.value
                            ) && (
                              <Check className="ml-auto h-4 w-4 text-blue-600" />
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-gray-500 text-sm">{emptyText}</div>
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