import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format a date string to a readable format
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'No date';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (error) {
    return 'Invalid date';
  }
}

// Get priority color class
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high':
      return 'text-red-600';
    case 'medium':
      return 'text-amber-600';
    case 'low':
      return 'text-green-600';
    default:
      return 'text-gray-600';
  }
}

// Get the appropriate badge color based on task status
export function getStatusColor(status: string): string {
  switch (status) {
    case 'todo':
      return 'bg-gray-100 text-gray-800';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Check if a task is overdue
export function isTaskOverdue(dueDate: string | Date | null | undefined, status: string): boolean {
  if (!dueDate || status === 'completed') return false;
  
  try {
    const date = new Date(dueDate);
    const now = new Date();
    return date < now;
  } catch (error) {
    return false;
  }
}
