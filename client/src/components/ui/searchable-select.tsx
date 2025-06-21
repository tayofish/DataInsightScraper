import React, { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export interface SearchableSelectOption {
  value: string | number;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string | number | (string | number)[];
  onValueChange: (value: string | number | (string | number)[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  emptyMessage?: string;
  allowClear?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search options...",
  multiple = false,
  disabled = false,
  className,
  emptyMessage = "No options found.",
  allowClear = true,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Normalize value to array for consistent handling
  const normalizedValue = multiple 
    ? Array.isArray(value) ? value : (value !== undefined && value !== null ? [value] : [])
    : value;

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!searchValue) return options;
    return options.filter(option =>
      option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
      option.description?.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [options, searchValue]);

  // Get selected options for display
  const selectedOptions = useMemo(() => {
    if (multiple) {
      const selectedValues = Array.isArray(normalizedValue) ? normalizedValue : [];
      return options.filter(option => selectedValues.includes(option.value));
    } else {
      return options.filter(option => option.value === normalizedValue);
    }
  }, [options, normalizedValue, multiple]);

  const handleSelect = (selectedValue: string | number) => {
    if (multiple) {
      const currentValues = Array.isArray(normalizedValue) ? normalizedValue : [];
      const newValues = currentValues.includes(selectedValue)
        ? currentValues.filter(v => v !== selectedValue)
        : [...currentValues, selectedValue];
      onValueChange(newValues);
    } else {
      onValueChange(selectedValue);
      setOpen(false);
    }
    setSearchValue("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(multiple ? [] : "");
  };

  const handleRemoveTag = (valueToRemove: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (multiple && Array.isArray(normalizedValue)) {
      const newValues = normalizedValue.filter(v => v !== valueToRemove);
      onValueChange(newValues);
    }
  };

  const displayText = () => {
    if (multiple) {
      if (selectedOptions.length === 0) return placeholder;
      if (selectedOptions.length === 1) return selectedOptions[0].label;
      return `${selectedOptions.length} selected`;
    } else {
      return selectedOptions.length > 0 ? selectedOptions[0].label : placeholder;
    }
  };

  const hasValue = multiple 
    ? Array.isArray(normalizedValue) && normalizedValue.length > 0
    : normalizedValue !== undefined && normalizedValue !== null && normalizedValue !== "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !hasValue && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {multiple && selectedOptions.length > 1 ? (
              <div className="flex flex-wrap gap-1 flex-1">
                {selectedOptions.slice(0, 2).map((option) => (
                  <Badge
                    key={option.value}
                    variant="secondary"
                    className="text-xs px-1 py-0"
                  >
                    {option.label}
                    <button
                      onClick={(e) => handleRemoveTag(option.value, e)}
                      className="ml-1 hover:bg-muted-foreground/20 rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {selectedOptions.length > 2 && (
                  <Badge variant="secondary" className="text-xs px-1 py-0">
                    +{selectedOptions.length - 2} more
                  </Badge>
                )}
              </div>
            ) : (
              <span className="truncate">{displayText()}</span>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            {hasValue && allowClear && (
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-muted-foreground/20"
                onClick={handleClear}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="max-h-60 overflow-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredOptions.map((option) => {
                  const isSelected = multiple
                    ? Array.isArray(normalizedValue) && normalizedValue.includes(option.value)
                    : normalizedValue === option.value;

                  return (
                    <div
                      key={option.value}
                      onClick={() => handleSelect(option.value)}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                        isSelected && "bg-accent text-accent-foreground"
                      )}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{option.label}</div>
                        {option.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {option.description}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}