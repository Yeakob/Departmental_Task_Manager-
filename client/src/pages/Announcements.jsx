import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pin, PinOff, Pencil, Trash2, Megaphone } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import Pagination from '@/components/common/Pagination';
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/States';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox, UserAvatar } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RichTextEditor, RichTextView } from '@/components/common/RichText';
import { useAnnouncementsQuery, useCreateAnnouncementMutation, useUpdateAnnouncementMutation, useDeleteAnnouncementMutation, useRolesQuery } from '@/services/endpoints';
import { useAction, usePermissions } from '@/hooks';
import { fmtDateTime, timeAgo, toLocalInput, cn } from '@/lib/utils';

function AnnouncementDialog({ open, onOpenChange, item }) {
  const run = useAction();
  const { can } = usePermissions();
  const { data: roles = [] } = useRolesQuery(undefined, { skip: !open });
  const [create, cs] = useCreateAnnouncementMutation();
  const [update, us] = useUpdateAnnouncementMutation();
  const [f, setF] = useState({});
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!open) return;
    setErr('');
    setF(item ? { title: item.title, body: item.body, priority: item.priority, isPinned: item.isPinned, audienceRoles: item.audienceRoles || [], publishAt: toLocalInput(item.publishAt), expiresAt: toLocalInput(item.expiresAt) } : { title: '', body: '', priority: 'normal', isPinned: false, audienceRoles: [], publishAt: '', expiresAt: '' });
  }, [open, item]);
  const save = async () => {
    if (f.title.trim().length < 3) return setErr('Add a title.');
    if (!f.body.replace(/<[^>]+>/g, '').trim()) return setErr('Write the announcement text.');
    const body = { ...f, publishAt: f.publishAt ? new Date(f.publishAt).toISOString() : undefined, expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : null };
    if (await run(item ? update({ id: item._id, ...body }) : create(body), { success: item ? 'Announcement updated' : 'Announcement published' })) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit announcement' : 'New announcement'}</DialogTitle>
          <DialogDescription>Everyone in the audience gets an in-app notification. Important and urgent ones are emailed too.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Title" required><Input autoFocus value={f.title || ''} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Message" required><RichTextEditor value={f.body} onChange={(v) => setF({ ...f, body: v })} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Priority"><Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></Select></Field>
            <Field label="Publish at" help="Leave empty to publish now"><Input type="datetime-local" value={f.publishAt || ''} onChange={(e) => setF({ ...f, publishAt: e.target.value })} /></Field>
            <Field label="Remove after" help="Optional"><Input type="datetime-local" value={f.expiresAt || ''} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></Field>
          </div>
          <Field label="Audience" help="No roles selected means everyone in the department.">
            <div className="flex flex-wrap gap-1.5">
              {roles.filter((r) => r.key !== 'super_admin').map((r) => {
                const on = (f.audienceRoles || []).includes(r.key);
                return <button type="button" key={r.key} onClick={() => setF({ ...f, audienceRoles: on ? f.audienceRoles.filter((x) => x !== r.key) : [...f.audienceRoles, r.key] })} className={cn('rounded-full border px-2.5 py-1 text-xs', on ? 'border-primary bg-primary-soft text-primary' : 'hover:bg-accent')}>{r.name}</button>;
              })}
            </div>
          </Field>
          {can('announcement:manage') && <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!f.isPinned} onCheckedChange={(v) => setF({ ...f, isPinned: !!v })} /> Pin to the top as an important notice</label>}
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} loading={cs.isLoading || us.isLoading}>{item ? 'Save changes' : 'Publish'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Announcements() {
  const { can } = usePermissions();
  const run = useAction();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const query = useAnnouncementsQuery({ page, limit: 15, all: showAll ? 'true' : undefined });
  const [update] = useUpdateAnnouncementMutation();
  const [del] = useDeleteAnnouncementMutation();
  useEffect(() => { if (params.get('new')) { setDialog({}); setParams({}, { replace: true }); } }, [params, setParams]);
  const items = query.data?.items || [];

  return (
    <div>
      <PageHeader title="Announcements" description="Departmental notices. Pinned notices stay at the top until unpinned." actions={can('announcement:create') && <Button onClick={() => setDialog({})}><Plus /> New announcement</Button>} />
      {can('announcement:manage') && <label className="mb-3 flex items-center gap-2 text-sm"><Checkbox checked={showAll} onCheckedChange={(v) => setShowAll(!!v)} /> Include scheduled and expired announcements</label>}
      {query.isLoading ? <RowsSkeleton /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : !items.length ? (
        <Panel><EmptyState icon={Megaphone} title="No announcements" description="Notices from the chairman and coordinators appear here." /></Panel>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const scheduled = new Date(a.publishAt) > new Date();
            const expired = a.expiresAt && new Date(a.expiresAt) < new Date();
            return (
              <Panel key={a._id} className={cn('relative overflow-hidden', a.isPinned && 'border-highlight/50')}>
                {a.isPinned && <span className="absolute inset-y-0 left-0 w-1 bg-highlight" aria-hidden="true" />}
                <article className="p-5">
                  <header className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="flex flex-wrap items-center gap-2 text-md font-semibold">
                        {a.isPinned && <Pin className="h-4 w-4 text-highlight" aria-label="Pinned" />}
                        {a.title}
                        {a.priority !== 'normal' && <Badge variant={a.priority === 'urgent' ? 'destructive' : 'highlight'} className="capitalize">{a.priority}</Badge>}
                        {scheduled && <Badge variant="outline">Scheduled for {fmtDateTime(a.publishAt)}</Badge>}
                        {expired && <Badge variant="outline">Expired</Badge>}
                      </h2>
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><UserAvatar user={a.author} size={18} /> {a.author?.name}, {timeAgo(a.publishAt)}{a.audienceRoles?.length ? `, for ${a.audienceRoles.map((r) => r.replace(/_/g, ' ')).join(', ')}` : ''}</p>
                    </div>
                    {a.canEdit && (
                      <div className="flex gap-1">
                        {can('announcement:manage') && <Button variant="ghost" size="icon-sm" aria-label={a.isPinned ? 'Unpin' : 'Pin'} onClick={() => run(update({ id: a._id, isPinned: !a.isPinned }), { success: a.isPinned ? 'Unpinned' : 'Pinned' })}>{a.isPinned ? <PinOff /> : <Pin />}</Button>}
                        <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setDialog(a)}><Pencil /></Button>
                        <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setConfirm(a)}><Trash2 /></Button>
                      </div>
                    )}
                  </header>
                  <RichTextView html={a.body} className="mt-3" />
                </article>
              </Panel>
            );
          })}
          <Panel><Pagination meta={query.data?.meta} onPage={setPage} /></Panel>
        </div>
      )}
      <AnnouncementDialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)} item={dialog?._id ? dialog : null} />
      <ConfirmDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)} title={`Delete “${confirm?.title}”?`} confirmLabel="Delete" onConfirm={async () => { await run(del(confirm._id), { success: 'Announcement deleted' }); setConfirm(null); }} />
    </div>
  );
}
