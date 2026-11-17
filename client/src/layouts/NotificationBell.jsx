import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/misc';
import { useNotificationsQuery, useUnreadCountQuery, useMarkReadMutation, useMarkAllReadMutation } from '@/services/endpoints';
import { cn, timeAgo } from '@/lib/utils';

export default function NotificationBell() {
  const navigate = useNavigate();
  const { data: count = 0 } = useUnreadCountQuery();
  const { data } = useNotificationsQuery({ limit: 8 });
  const [markRead] = useMarkReadMutation();
  const [markAll] = useMarkAllReadMutation();
  const items = data?.items || [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications${count ? `, ${count} unread` : ''}`} className="relative">
          <Bell />
          {count > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-highlight px-1 text-[10px] font-semibold leading-4 text-[#1b1a14] tabular">{count > 99 ? '99+' : count}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="font-medium">Notifications</p>
          <Button variant="ghost" size="sm" onClick={() => markAll()} disabled={!count}>
            <CheckCheck /> Mark all as read
          </Button>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">You’re all caught up.</li>}
          {items.map((n) => (
            <li key={n._id}>
              <button
                className={cn('flex w-full gap-3 border-b px-3 py-2.5 text-left last:border-0 hover:bg-accent', !n.readAt && 'bg-primary-soft/50')}
                onClick={() => {
                  if (!n.readAt) markRead(n._id);
                  if (n.link) navigate(n.link);
                }}
              >
                <UserAvatar user={n.actor || { name: 'DWMT' }} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug">{n.title}</span>
                  {n.message && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.message}</span>}
                  <span className="mt-1 block text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t p-2 text-center">
          <Link to="/notifications" className="text-sm font-medium text-primary hover:underline">See all notifications</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
