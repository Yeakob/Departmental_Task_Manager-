import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ChevronRight, Link2, Plus, X, Star, CalendarClock, Check, Ban } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger, UserAvatar, Progress } from '@/components/ui/misc';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ErrorState, PageLoader } from '@/components/common/States';
import { StatusBadge, PriorityBadge, DeadlineText, CategoryTag } from '@/components/common/TaskBits';
import { RichTextView } from '@/components/common/RichText';
import TaskActions, { useTaskAbilities } from '@/features/tasks/TaskActions';
import TaskComments from '@/features/tasks/TaskComments';
import TaskChecklist from '@/features/tasks/TaskChecklist';
import { TaskAttachments, TaskActivity, TaskApprovals } from '@/features/tasks/TaskFiles';
import { openTaskForm } from '@/store/uiSlice';
import { useTaskQuery, useUpdateProgressMutation, useDecideExtensionMutation, useAddDependencyMutation, useRemoveDependencyMutation, useTasksQuery } from '@/services/endpoints';
import { useAction, useDebounce } from '@/hooks';
import { useTaskRoom } from '@/hooks/useRealtime';
import { fmtDate, fmtDateTime, oid, urgencyColor, timeAgo, cn } from '@/lib/utils';

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-start gap-2 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Person({ user, extra }) {
  if (!user) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-2">
      <UserAvatar user={user} size={22} />
      <span className="truncate">{user.name}</span>
      {extra}
    </span>
  );
}

function ProgressEditor({ task, editable }) {
  const [value, setValue] = useState(task.progress);
  const [hours, setHours] = useState(task.actualHours || 0);
  const [save, st] = useUpdateProgressMutation();
  const run = useAction();
  const dirty = value !== task.progress || Number(hours) !== (task.actualHours || 0);
  return (
    <div className="space-y-2">
      {!editable && (
        <div className="flex items-center gap-2">
          <Progress value={task.progress} className="flex-1" />
          <span className="tabular w-10 text-right text-sm">{task.progress}%</span>
        </div>
      )}
      {editable && (
        <>
          <div className="flex items-center gap-2">
            <input type="range" min="0" max="100" step="5" value={value} onChange={(e) => setValue(Number(e.target.value))} className="flex-1 accent-[hsl(var(--primary))]" aria-label="Progress percentage" />
            <span className="tabular w-10 text-right text-sm">{value}%</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor="hrs">Hours spent</label>
            <Input id="hrs" type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} className="h-8 w-20" />
            {dirty && <Button size="sm" className="ml-auto" loading={st.isLoading} onClick={() => run(save({ id: oid(task), progress: value, actualHours: Number(hours) || 0 }), { success: 'Progress saved' })}>Save</Button>}
          </div>
        </>
      )}
    </div>
  );
}

