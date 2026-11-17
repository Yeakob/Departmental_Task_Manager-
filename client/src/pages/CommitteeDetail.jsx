import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ChevronRight, Pencil, Plus, Trash2, CalendarPlus, Upload, CalendarClock } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger, UserAvatar, Progress } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/ui/confirm';
import { ErrorState, PageLoader } from '@/components/common/States';
import { StatusBadge, DeadlineText } from '@/components/common/TaskBits';
import CommitteeFormDialog from '@/features/committees/CommitteeFormDialog';
import DocumentTable from '@/features/documents/DocumentTable';
import { UploadDocumentDialog } from '@/features/documents/DocumentDialogs';
import { openTaskForm } from '@/store/uiSlice';
import { useCommitteeQuery, useDeleteCommitteeMutation, useDocumentsQuery } from '@/services/endpoints';
import { useAction, usePermissions } from '@/hooks';
import { fmtDateTime, urgencyColor, cn } from '@/lib/utils';

export default function CommitteeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const run = useAction();
  const { can } = usePermissions();
  const query = useCommitteeQuery(id);
  const docs = useDocumentsQuery({ committee: id, limit: 50 });
  const [del] = useDeleteCommitteeMutation();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [upload, setUpload] = useState(false);
  const c = query.data;
  if (query.isLoading) return <PageLoader />;
  if (query.isError) return <Panel><ErrorState error={query.error} onRetry={query.refetch} /></Panel>;

  return (
    <div>
      <nav className="mb-3 flex items-center gap-1 text-sm text-muted-foreground"><Link to="/committees" className="hover:text-foreground">Committees</Link><ChevronRight className="h-3.5 w-3.5" /><span>{c.name}</span></nav>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold">{c.name}</h1>
          {c.description && <p className="mt-1 max-w-[72ch] text-sm text-muted-foreground">{c.description}</p>}
          {c.meetingSchedule && <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><CalendarClock className="h-4 w-4" /> Meets {c.meetingSchedule.charAt(0).toLowerCase() + c.meetingSchedule.slice(1)}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {c.canManage && can('task:assign') && <Button onClick={() => dispatch(openTaskForm({ committee: c._id }))}><Plus /> Assign committee task</Button>}
          {c.canManage && can('meeting:create') && <Button variant="outline" onClick={() => navigate(`/meetings?new=1&committee=${c._id}`)}><CalendarPlus /> Schedule meeting</Button>}
          {c.canManage && <Button variant="outline" size="icon" onClick={() => setEdit(true)} aria-label="Edit committee"><Pencil /></Button>}
          {can('committee:delete') && <Button variant="outline" size="icon" onClick={() => setConfirm(true)} aria-label="Delete committee"><Trash2 /></Button>}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <Tabs defaultValue="tasks">
            <TabsList>
              <TabsTrigger value="tasks">Assigned tasks</TabsTrigger>
              <TabsTrigger value="meetings">Meetings and minutes</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            <TabsContent value="tasks">
              <Panel className="overflow-hidden">
                {c.recentTasks.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">No tasks assigned to this committee yet.</p> : (
                  <ul className="divide-y">
                    {c.recentTasks.map((t) => (
                      <li key={t._id} className="urgency-edge flex flex-wrap items-center gap-3 px-4 py-2.5" style={{ '--urgency': urgencyColor(t) }}>
                        <Link to={`/tasks/${t._id}`} className="min-w-0 flex-1 truncate text-sm hover:underline"><span className="task-code mr-1.5">{t.taskId}</span>{t.title}</Link>
                        <DeadlineText task={t} />
                        <StatusBadge status={t.status} />
                        {t.assignees?.[0]?.user && <UserAvatar user={t.assignees[0].user} size={22} />}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-t px-4 py-2 text-right"><Link to={`/tasks?committee=${c._id}`} className="text-sm text-primary hover:underline">Open in task list with filters</Link></div>
              </Panel>
            </TabsContent>
            <TabsContent value="meetings">
              <Panel className="overflow-hidden">
                {c.meetings.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">No meetings recorded yet.</p> : (
                  <ul className="divide-y">
                    {c.meetings.map((m) => (
                      <li key={m._id}><Link to={`/meetings/${m._id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40"><span className="flex-1 text-sm font-medium">{m.title}</span><span className="text-xs text-muted-foreground">{fmtDateTime(m.startAt)}</span><Badge className="capitalize">{m.status.replace('_', ' ')}</Badge></Link></li>
                    ))}
                  </ul>
                )}
              </Panel>
            </TabsContent>
            <TabsContent value="documents">
              <div className="mb-3 flex justify-end">{can('document:upload') && <Button variant="outline" onClick={() => setUpload(true)}><Upload /> Upload report or document</Button>}</div>
              <Panel className="overflow-hidden"><DocumentTable query={docs} /></Panel>
            </TabsContent>
          </Tabs>
        </div>
        <aside className="space-y-5">
          <Panel className="p-4">
            <p className="text-sm text-muted-foreground">Completion</p>
            <div className="mt-1 flex items-center gap-2"><Progress value={c.stats.progress} className="flex-1" /><span className="tabular text-lg font-semibold">{c.stats.progress}%</span></div>
            <p className="tabular mt-1 text-xs text-muted-foreground">{c.stats.completed} of {c.stats.total} tasks done{c.stats.overdue ? `, ${c.stats.overdue} overdue` : ''}</p>
          </Panel>
          <Panel className="p-4">
            <h2 className="mb-3 font-semibold">Members</h2>
            <ul className="space-y-2">
              {[...c.members].sort((a, b) => (a.role === 'coordinator' ? -1 : b.role === 'coordinator' ? 1 : 0)).map((m) => (
                <li key={m.user?._id} className="flex items-center gap-2 text-sm">
                  <UserAvatar user={m.user} size={26} />
                  <span className="flex-1 truncate">{m.user?.name}</span>
                  <Badge variant={m.role === 'coordinator' ? 'primary' : 'default'} className={cn('capitalize')}>{m.role}</Badge>
                </li>
              ))}
            </ul>
          </Panel>
          {c.responsibilities?.length > 0 && (
            <Panel className="p-4">
              <h2 className="mb-2 font-semibold">Responsibilities</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm">{c.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul>
            </Panel>
          )}
        </aside>
      </div>

      <CommitteeFormDialog open={edit} onOpenChange={setEdit} committee={c} />
      <UploadDocumentDialog open={upload} onOpenChange={setUpload} links={{ committee: c._id }} defaultCategory="Reports" />
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={`Delete ${c.name}?`} description="Its tasks and meetings stay, but lose the committee link." confirmLabel="Delete committee" onConfirm={async () => { if (await run(del(c._id), { success: 'Committee deleted' })) navigate('/committees'); }} />
    </div>
  );
}
