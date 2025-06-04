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

  // Debug logging
  React.useEffect(() => {
    console.log(`SearchableSelect ${name} - isOpen changed to:`, isOpen);
  }, [isOpen, name]);

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSelectedOption = (value: string | number | null) => {
    if (!value && value !== 0) return null;
    // Convert value to string for comparison since options have string values
    const stringValue = value.toString();
    return options.find(option => option.value === stringValue);
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
                    console.log(`SearchableSelect ${name} button clicked - current isOpen:`, isOpen);
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
                  <div className="absolute top-full left-0 right-0 z-[9999] mt-2 bg-white border border-gray-200 rounded-lg shadow-xl backdrop-blur-sm max-h-64 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
                    <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder={searchPlaceholder}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all duration-200"
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-auto py-1">
                      {filteredOptions.length > 0 ? (
                        filteredOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 hover:text-blue-900 text-left transition-all duration-150 group border-l-2 border-l-transparent hover:border-l-blue-500"
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
                            <div className="flex-shrink-0">
                              {option.icon}
                            </div>
                            <span className="text-sm font-medium flex-grow">{option.label}</span>
                            {(name === 'projectId' || name === 'categoryId' || name === 'departmentId' ? 
                              (field.value === null && option.value === '-1') || 
                              (field.value?.toString() === option.value) :
                              field.value === option.value
                            ) && (
                              <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-gray-500 text-sm text-center">
                          <div className="text-gray-400 mb-1">No results found</div>
                          <div className="text-xs text-gray-400">{emptyText}</div>
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