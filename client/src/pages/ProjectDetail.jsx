import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ChevronRight, Pencil, Plus, Archive, ArchiveRestore, Trash2, Check, X, Upload, MoreHorizontal } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger, UserAvatar, Progress, Checkbox } from '@/components/ui/misc';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { ConfirmDialog } from '@/components/ui/confirm';
import { ErrorState, PageLoader, RowsSkeleton } from '@/components/common/States';
import { RichTextView } from '@/components/common/RichText';
import { StatusBadge, DeadlineText } from '@/components/common/TaskBits';
import Pagination from '@/components/common/Pagination';
import ProjectFormDialog, { PROJECT_STATUS } from '@/features/projects/ProjectFormDialog';
import Gantt from '@/features/projects/Gantt';
import KanbanBoard from '@/features/kanban/KanbanBoard';
import DocumentTable from '@/features/documents/DocumentTable';
import { UploadDocumentDialog } from '@/features/documents/DocumentDialogs';
import { HBarChart, statusRows } from '@/features/dashboard/charts';
import { projectTone } from './Projects';
import { openTaskForm } from '@/store/uiSlice';
import { useProjectQuery, useProjectTimelineQuery, useUpdateProjectMutation, useDeleteProjectMutation, useAddMilestoneMutation, useUpdateMilestoneMutation, useDeleteMilestoneMutation, useTasksQuery, useDocumentsQuery } from '@/services/endpoints';
import { useAction, usePermissions } from '@/hooks';
import { fmtDate, oid, urgencyColor, cn } from '@/lib/utils';

function Milestones({ project, canManage }) {
  const run = useAction();
  const [add, st] = useAddMilestoneMutation();
  const [update] = useUpdateMilestoneMutation();
  const [remove] = useDeleteMilestoneMutation();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  return (
    <div>
      <ol className="space-y-1">
        {project.milestones.length === 0 && <li className="py-3 text-sm text-muted-foreground">No milestones yet. Milestones mark checkpoints such as a draft submission or a mock visit.</li>}
        {project.milestones.map((m, i) => {
          const late = m.dueDate && new Date(m.dueDate) < new Date() && m.status !== 'completed';
          return (
            <li key={m._id} className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50">
              <span className="tabular w-5 text-right text-xs text-muted-foreground">{i + 1}</span>
              <Checkbox checked={m.status === 'completed'} disabled={!canManage} onCheckedChange={(v) => run(update({ id: project._id, milestoneId: m._id, status: v ? 'completed' : 'pending' }))} aria-label={`Mark ${m.title} complete`} />
              <span className={cn('flex-1 text-sm', m.status === 'completed' && 'text-muted-foreground line-through')}>{m.title}</span>
              <span className={cn('text-xs', late ? 'font-medium text-destructive' : 'text-muted-foreground')}>{fmtDate(m.dueDate)}</span>
              {canManage && <button onClick={() => run(remove({ id: project._id, milestoneId: m._id }))} className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 focus:opacity-100" aria-label={`Delete ${m.title}`}><X className="h-3.5 w-3.5" /></button>}
            </li>
          );
        })}
      </ol>
      {canManage && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New milestone" className="h-8 min-w-[12rem] flex-1" />
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-8 w-40" aria-label="Due date" />
          <Button size="sm" variant="outline" loading={st.isLoading} disabled={title.trim().length < 2} onClick={async () => { if (await run(add({ id: project._id, title: title.trim(), dueDate: due || null }))) { setTitle(''); setDue(''); } }}><Plus /> Add</Button>
        </div>
      )}
    </div>
  );
}

