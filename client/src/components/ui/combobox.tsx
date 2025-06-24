import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxProps {
  options: Array<{ value: string; label: string }>
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  emptyText = "No option found.",
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)

  const selectedOption = options.find((option) => option.value === value)

  const handleSelect = (selectedValue: string) => {
    const option = options.find(opt => opt.label === selectedValue)
    if (option) {
      onValueChange(option.value === value ? "" : option.value)
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "hover:bg-accent hover:text-accent-foreground cursor-pointer",
            disabled && "cursor-not-allowed opacity-50 pointer-events-none",
            className
          )}
          disabled={disabled}
          aria-expanded={open}
          role="combobox"
        >
          <span className={selectedOption?.label ? "text-foreground" : "text-muted-foreground"}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
          <CommandEmpty>{emptyText}</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.label}
                onSelect={handleSelect}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === option.value ? "opacity-100" : "opacity-0"
                  )}
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}