function Dependencies({ task, editable }) {
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const { data } = useTasksQuery({ q: dq, limit: 8 }, { skip: dq.length < 2 });
  const [add] = useAddDependencyMutation();
  const [remove] = useRemoveDependencyMutation();
  const run = useAction();
  const deps = task.dependsOn || [];
  const blocking = deps.filter((d) => d.status !== 'completed');
  return (
    <div className="space-y-1.5">
      {deps.length === 0 && <p className="text-muted-foreground">None</p>}
      {deps.map((d) => (
        <div key={d._id} className="flex items-center gap-2">
          <Link to={`/tasks/${d._id}`} className="min-w-0 flex-1 truncate hover:underline"><span className="task-code">{d.taskId}</span> {d.title}</Link>
          <StatusBadge status={d.status} />
          {editable && <button onClick={() => run(remove({ id: oid(task), depId: d._id }))} aria-label={`Remove dependency ${d.taskId}`} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>}
        </div>
      ))}
      {blocking.length > 0 && <p className="text-xs text-highlight">Blocked by {blocking.length} unfinished task{blocking.length > 1 ? 's' : ''}.</p>}
      {editable && (
        <Popover>
          <PopoverTrigger asChild><button className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><Plus className="h-3 w-3" /> Add dependency</button></PopoverTrigger>
          <PopoverContent className="w-80">
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or task ID" className="h-8" />
            <ul className="mt-2 max-h-56 overflow-y-auto">
              {(data?.items || []).filter((t) => t._id !== oid(task)).map((t) => (
                <li key={t._id}>
                  <button className="w-full truncate rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent" onClick={() => { run(add({ id: oid(task), dependsOn: t._id }), { success: 'Dependency added' }); setQ(''); }}>
                    <span className="task-code">{t.taskId}</span> {t.title}
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function Extensions({ task, canDecide }) {
  const [decide] = useDecideExtensionMutation();
  const run = useAction();
  const reqs = [...(task.extensionRequests || [])].reverse();
  if (!reqs.length) return null;
  return (
    <Panel>
      <div className="border-b px-4 py-2.5"><h3 className="text-sm font-semibold">Deadline extension requests</h3></div>
      <ul className="divide-y">
        {reqs.map((r) => (
          <li key={r._id} className="space-y-1 px-4 py-3 text-sm">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <span>To <span className="font-medium">{fmtDateTime(r.requestedDeadline)}</span></span>
              <Badge variant={r.status === 'approved' ? 'primary' : r.status === 'rejected' ? 'destructive' : 'highlight'} className="ml-auto capitalize">{r.status}</Badge>
            </div>
            <p className="text-muted-foreground">{r.reason}</p>
            <p className="text-xs text-muted-foreground">Requested {timeAgo(r.createdAt)}{r.decisionNote && `. Decision note: ${r.decisionNote}`}</p>
            {r.status === 'pending' && canDecide && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={() => run(decide({ id: oid(task), requestId: r._id, decision: 'approved' }), { success: 'Extension approved; the deadline has moved' })}><Check /> Approve</Button>
                <Button size="sm" variant="outline" onClick={() => { const note = window.prompt('Reason for declining (shared with the requester)') ?? undefined; run(decide({ id: oid(task), requestId: r._id, decision: 'rejected', note }), { success: 'Extension declined' }); }}><Ban /> Decline</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default function TaskDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const query = useTaskQuery(id);
  useTaskRoom(id);
  const task = query.data;
  const ab = useTaskAbilities(task);

  if (query.isLoading) return <PageLoader />;
  if (query.isError) return <Panel><ErrorState error={query.error} onRetry={query.refetch} /></Panel>;

  const primary = (task.assignees || []).find((a) => a.isPrimary) || task.assignees?.[0];
  const others = (task.assignees || []).filter((a) => a !== primary);

  return (
    <div>
      <nav className="mb-3 flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/tasks" className="hover:text-foreground">Tasks</Link>
        {task.parentTask && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link to={`/tasks/${task.parentTask._id}`} className="hover:text-foreground">{task.parentTask.taskId}</Link>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="task-code text-sm">{task.taskId}</span>
      </nav>

      <div className="urgency-edge mb-5 flex flex-col gap-4 pl-4 lg:flex-row lg:items-start lg:justify-between" style={{ '--urgency': urgencyColor(task) }}>
        <div className="min-w-0">
          <h1 className="max-w-[60ch] text-xl font-semibold leading-snug">{task.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            <DeadlineText task={task} className="text-sm" />
            <CategoryTag category={task.category} />
            {task.isPersonal && <Badge>Personal</Badge>}
            {task.isTemplate && <Badge variant="outline">Template</Badge>}
          </div>
        </div>
        {!task.isTemplate && <TaskActions task={task} />}
      </div>

      {task.status === 'revision_required' && ab.isAssignee && (
        <div className="mb-4 rounded-lg border border-highlight/40 bg-highlight-soft px-4 py-3 text-sm">The reviewer asked for changes. See their comment under Approvals, update your work, then submit again.</div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Panel className="p-5">
            <RichTextView html={task.description} />
            <div className="mt-6"><TaskChecklist taskId={task._id} checklist={task.checklist} editable={ab.canEdit} /></div>
          </Panel>

          {(task.subtasks?.length > 0 || (ab.manager && !task.parentTask)) && (
            <Panel>
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <h3 className="text-sm font-semibold">Subtasks {task.subtasks?.length > 0 && <span className="tabular font-normal text-muted-foreground">({task.subtasks.filter((s) => s.status === 'completed').length}/{task.subtasks.length})</span>}</h3>
                {ab.manager && !task.parentTask && <Button size="sm" variant="ghost" onClick={() => dispatch(openTaskForm({ parentTask: task._id, project: oid(task.project), committee: oid(task.committee) }))}><Plus /> Add subtask</Button>}
              </div>
              {task.subtasks?.length ? (
                <ul className="divide-y">
                  {task.subtasks.map((s) => (
                    <li key={s._id} className="urgency-edge flex items-center gap-3 px-4 py-2.5" style={{ '--urgency': urgencyColor(s) }}>
                      <Link to={`/tasks/${s._id}`} className="min-w-0 flex-1 truncate text-sm hover:underline"><span className="task-code">{s.taskId}</span> {s.title}</Link>
                      <DeadlineText task={s} />
                      <StatusBadge status={s.status} />
                      {s.assignees?.[0]?.user && <UserAvatar user={s.assignees[0].user} size={22} />}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-4 text-sm text-muted-foreground">Break larger work into subtasks with their own people and deadlines.</p>
              )}
            </Panel>
          )}

          <Panel className="p-4">
            <Tabs defaultValue="comments">
              <TabsList>
                <TabsTrigger value="comments">Discussion {task.commentCount > 0 && <span className="tabular text-xs text-muted-foreground">{task.commentCount}</span>}</TabsTrigger>
                <TabsTrigger value="files">Files {task.attachmentCount > 0 && <span className="tabular text-xs text-muted-foreground">{task.attachmentCount}</span>}</TabsTrigger>
                <TabsTrigger value="approvals">Approvals</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <TabsContent value="comments"><TaskComments taskId={task._id} /></TabsContent>
              <TabsContent value="files"><TaskAttachments taskId={task._id} canUpload={ab.isAssignee || ab.manager || ab.isSupporter} /></TabsContent>
              <TabsContent value="approvals"><TaskApprovals taskId={task._id} /></TabsContent>
              <TabsContent value="activity"><TaskActivity taskId={task._id} /></TabsContent>
            </Tabs>
          </Panel>
        </div>

        <aside className="space-y-5">
          <Panel className="px-4 py-2">
            <dl className="divide-y">
              <Row label="Responsible">
                <div className="space-y-1.5">
                  {primary ? <Person user={primary.user} extra={<Star className="h-3.5 w-3.5 fill-primary text-primary" aria-label="Primary" />} /> : <span className="text-muted-foreground">Unassigned</span>}
                  {others.map((a) => <Person key={oid(a.user)} user={a.user} />)}
                  {(task.assignees || []).some((a) => a.responsibility) && (
                    <ul className="text-xs text-muted-foreground">{task.assignees.filter((a) => a.responsibility).map((a) => <li key={oid(a.user)}>{a.user?.name}: {a.responsibility}</li>)}</ul>
                  )}
                </div>
              </Row>
              {task.supporters?.length > 0 && <Row label="Supporting"><div className="space-y-1.5">{task.supporters.map((u) => <Person key={oid(u)} user={u} />)}</div></Row>}
              <Row label="Assigned by"><Person user={task.assignedBy} /></Row>
              {task.approvers?.length > 0 && <Row label="Reviewers"><div className="space-y-1.5">{task.approvers.map((u) => <Person key={oid(u)} user={u} />)}</div></Row>}
              <Row label="Progress"><ProgressEditor key={`${task.progress}:${task.actualHours}`} task={task} editable={ab.canEdit && !['completed', 'cancelled'].includes(task.status)} /></Row>
              <Row label="Start">{fmtDate(task.startDate)}</Row>
              <Row label="Deadline"><span className={cn(task.deadline && new Date(task.deadline) < new Date() && !['completed', 'cancelled'].includes(task.status) && 'font-medium text-destructive')}>{task.deadline ? fmtDateTime(task.deadline) : '—'}</span></Row>
              <Row label="Effort"><span className="tabular">{task.actualHours || 0}h spent of {task.estimatedHours || 0}h estimated</span></Row>
              {task.project && <Row label="Project"><Link className="hover:underline" to={`/projects/${task.project._id}`}>{task.project.title}</Link></Row>}
              {task.committee && <Row label="Committee"><Link className="hover:underline" to={`/committees/${task.committee._id}`}>{task.committee.name}</Link></Row>}
              <Row label="Depends on"><Dependencies task={task} editable={ab.manager} /></Row>
              <Row label="Approval">{task.requiresApproval ? 'Required' : 'Not required'}</Row>
              {task.tags?.length > 0 && <Row label="Tags"><div className="flex flex-wrap gap-1">{task.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</div></Row>}
              {task.customFields?.map((f) => <Row key={f.key} label={f.label || f.key}>{String(f.value ?? '—')}</Row>)}
              <Row label="Watchers">{task.watchers?.length ? <div className="flex flex-wrap gap-1">{task.watchers.map((w) => <UserAvatar key={oid(w)} user={w} size={22} />)}</div> : '—'}</Row>
              <Row label="Created">{fmtDateTime(task.createdAt)}</Row>
              <Row label="Updated">{timeAgo(task.updatedAt)}</Row>
              {task.completedAt && <Row label="Completed">{fmtDateTime(task.completedAt)}</Row>}
            </dl>
          </Panel>

          <Extensions task={task} canDecide={ab.manager} />

          {task.assignmentHistory?.length > 0 && (
            <Panel>
              <div className="border-b px-4 py-2.5"><h3 className="text-sm font-semibold">Assignment history</h3></div>
              <ul className="divide-y text-sm">
                {[...task.assignmentHistory].reverse().map((h, i) => (
                  <li key={i} className="px-4 py-2.5">
                    <span className="capitalize">{h.action}</span> <span className="text-muted-foreground">{fmtDate(h.at)}</span>
                    {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground"><Link2 className="h-3.5 w-3.5" /> Internal reference: <span className="task-code">{task.taskId}</span></p>
        </aside>
      </div>
    </div>
  );
}