function ProjectTasks({ projectId }) {
  const [page, setPage] = useState(1);
  const q = useTasksQuery({ project: projectId, page, limit: 20, sort: 'deadline', scope: 'all' });
  if (q.isLoading) return <RowsSkeleton />;
  if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const items = q.data.items;
  return (
    <Panel className="overflow-hidden">
      {items.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">No tasks in this project yet.</p> : (
        <ul className="divide-y">
          {items.map((t) => (
            <li key={t._id} className="urgency-edge flex flex-wrap items-center gap-3 px-4 py-2.5" style={{ '--urgency': urgencyColor(t) }}>
              <Link to={`/tasks/${t._id}`} className="min-w-0 flex-1 truncate text-sm hover:underline"><span className="task-code mr-1.5">{t.taskId}</span>{t.title}</Link>
              <DeadlineText task={t} />
              <Progress value={t.progress} className="w-16" />
              <StatusBadge status={t.status} />
              {t.assignees?.[0]?.user && <UserAvatar user={t.assignees[0].user} size={22} />}
            </li>
          ))}
        </ul>
      )}
      <Pagination meta={q.data.meta} onPage={setPage} />
    </Panel>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const run = useAction();
  const { can, user } = usePermissions();
  const query = useProjectQuery(id);
  const timeline = useProjectTimelineQuery(id);
  const docs = useDocumentsQuery({ project: id, limit: 50 });
  const [update] = useUpdateProjectMutation();
  const [del] = useDeleteProjectMutation();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [upload, setUpload] = useState(false);
  const p = query.data;

  if (query.isLoading) return <PageLoader />;
  if (query.isError) return <Panel><ErrorState error={query.error} onRetry={query.refetch} /></Panel>;
  const canManage = can('project:update') || String(oid(p.manager)) === String(user?.id);
  const isMember = canManage || (p.members || []).some((m) => String(oid(m)) === String(user?.id));
  const late = p.endDate && new Date(p.endDate) < new Date() && !['completed', 'archived'].includes(p.status);

  return (
    <div>
      <nav className="mb-3 flex items-center gap-1 text-sm text-muted-foreground"><Link to="/projects" className="hover:text-foreground">Projects</Link><ChevronRight className="h-3.5 w-3.5" /><span className="truncate">{p.title}</span></nav>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {p.code && <span className="task-code text-sm">{p.code}</span>}
            <h1 className="text-xl font-semibold">{p.title}</h1>
            <Badge variant={projectTone[p.status]}>{PROJECT_STATUS[p.status]}</Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {p.startDate || p.endDate ? <>{fmtDate(p.startDate)} to <span className={cn(late && 'font-medium text-destructive')}>{fmtDate(p.endDate)}</span></> : 'No dates set'}
            {p.budget?.amount ? `, budget ${p.budget.amount.toLocaleString('en-IN')} ${p.budget.currency}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isMember && <Button onClick={() => dispatch(openTaskForm({ project: p._id }))}><Plus /> Add task</Button>}
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Project actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setEdit(true)}><Pencil /> Edit project</DropdownMenuItem>
                {p.status !== 'completed' && <DropdownMenuItem onSelect={() => run(update({ id: p._id, status: 'completed' }), { success: 'Project marked completed' })}><Check /> Mark completed</DropdownMenuItem>}
                {p.status === 'archived' ? (
                  <DropdownMenuItem onSelect={() => run(update({ id: p._id, status: 'completed' }), { success: 'Project restored from archive' })}><ArchiveRestore /> Unarchive</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => run(update({ id: p._id, status: 'archived' }), { success: 'Project archived' })}><Archive /> Archive</DropdownMenuItem>
                )}
                {can('project:delete') && (<><DropdownMenuSeparator /><DropdownMenuItem destructive onSelect={() => setConfirm(true)}><Trash2 /> Delete project</DropdownMenuItem></>)}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="mb-5 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
        {[
          ['Progress', `${p.stats.progress}%`, <Progress key="p" value={p.stats.progress} className="mt-2" />],
          ['Tasks done', `${p.stats.completed} of ${p.stats.total}`],
          ['Overdue', p.stats.overdue, null, p.stats.overdue > 0 && 'text-destructive'],
          ['Milestones', `${p.milestones.filter((m) => m.status === 'completed').length} of ${p.milestones.length}`],
        ].map(([l, v, extra, tone]) => (
          <div key={l} className="bg-card px-4 py-3">
            <p className="text-sm text-muted-foreground">{l}</p>
            <p className={cn('tabular text-xl font-semibold', tone)}>{v}</p>
            {extra}
          </div>
        ))}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="documents">Documents {docs.data?.meta?.total ? <span className="tabular text-xs text-muted-foreground">{docs.data.meta.total}</span> : null}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <Panel className="p-5"><RichTextView html={p.description} empty="No description yet." /></Panel>
              <Panel className="p-4"><h2 className="mb-2 font-semibold">Milestones</h2><Milestones project={p} canManage={canManage} /></Panel>
            </div>
            <div className="space-y-5">
              <Panel className="p-4">
                <h2 className="mb-3 font-semibold">Team</h2>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm"><UserAvatar user={p.manager} size={26} /><span className="flex-1 truncate">{p.manager?.name}</span><Badge variant="primary">Manager</Badge></li>
                  {p.members.map((m) => <li key={m._id} className="flex items-center gap-2 text-sm"><UserAvatar user={m} size={26} /><span className="flex-1 truncate">{m.name}</span><span className="text-xs text-muted-foreground">{m.designation}</span></li>)}
                </ul>
              </Panel>
              <Panel className="p-4">
                <h2 className="mb-2 font-semibold">Tasks by status</h2>
                {Object.keys(p.byStatus).length ? <HBarChart data={statusRows(Object.entries(p.byStatus).map(([key, count]) => ({ key, count })))} /> : <p className="text-sm text-muted-foreground">No tasks yet.</p>}
              </Panel>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="tasks"><ProjectTasks projectId={p._id} /></TabsContent>
        <TabsContent value="board"><KanbanBoard params={{ project: p._id }} /></TabsContent>
        <TabsContent value="timeline"><Panel className="p-3">{timeline.isLoading ? <RowsSkeleton /> : timeline.data ? <Gantt tasks={timeline.data.tasks} milestones={timeline.data.milestones} project={p} /> : <ErrorState error={timeline.error} />}</Panel></TabsContent>
        <TabsContent value="documents">
          <div className="mb-3 flex justify-end">{can('document:upload') && <Button variant="outline" onClick={() => setUpload(true)}><Upload /> Upload to project</Button>}</div>
          <Panel className="overflow-hidden"><DocumentTable query={docs} /></Panel>
        </TabsContent>
      </Tabs>

      <ProjectFormDialog open={edit} onOpenChange={setEdit} project={p} />
      <UploadDocumentDialog open={upload} onOpenChange={setUpload} links={{ project: p._id }} />
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={`Delete “${p.title}”?`} description="Its tasks stay in the task list but lose the project link. Archive it instead if the work is simply finished." confirmLabel="Delete project" onConfirm={async () => { if (await run(del(p._id), { success: 'Project deleted' })) navigate('/projects'); }} />
    </div>
  );
}
