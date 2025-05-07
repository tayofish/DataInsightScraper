import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { TaskUpdate, User } from '@shared/schema';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, AtSign, History, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TaskUpdateHistoryProps {
  taskId: number;
}

export default function TaskUpdateHistory({ taskId }: TaskUpdateHistoryProps) {
  const [activeTab, setActiveTab] = useState<string>('all');

  const { data: updates, isLoading: isUpdatesLoading } = useQuery({
    queryKey: ['/api/tasks', taskId, 'updates'],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/updates`);
      if (!res.ok) throw new Error('Failed to fetch task updates');
      return res.json() as Promise<(TaskUpdate & { user?: User })[]>;
    },
    enabled: !!taskId
  });

  const { data: mentions, isLoading: isMentionsLoading } = useQuery({
    queryKey: ['/api/tasks', taskId, 'mentions'],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/mentions`);
      if (!res.ok) throw new Error('Failed to fetch mentions');
      return res.json() as Promise<(TaskUpdate & { user?: User })[]>;
    },
    enabled: !!taskId
  });

  if (isUpdatesLoading || isMentionsLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const filteredUpdates = activeTab === 'all' 
    ? updates 
    : activeTab === 'mentions' 
      ? mentions 
      : updates?.filter(update => update.updateType !== 'Mention');

  return (
    <div className="space-y-4">
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="all" className="flex items-center gap-1">
            <History className="h-4 w-4" />
            <span>All Updates</span>
          </TabsTrigger>
          <TabsTrigger value="changes" className="flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            <span>Changes</span>
          </TabsTrigger>
          <TabsTrigger value="mentions" className="flex items-center gap-1">
            <AtSign className="h-4 w-4" />
            <span>Mentions</span>
            {mentions && mentions.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {mentions.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 h-[500px] overflow-auto pr-2">
          <TabsContent value="all" className="h-full">
            <UpdateList updates={updates || []} />
          </TabsContent>

          <TabsContent value="changes" className="h-full">
            <UpdateList updates={(updates || []).filter(update => update.updateType !== 'Mention')} />
          </TabsContent>

          <TabsContent value="mentions" className="h-full">
            <UpdateList updates={mentions || []} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

interface UpdateListProps {
  updates: (TaskUpdate & { user?: User })[];
}

function UpdateList({ updates }: UpdateListProps) {
  if (updates.length === 0) {
    return (
      <Card className="border border-dashed">
        <CardContent className="flex items-center justify-center p-6">
          <p className="text-muted-foreground text-sm">No updates available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {updates.map(update => (
        <UpdateItem key={update.id} update={update} />
      ))}
    </div>
  );
}

interface UpdateItemProps {
  update: TaskUpdate & { user?: User };
}

function UpdateItem({ update }: UpdateItemProps) {
  const updateTime = update.createdAt ? format(new Date(update.createdAt), 'MMM d, yyyy h:mm a') : '';
  
  // Determine appearance based on update type
  const isMention = update.updateType === 'Mention';
  const updateIcon = isMention ? <AtSign className="h-4 w-4" /> : <History className="h-4 w-4" />;
  
  // Format message based on update type
  let message = update.comment || 'Updated task';
  let changeDetails = null;
  
  if (!isMention && update.previousValue && update.newValue) {
    // For changes, show before/after values
    changeDetails = (
      <div className="mt-2 text-xs flex gap-2 items-center">
        <span className="line-through text-muted-foreground">{update.previousValue}</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-medium">{update.newValue}</span>
      </div>
    );
  }
  
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={update.user?.avatar || ''} alt={update.user?.name || 'User'} />
            <AvatarFallback>{update.user?.name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">{update.user?.name || 'Unknown user'}</span>
                <Badge variant={isMention ? "secondary" : "outline"} className="flex items-center gap-1">
                  {updateIcon}
                  <span>{update.updateType}</span>
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">{updateTime}</span>
            </div>
            
            <p className="mt-1 text-sm">{message}</p>
            {changeDetails}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}