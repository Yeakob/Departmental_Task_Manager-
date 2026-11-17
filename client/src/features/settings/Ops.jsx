import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Play, Pause, Trash2, RotateCcw, Download, Repeat } from 'lucide-react';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { AvatarGroup, UserAvatar } from '@/components/ui/misc';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/States';
import Pagination from '@/components/common/Pagination';
import UserPicker from '@/components/common/UserPicker';
import { useRecurringQuery, useCreateRecurringMutation, useUpdateRecurringMutation, useDeleteRecurringMutation, useRunRecurringMutation, useAuditLogsQuery, useRecycleBinQuery, useRestoreTaskMutation, useCategoriesQuery, useCommitteesQuery } from '@/services/endpoints';
import { useAction, useDownload } from '@/hooks';
import { fmtDateTime, timeAgo, PRIORITIES, PRIORITY_META } from '@/lib/utils';

const FREQ = { daily: 'Every day', weekly: 'Every week', monthly: 'Every month', semester: 'Every semester (6 months)', annually: 'Every year' };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function RecurringDialog({ open, onOpenChange }) {
  const run = useAction();
  const [create, st] = useCreateRecurringMutation();
  const { data: categories = [] } = useCategoriesQuery(undefined, { skip: !open });
  const { data: committees } = useCommitteesQuery({ limit: 100 }, { skip: !open });
  const [f, setF] = useState({ name: '', title: '', description: '', priority: 'medium', assignees: [], category: '', committee: '', durationDays: 7, frequency: 'monthly', dayOfWeek: 0, dayOfMonth: 1, startAt: '', estimatedHours: 0 });
  const save = async () => {
    const body = {
      name: f.name || f.title, frequency: f.frequency,
      ...(f.frequency === 'weekly' ? { dayOfWeek: Number(f.dayOfWeek) } : {}),
      ...(['monthly', 'semester', 'annually'].includes(f.frequency) ? { dayOfMonth: Number(f.dayOfMonth) } : {}),
      startAt: f.startAt ? new Date(f.startAt).toISOString() : undefined,
      template: { title: f.title, description: f.description, priority: f.priority, assignees: f.assignees, category: f.category || null, committee: f.committee || null, durationDays: Number(f.durationDays) || 7, estimatedHours: Number(f.estimatedHours) || 0 },
    };
    if (await run(create(body), { success: 'Recurring task scheduled' })) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>New recurring task</DialogTitle><DialogDescription>A fresh task is created and assigned automatically on each occurrence.</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Task title" className="sm:col-span-2" required><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Submit monthly lab inventory report" /></Field>
          <Field label="Instructions" className="sm:col-span-2"><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Assign to" className="sm:col-span-2" required><UserPicker value={f.assignees} onChange={(v) => setF({ ...f, assignees: v })} /></Field>
          <Field label="Repeats"><Select value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })}>{Object.entries(FREQ).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          {f.frequency === 'weekly' && <Field label="On"><Select value={f.dayOfWeek} onChange={(e) => setF({ ...f, dayOfWeek: e.target.value })}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</Select></Field>}
          {['monthly', 'semester', 'annually'].includes(f.frequency) && <Field label="Day of month"><Input type="number" min="1" max="28" value={f.dayOfMonth} onChange={(e) => setF({ ...f, dayOfMonth: e.target.value })} /></Field>}
          <Field label="First occurrence" help="Leave empty to start at the next matching date"><Input type="datetime-local" value={f.startAt} onChange={(e) => setF({ ...f, startAt: e.target.value })} /></Field>
          <Field label="Days to complete" help="Deadline is this many days after each occurrence"><Input type="number" min="1" max="365" value={f.durationDays} onChange={(e) => setF({ ...f, durationDays: e.target.value })} /></Field>
          <Field label="Priority"><Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}</Select></Field>
          <Field label="Estimated hours"><Input type="number" min="0" value={f.estimatedHours} onChange={(e) => setF({ ...f, estimatedHours: e.target.value })} /></Field>
          <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">Uncategorized</option>{categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></Field>
          <Field label="Committee"><Select value={f.committee} onChange={(e) => setF({ ...f, committee: e.target.value })}><option value="">None</option>{(committees?.items || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></Field>
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} loading={st.isLoading} disabled={f.title.trim().length < 3 || !f.assignees.length}>Schedule</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Recurring() {
  const run = useAction();
  const { data = [], isLoading, isError, error, refetch } = useRecurringQuery();
  const [update] = useUpdateRecurringMutation();
  const [del] = useDeleteRecurringMutation();
  const [runNow] = useRunRecurringMutation();
  const [open, setOpen] = useState(false);
  return (
    <Panel className="overflow-hidden">
      <PanelHeader title="Recurring tasks" description="Routine work such as monthly reports or semester course-file collection. For one-off reuse, save a task as a template instead." actions={<Button size="sm" onClick={() => setOpen(true)}><Plus /> New recurring task</Button>} />
      {isLoading ? <RowsSkeleton /> : isError ? <ErrorState error={error} onRetry={refetch} /> : !data.length ? <EmptyState icon={Repeat} title="Nothing recurring yet" description="Set up routine departmental work once and DWMT creates the task each time it’s due." /> : (
        <ul className="divide-y">
          {data.map((r) => (
            <li key={r._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.template.title}</p>
                <p className="text-xs text-muted-foreground">{FREQ[r.frequency]}{r.frequency === 'weekly' && r.dayOfWeek != null ? ` on ${DAYS[r.dayOfWeek]}` : ''}. {r.isActive ? `Next: ${fmtDateTime(r.nextRunAt)}` : 'Paused'}{r.lastRunAt ? `. Last created ${timeAgo(r.lastRunAt)}` : ''}</p>
              </div>
              <AvatarGroup users={r.template.assignees} />
              <Button size="sm" variant="ghost" onClick={() => run(runNow(r._id), { success: 'Task created now' })}>Create now</Button>
              <Button size="icon-sm" variant="ghost" aria-label={r.isActive ? 'Pause' : 'Resume'} onClick={() => run(update({ id: r._id, isActive: !r.isActive }), { success: r.isActive ? 'Paused' : 'Resumed' })}>{r.isActive ? <Pause /> : <Play />}</Button>
              <Button size="icon-sm" variant="ghost" aria-label="Delete" onClick={() => run(del(r._id), { success: 'Recurring task removed' })}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t px-4 py-2.5 text-sm text-muted-foreground">Templates live in <Link to="/tasks?tab=templates" className="text-primary hover:underline">All tasks, Templates</Link>.</div>
      <RecurringDialog open={open} onOpenChange={setOpen} />
    </Panel>
  );
}

export function Audit() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const q = useAuditLogsQuery({ page, limit: 30, action, entityType });
  return (
    <Panel className="overflow-hidden">
      <PanelHeader title="Audit trail" description="Who changed what, and when. Records can’t be edited or deleted." />
      <div className="flex flex-wrap gap-2 border-b px-4 py-3">
        <Select className="w-auto" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} aria-label="Record type">
          <option value="">All records</option>
          {['Task', 'Project', 'Committee', 'Meeting', 'Document', 'Announcement', 'User', 'Role', 'Department', 'System'].map((t) => <option key={t}>{t}</option>)}
        </Select>
        <Input className="w-56" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} placeholder="Action, e.g. task.delete" />
      </div>
      {q.isLoading ? <RowsSkeleton /> : q.isError ? <ErrorState error={q.error} onRetry={q.refetch} /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2 font-medium">When</th><th className="px-3 py-2 font-medium">Who</th><th className="px-3 py-2 font-medium">Action</th><th className="px-3 py-2 font-medium">Record</th><th className="px-3 py-2 font-medium">IP address</th></tr></thead>
            <tbody className="divide-y">
              {q.data.items.map((a) => (
                <tr key={a._id}>
                  <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{fmtDateTime(a.createdAt)}</td>
                  <td className="px-3 py-2"><span className="flex items-center gap-2"><UserAvatar user={a.actor || { name: 'System' }} size={20} />{a.actor?.name || 'System'}</span></td>
                  <td className="px-3 py-2"><span className="task-code">{a.action}</span></td>
                  <td className="px-3 py-2 text-muted-foreground">{a.entityType}{a.after?.title ? `: ${a.after.title}` : a.after?.taskId ? `: ${a.after.taskId}` : ''}</td>
                  <td className="px-3 py-2 text-muted-foreground">{a.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={q.data?.meta} onPage={setPage} />
    </Panel>
  );
}

export function RecycleBin() {
  const run = useAction();
  const { data = [], isLoading } = useRecycleBinQuery();
  const [restore] = useRestoreTaskMutation();
  return (
    <Panel className="overflow-hidden">
      <PanelHeader title="Recycle bin" description="Deleted tasks are kept here so authorized users can restore them." />
      {isLoading ? <RowsSkeleton /> : !data.length ? <EmptyState icon={Trash2} title="The recycle bin is empty" /> : (
        <ul className="divide-y">
          {data.map((t) => (
            <li key={t._id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <span className="task-code">{t.taskId}</span>
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <span className="text-xs text-muted-foreground">Deleted {timeAgo(t.deletedAt)}{t.deletedBy ? ` by ${t.deletedBy.name}` : ''}</span>
              <Button size="sm" variant="outline" onClick={() => run(restore(t._id), { success: `${t.taskId} restored` })}><RotateCcw /> Restore</Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function DataExport() {
  const download = useDownload();
  const [busy, setBusy] = useState(false);
  return (
    <Panel>
      <PanelHeader title="Data export and backup" description="Download a complete JSON copy of your department’s records." />
      <PanelBody className="space-y-3 text-sm">
        <p className="max-w-[70ch] text-muted-foreground">The export includes users (without passwords), tasks with comments, checklists and approvals, projects, committees, meetings with minutes and decisions, announcements, categories and calendar events. Uploaded files aren’t included; back up the server’s upload folder for those. For full database backups, see the deployment guide in the README.</p>
        <Button loading={busy} onClick={async () => { setBusy(true); await download('/api/v1/system/export', `dwmt-export-${new Date().toISOString().slice(0, 10)}.json`); setBusy(false); }}><Download /> Download export</Button>
      </PanelBody>
    </Panel>
  );
}

