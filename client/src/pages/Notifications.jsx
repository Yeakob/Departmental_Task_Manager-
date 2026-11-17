import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, Circle, CircleDot } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import Pagination from '@/components/common/Pagination';
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/States';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { UserAvatar, Tooltip } from '@/components/ui/misc';
import { useNotificationsQuery, useMarkReadMutation, useMarkUnreadMutation, useMarkAllReadMutation, useDeleteNotificationMutation } from '@/services/endpoints';
import { cn, fmtDateTime, timeAgo } from '@/lib/utils';

const TYPES = {
  '': 'All types', task_assigned: 'Assignments', task_reassigned: 'Reassignments', deadline_approaching: 'Deadline reminders', task_overdue: 'Overdue',
  comment: 'Comments', mention: 'Mentions', status_changed: 'Status changes', approval_requested: 'Approval requests', approval_decided: 'Approval decisions',
  extension_requested: 'Extension requests', extension_decided: 'Extension decisions', meeting_invited: 'Meetings', announcement: 'Announcements', task_completed: 'Completions',
};

export default function Notifications() {
  const navigate = useNavigate();
  const [unread, setUnread] = useState(false);
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const query = useNotificationsQuery({ unread: unread ? 'true' : undefined, type, page, limit: 25 });
  const [markRead] = useMarkReadMutation();
  const [markUnread] = useMarkUnreadMutation();
  const [markAll] = useMarkAllReadMutation();
  const [remove] = useDeleteNotificationMutation();
  const items = query.data?.items || [];
  const unreadCount = query.data?.meta?.unread || 0;

  return (
    <div>
      <PageHeader title="Notifications" description={unreadCount ? `${unreadCount} unread` : 'You’re all caught up.'} actions={<Button variant="outline" onClick={() => markAll()} disabled={!unreadCount}><CheckCheck /> Mark all as read</Button>} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5 text-sm">
          {[[false, 'All'], [true, 'Unread']].map(([v, l]) => <button key={l} onClick={() => { setUnread(v); setPage(1); }} className={cn('rounded px-3 py-1', unread === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{l}</button>)}
        </div>
        <Select className="w-auto" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Type">{Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        <p className="ml-auto text-xs text-muted-foreground">Choose what you’re notified about in Settings, Notifications.</p>
      </div>
      <Panel className="overflow-hidden">
        {query.isLoading ? <RowsSkeleton /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : !items.length ? (
          <EmptyState icon={Bell} title={unread ? 'No unread notifications' : 'No notifications yet'} description="Assignments, reminders, comments and approvals show up here." />
        ) : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n._id} className={cn('group flex items-start gap-3 px-4 py-3', !n.readAt && 'bg-primary-soft/40')}>
                <UserAvatar user={n.actor || { name: 'DWMT' }} size={32} />
                <button className="min-w-0 flex-1 text-left" onClick={() => { if (!n.readAt) markRead(n._id); if (n.link) navigate(n.link); }}>
                  <p className={cn('text-sm', !n.readAt && 'font-medium')}>{n.title}</p>
                  {n.message && <p className="mt-0.5 max-w-[80ch] text-sm text-muted-foreground">{n.message}</p>}
                  <p className="mt-1 text-xs text-muted-foreground" title={fmtDateTime(n.createdAt)}>{timeAgo(n.createdAt)}{n.emailedAt && ', also emailed'}</p>
                </button>
                <div className="flex gap-1">
                  <Tooltip content={n.readAt ? 'Mark as unread' : 'Mark as read'}>
                    <Button variant="ghost" size="icon-sm" aria-label={n.readAt ? 'Mark as unread' : 'Mark as read'} onClick={() => (n.readAt ? markUnread(n._id) : markRead(n._id))}>{n.readAt ? <Circle /> : <CircleDot className="text-primary" />}</Button>
                  </Tooltip>
                  <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => remove(n._id)}><Trash2 /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination meta={query.data?.meta} onPage={setPage} />
      </Panel>
    </div>
  );
}
