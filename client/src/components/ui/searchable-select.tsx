import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SearchableSelectOption {
  value: string;
  label: string;
  avatar?: React.ReactNode;
  icon?: React.ReactNode;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function SearchableSelect({
  options,
  value,
  placeholder = "Select option...",
  emptyText = "No option found.",
  searchPlaceholder = "Search...",
  onValueChange,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((option) => option.value === value);

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (selectedValue: string) => {
    onValueChange?.(selectedValue);
    setOpen(false);
    setSearch("");
  };

  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  const handleToggle = () => {
    if (!open) {
      updateDropdownPosition();
    }
    setOpen(!open);
    if (!open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    };

    const handleScroll = () => {
      if (open) {
        updateDropdownPosition();
      }
    };

    const handleResize = () => {
      if (open) {
        updateDropdownPosition();
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open]);

  const dropdownContent = open ? (
    <div 
      ref={dropdownRef}
      className="fixed z-[99999] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        maxHeight: '300px'
      }}
    >
      <div className="p-2 border-b border-slate-200 dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            ref={inputRef}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 border-slate-200 dark:border-slate-600"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      <div className="max-h-64 overflow-y-auto">
        {filteredOptions.length === 0 ? (
          <div className="p-4 text-center text-slate-500">{emptyText}</div>
        ) : (
          filteredOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className="w-full flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-left"
            >
              <Check
                className={cn(
                  "h-4 w-4",
                  value === option.value ? "opacity-100" : "opacity-0"
                )}
              />
              {option.avatar && option.avatar}
              {option.icon && option.icon}
              <span className="truncate">{option.label}</span>
            </button>
          ))
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button
        ref={buttonRef}
        variant="outline"
        role="combobox"
        aria-expanded={open}
        onClick={handleToggle}
        className={cn("w-full justify-between h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700", className)}
      >
        <div className="flex items-center gap-2">
          {selectedOption?.avatar && selectedOption.avatar}
          {selectedOption?.icon && selectedOption.icon}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </>
  );
}