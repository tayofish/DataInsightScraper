import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, parseISO } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Clock, MapPin, Users, Settings, X } from 'lucide-react';
import { SimpleSelect } from '@/components/ui/simple-select';
import { useToast } from '@/hooks/use-toast';
import type { CalendarEvent, InsertCalendarEvent } from '@shared/schema';

// Event form schema
const eventFormSchema = z.object({
  title: z.string().min(1, "Event title is required"),
  description: z.string().optional(),
  startDate: z.string(),
  startTime: z.string(),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
  allDay: z.boolean().default(false),
  location: z.string().optional(),
  eventType: z.enum(['meeting', 'deadline', 'reminder', 'task', 'personal', 'holiday']).default('meeting'),
  color: z.string().default('#3b82f6'),
  departmentId: z.string().optional(),
  categoryId: z.string().optional(),
  reminderMinutes: z.string().optional(),
  attendees: z.array(z.string()).optional(),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

interface CalendarEventWithDetails extends CalendarEvent {
  creator?: { id: number; name: string; username: string };
  attendees?: Array<{ id: number; userId: number; status: string; user?: { id: number; name: string; username: string } }>;
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventWithDetails | null>(null);

  const { toast } = useToast();

  // Fetch calendar events
  const { data: events = [], isLoading: eventsLoading } = useQuery<CalendarEventWithDetails[]>({
    queryKey: ['/api/calendar/events', format(currentDate, 'yyyy-MM')]
  });

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ['/api/user']
  });

  // Fetch users for attendee selection
  const { data: users = [] } = useQuery<Array<{id: number, username: string, name: string}>>({
    queryKey: ['/api/users']
  });

  // Fetch departments for event categorization
  const { data: departments = [] } = useQuery({
    queryKey: ['/api/departments']
  });

  // Fetch categories for event categorization
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories']
  });

  // Create/update event form
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: '',
      description: '',
      startDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      startTime: '09:00',
      endTime: '10:00',
      allDay: false,
      eventType: 'meeting',
      color: '#3b82f6',
      departmentId: '',
      categoryId: '',
      attendees: [],
      reminderMinutes: '15',
    },
  });

  // Create/update event mutation
  const saveEventMutation = useMutation({
    mutationFn: async (eventData: EventFormValues) => {
      const startDateTime = eventData.allDay 
        ? new Date(eventData.startDate)
        : new Date(`${eventData.startDate}T${eventData.startTime}`);
      
      const endDateTime = eventData.allDay 
        ? (eventData.endDate ? new Date(eventData.endDate) : null)
        : (eventData.endTime ? new Date(`${eventData.endDate || eventData.startDate}T${eventData.endTime}`) : null);

      const payload = {
        title: eventData.title,
        description: eventData.description || null,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime?.toISOString() || null,
        allDay: eventData.allDay,
        location: eventData.location || null,
        eventType: eventData.eventType,
        color: eventData.color,
        departmentId: eventData.departmentId ? parseInt(eventData.departmentId) : null,
        categoryId: eventData.categoryId ? parseInt(eventData.categoryId) : null,
        attendees: eventData.attendees && Array.isArray(eventData.attendees) ? eventData.attendees : [],
        reminderMinutes: eventData.reminderMinutes && eventData.reminderMinutes !== 'no_reminder' ? parseInt(eventData.reminderMinutes) : null,
      };

      if (editingEvent) {
        return await apiRequest('PATCH', `/api/calendar/events/${editingEvent.id}`, payload);
      } else {
        return await apiRequest('POST', '/api/calendar/events', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      setIsCreateDialogOpen(false);
      setEditingEvent(null);
      form.reset();
      toast({
        title: "Success",
        description: `Event ${editingEvent ? 'updated' : 'created'} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${editingEvent ? 'update' : 'create'} event`,
        variant: "destructive",
      });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return await apiRequest('DELETE', `/api/calendar/events/${eventId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: EventFormValues) => {
    saveEventMutation.mutate(data);
  };

  const handleEditEvent = (event: CalendarEventWithDetails) => {
    setEditingEvent(event);
    const startDate = new Date(event.startDate);
    const endDate = event.endDate ? new Date(event.endDate) : null;
    
    form.reset({
      title: event.title,
      description: event.description || '',
      startDate: format(startDate, 'yyyy-MM-dd'),
      startTime: event.allDay ? '09:00' : format(startDate, 'HH:mm'),
      endDate: endDate ? format(endDate, 'yyyy-MM-dd') : '',
      endTime: endDate && !event.allDay ? format(endDate, 'HH:mm') : '',
      allDay: event.allDay,
      location: event.location || '',
      eventType: event.eventType as any,
      color: event.color || '#3b82f6',
      departmentId: event.departmentId?.toString() || '',
      categoryId: event.categoryId?.toString() || '',
      attendees: event.attendees?.map(a => a.userId.toString()) || [],
    });
    setIsCreateDialogOpen(true);
  };

  const handleDeleteEvent = (eventId: number) => {
    if (confirm('Are you sure you want to delete this event?')) {
      deleteEventMutation.mutate(eventId);
    }
  };

  // Calendar generation functions
  const generateCalendarDays = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(new Date(day));
      day = addDays(day, 1);
    }

    return days;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.startDate);
      return isSameDay(eventDate, date);
    });
  };

  const eventTypeColors = {
    meeting: 'bg-blue-500',
    deadline: 'bg-red-500',
    reminder: 'bg-yellow-500',
    task: 'bg-green-500',
    personal: 'bg-purple-500',
    holiday: 'bg-pink-500',
  };

  const calendarDays = generateCalendarDays();

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-8 w-8" />
            Calendar
          </h1>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(addDays(currentDate, view === 'month' ? -30 : view === 'week' ? -7 : -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-semibold min-w-[200px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(addDays(currentDate, view === 'month' ? 30 : view === 'week' ? 7 : 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-muted rounded-lg p-1">
            <Button
              variant={view === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('month')}
            >
              Month
            </Button>
            <Button
              variant={view === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('week')}
            >
              Week
            </Button>
            <Button
              variant={view === 'day' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('day')}
            >
              Day
            </Button>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingEvent(null);
                form.reset({
                  title: '',
                  description: '',
                  startDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                  startTime: '09:00',
                  endTime: '10:00',
                  allDay: false,
                  eventType: 'meeting',
                  color: '#3b82f6',
                  attendees: [],
                  reminderMinutes: '15',
                });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>{editingEvent ? 'Edit Event' : 'Create New Event'}</DialogTitle>
                <DialogDescription>
                  {editingEvent ? 'Update the event details below' : 'Fill in the details for your new calendar event'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="overflow-y-auto flex-1 px-1">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Event Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter event title" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Enter event description" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="allDay"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2 flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">All Day Event</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              This event lasts all day
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {!form.watch('allDay') && (
                      <FormField
                        control={form.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Time</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date (Optional)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {!form.watch('allDay') && (
                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Time</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="eventType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Type</FormLabel>
                          <FormControl>
                            <SimpleSelect
                              options={[
                                { value: "meeting", label: "Meeting" },
                                { value: "deadline", label: "Deadline" },
                                { value: "reminder", label: "Reminder" },
                                { value: "task", label: "Task" },
                                { value: "personal", label: "Personal" },
                                { value: "holiday", label: "Holiday" },
                              ]}
                              value={field.value || ""}
                              onValueChange={(value) => {
                                field.onChange(value);
                              }}
                              placeholder="Select event type"
                              disabled={false}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color</FormLabel>
                          <FormControl>
                            <Input type="color" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter event location" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="departmentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit</FormLabel>
                          <FormControl>
                            <SimpleSelect
                              options={[
                                { value: "no_department", label: "No Unit" },
                                ...departments.map((dept: any) => ({
                                  value: dept.id.toString(),
                                  label: dept.name,
                                }))
                              ]}
                              value={field.value || ""}
                              onValueChange={(value) => {
                                field.onChange(value);
                              }}
                              placeholder="Select unit"
                              disabled={false}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="categoryId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department</FormLabel>
                          <FormControl>
                            <SimpleSelect
                              options={[
                                { value: "no_category", label: "No Department" },
                                ...categories.map((cat: any) => ({
                                  value: cat.id.toString(),
                                  label: cat.name,
                                }))
                              ]}
                              value={field.value || ""}
                              onValueChange={(value) => {
                                field.onChange(value);
                              }}
                              placeholder="Select department"
                              disabled={false}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="attendees"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Invite Users</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <SimpleSelect
                                options={users?.filter(user => user.id !== currentUser?.id && !field.value?.includes(user.id.toString())).map((user: any) => ({
                                  value: user.id.toString(),
                                  label: `${user.name} (${user.username})`,
                                })) || []}
                                value=""
                                onValueChange={(value) => {
                                  if (value && !field.value?.includes(value)) {
                                    const newAttendees = [...(field.value || []), value];
                                    field.onChange(newAttendees);
                                  }
                                }}
                                placeholder="Select users to invite"
                                disabled={false}
                              />
                              
                              {field.value && field.value.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {field.value.map((userId: string) => {
                                    const user = users?.find((u: any) => u.id.toString() === userId);
                                    return user ? (
                                      <div
                                        key={userId}
                                        className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm"
                                      >
                                        <span>{user.name}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const newAttendees = field.value.filter((id: string) => id !== userId);
                                            field.onChange(newAttendees.length > 0 ? newAttendees : []);
                                          }}
                                          className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-sm p-0.5"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="reminderMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reminder</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Set reminder" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="no_reminder">No Reminder</SelectItem>
                              <SelectItem value="5">5 minutes before</SelectItem>
                              <SelectItem value="15">15 minutes before</SelectItem>
                              <SelectItem value="30">30 minutes before</SelectItem>
                              <SelectItem value="60">1 hour before</SelectItem>
                              <SelectItem value="1440">1 day before</SelectItem>
                              <SelectItem value="10080">1 week before</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                    <div className="flex justify-end space-x-2 pt-4 sticky bottom-0 bg-background border-t mt-6 -mx-1 px-1 py-4">
                      {editingEvent && (
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => handleDeleteEvent(editingEvent.id)}
                          disabled={deleteEventMutation.isPending}
                        >
                          Delete Event
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={saveEventMutation.isPending}>
                        {saveEventMutation.isPending ? 'Saving...' : editingEvent ? 'Update Event' : 'Create Event'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Calendar Grid */}
      {view === 'month' && (
        <Card>
          <CardContent className="p-6">
            {/* Week headers */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                const dayEvents = getEventsForDate(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);

                return (
                  <div
                    key={index}
                    className={`
                      min-h-[120px] p-2 border rounded-lg cursor-pointer transition-colors
                      ${isCurrentMonth ? 'bg-background' : 'bg-muted/50'}
                      ${isToday ? 'ring-2 ring-primary' : ''}
                      ${isSelected ? 'bg-primary/10' : ''}
                      hover:bg-muted
                    `}
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className={`text-sm font-medium mb-1 ${!isCurrentMonth ? 'text-muted-foreground' : ''}`}>
                      {format(day, 'd')}
                    </div>
                    
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className="text-xs p-1 rounded text-white truncate cursor-pointer"
                          style={{ backgroundColor: event.color || '#3b82f6' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditEvent(event);
                          }}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event List */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
          <CardDescription>
            Your scheduled events for {format(currentDate, 'MMMM yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="text-center py-8">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No events scheduled. Click "Add Event" to create your first event.
            </div>
          ) : (
            <div className="space-y-4">
              {events
                .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                .map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleEditEvent(event)}
                  >
                    <div
                      className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
                      style={{ backgroundColor: event.color || '#3b82f6' }}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className="font-medium">{event.title}</h3>
                        <Badge variant="outline" className={eventTypeColors[event.eventType as keyof typeof eventTypeColors]}>
                          {event.eventType}
                        </Badge>
                      </div>
                      
                      {event.description && (
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>
                            {event.allDay ? 'All Day' : format(new Date(event.startDate), 'h:mm a')}
                            {event.endDate && !event.allDay && ` - ${format(new Date(event.endDate), 'h:mm a')}`}
                          </span>
                        </div>
                        
                        {event.location && (
                          <div className="flex items-center space-x-1">
                            <MapPin className="h-4 w-4" />
                            <span>{event.location}</span>
                          </div>
                        )}
                        
                        {event.attendees && event.attendees.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <Users className="h-4 w-4" />
                            <span>{event.attendees.length} attendees</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}