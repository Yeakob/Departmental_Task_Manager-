import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Plus, Table2, BarChart3, SlidersHorizontal, X, Pin, MapPin } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Skeleton, UserAvatar } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/common/States';
import { StatusBadge, DeadlineText, PriorityBadge } from '@/components/common/TaskBits';
import UserPicker from '@/components/common/UserPicker';
import { WeeklyChart, MonthlyChart, OnTimeChart, HBarChart, WorkloadChart, statusRows, priorityRows } from '@/features/dashboard/charts';
import { openTaskForm } from '@/store/uiSlice';
import { useDashboardQuery, useCategoriesQuery, useCommitteesQuery } from '@/services/endpoints';
import { usePermissions } from '@/hooks';
import { STATUS_META, PRIORITIES, PRIORITY_META, urgencyColor, fmtDateTime, timeAgo, cn, fmtDate } from '@/lib/utils';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** One plain-language line that tells the user what needs them today. */
function Summary({ data, firstName }) {
  const { cards, lists } = data;
  const parts = [];
  if (cards.overdue) parts.push(<Link key="o" to="/tasks?tab=overdue" className="text-destructive underline decoration-1 underline-offset-4">{cards.overdue} overdue</Link>);
  if (lists.awaitingApproval.length) parts.push(<Link key="a" to="/tasks?tab=approvals" className="underline decoration-1 underline-offset-4">{lists.awaitingApproval.length} waiting for your review</Link>);
  const dueSoon = lists.upcoming.filter((t) => new Date(t.deadline) - Date.now() < 3 * 86400000).length;
  if (dueSoon) parts.push(<Link key="u" to="/tasks?tab=upcoming" className="underline decoration-1 underline-offset-4">{dueSoon} due in the next three days</Link>);
  if (lists.meetings.length) parts.push(<Link key="m" to="/meetings" className="underline decoration-1 underline-offset-4">{lists.meetings.length} meeting{lists.meetings.length > 1 ? 's' : ''} coming up</Link>);
  return (
    <div>
      <p className="text-sm text-muted-foreground">{greeting()}, {firstName}.</p>
      <h1 className="mt-1 max-w-[46ch] text-2xl font-semibold leading-tight tracking-tight">
        {parts.length === 0 ? (
          'Nothing needs your attention right now.'
        ) : (
          <>
            {parts.map((p, i) => (
              <span key={i}>
                {i > 0 && (i === parts.length - 1 ? ', and ' : ', ')}
                {p}
              </span>
            ))}
            .
          </>
        )}
      </h1>
    </div>
  );
}

function StatStrip({ cards }) {
  const items = [
    ['Total', cards.total, '/tasks'],
    ['Pending', cards.pending, '/tasks?status=assigned,acknowledged'],
    ['In progress', cards.inProgress, '/tasks?status=in_progress,revision_required'],
    ['Completed', cards.completed, '/tasks?status=completed'],
    ['Overdue', cards.overdue, '/tasks?tab=overdue', cards.overdue > 0 && 'text-destructive'],
    ['Awaiting approval', cards.awaitingApproval, '/tasks?tab=approvals', cards.awaitingApproval > 0 && 'text-violet-700 dark:text-violet-300'],
  ];
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card sm:grid-cols-3 xl:grid-cols-6">
      {items.map(([label, value, to, tone], i) => (
        <Link key={label} to={to} className={cn('group px-4 py-3.5 hover:bg-accent/60', i > 0 && 'border-l', i >= 2 && 'max-sm:border-t', i % 2 === 0 && 'max-sm:border-l-0', i >= 3 && 'sm:max-xl:border-t', i === 3 && 'sm:max-xl:border-l-0')}>
          <p className="text-sm text-muted-foreground group-hover:text-foreground">{label}</p>
          <p className={cn('tabular mt-0.5 text-2xl font-semibold', tone)}>{value}</p>
        </Link>
      ))}
    </div>
  );
}

/** Panel with a chart and an accessible table view of the same data. */
function ChartPanel({ title, description, table, children, className }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Panel className={className}>
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {table && (
          <Button variant="ghost" size="icon-sm" onClick={() => setAsTable((v) => !v)} aria-label={asTable ? 'Show chart' : 'Show as table'} title={asTable ? 'Show chart' : 'Show as table'}>
            {asTable ? <BarChart3 /> : <Table2 />}
          </Button>
        )}
      </div>
      <div className="px-2 pb-3 pt-2">
        {asTable && table ? (
          <div className="max-h-64 overflow-auto px-2">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>{table.columns.map((c) => <th key={c} className="py-1.5 pr-3 font-medium">{c}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {table.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="py-1.5 pr-3">{v}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </Panel>
  );
}

function TaskList({ title, tasks, empty, link, showAssignee = true }) {
  return (
    <Panel>
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="font-semibold">{title}</h2>
        {link && <Link to={link} className="text-sm text-primary hover:underline">See all</Link>}
      </div>
      {tasks.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y">
          {tasks.map((t) => (
            <li key={t._id} className="urgency-edge" style={{ '--urgency': urgencyColor(t) }}>
              <Link to={`/tasks/${t._id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm"><span className="task-code mr-1.5">{t.taskId}</span>{t.title}</p>
                  <div className="mt-0.5 flex items-center gap-3"><DeadlineText task={t} /><PriorityBadge priority={t.priority} /></div>
                </div>
                {showAssignee && t.assignees?.[0]?.user && <UserAvatar user={t.assignees[0].user} size={24} />}
                <StatusBadge status={t.status} className="hidden sm:inline-flex" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Filters({ f, setF }) {
  const { data: categories = [] } = useCategoriesQuery();
  const { data: committees } = useCommitteesQuery({ limit: 100 });
  const { can } = usePermissions();
  const active = Object.values(f).filter(Boolean).length;
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setOpen((o) => !o)}><SlidersHorizontal /> Filters {active > 0 && `(${active})`}</Button>
      <div className={cn('mt-2 flex-wrap items-end gap-2 lg:mt-0 lg:flex', open ? 'flex' : 'hidden')}>
        <label className="text-xs text-muted-foreground">From<Input type="date" className="mt-1 h-8 w-36" value={f.from || ''} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="text-xs text-muted-foreground">To<Input type="date" className="mt-1 h-8 w-36" value={f.to || ''} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        {can('task:read_all') && <div className="w-48"><UserPicker multiple={false} value={f.assignee} onChange={(v) => setF({ ...f, assignee: v })} placeholder="All faculty" /></div>}
        <Select className="h-8 w-40" value={f.committee || ''} onChange={(e) => setF({ ...f, committee: e.target.value })} aria-label="Committee">
          <option value="">All committees</option>
          {(committees?.items || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </Select>
        <Select className="h-8 w-40" value={f.category || ''} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </Select>
        <Select className="h-8 w-32" value={f.priority || ''} onChange={(e) => setF({ ...f, priority: e.target.value })} aria-label="Priority">
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
        </Select>
        <Select className="h-8 w-36" value={f.status || ''} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Status">
          <option value="">Any status</option>
          {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </Select>
        {active > 0 && <Button variant="ghost" size="sm" onClick={() => setF({})}><X /> Reset</Button>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const dispatch = useDispatch();
  const { user, can } = usePermissions();
  const [f, setF] = useState({});
  const [scope, setScope] = useState(undefined);
  const query = useDashboardQuery({ ...f, from: f.from ? new Date(f.from).toISOString() : undefined, to: f.to ? new Date(`${f.to}T23:59:59`).toISOString() : undefined, scope });
  const firstName = (user?.name || '').replace(/^(Dr\.|Prof\.)\s*/, '').split(' ')[0];
  const data = query.data;
  const isDept = data?.scope === 'department';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        {data ? <Summary data={data} firstName={firstName} /> : <Skeleton className="h-16 w-full max-w-xl" />}
        <div className="flex shrink-0 gap-2">
          {can('task:read_all') && (
            <div className="inline-flex rounded-md border p-0.5 text-sm" role="group" aria-label="Dashboard scope">
              {[[undefined, 'Department'], ['mine', 'Mine']].map(([v, l]) => (
                <button key={l} onClick={() => setScope(v)} className={cn('rounded px-3 py-1', scope === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{l}</button>
              ))}
            </div>
          )}
          <Button onClick={() => dispatch(openTaskForm())}><Plus /> New task</Button>
        </div>
      </div>

      <Filters f={f} setF={setF} />

      {query.isError ? (
        <Panel><ErrorState error={query.error} onRetry={query.refetch} /></Panel>
      ) : !data ? (
        <div className="space-y-4"><Skeleton className="h-20" /><div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-64 lg:col-span-2" /><Skeleton className="h-64" /></div></div>
      ) : (
        <>
          <StatStrip cards={data.cards} />

          <div className="grid gap-5 lg:grid-cols-3">
            <ChartPanel className="lg:col-span-2" title="Weekly completion" description="Tasks created and completed, last 8 weeks" table={{ columns: ['Week of', 'Created', 'Completed'], rows: data.charts.weekly.map((w) => [fmtDate(w.period), w.created, w.completed]) }}>
              {data.charts.weekly.length ? <WeeklyChart data={data.charts.weekly} /> : <p className="px-2 py-16 text-center text-sm text-muted-foreground">No activity in the last 8 weeks.</p>}
            </ChartPanel>
            <TaskList title="Upcoming deadlines" tasks={data.lists.upcoming} empty="Nothing due in the next two weeks." link="/tasks?tab=upcoming" />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <ChartPanel title="Monthly activity" description="Created vs completed, last 6 months" table={{ columns: ['Month', 'Created', 'Completed'], rows: data.charts.monthly.map((m) => [m.period, m.created, m.completed]) }}>
              <MonthlyChart data={data.charts.monthly} />
            </ChartPanel>
            <ChartPanel title="By status" table={{ columns: ['Status', 'Tasks'], rows: statusRows(data.charts.byStatus).map((r) => [r.label, r.value]) }}>
              <HBarChart data={statusRows(data.charts.byStatus)} />
            </ChartPanel>
            <ChartPanel title="By priority" description="Darker means more severe" table={{ columns: ['Priority', 'Tasks'], rows: priorityRows(data.charts.byPriority).map((r) => [r.label, r.value]) }}>
              <HBarChart data={priorityRows(data.charts.byPriority)} />
            </ChartPanel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {isDept && data.charts.workload.length > 0 ? (
              <ChartPanel
                title="Faculty workload"
                description="Open estimated hours against each person’s weekly capacity. Labels show utilisation; amber above 80%, red above 100%."
                table={{ columns: ['Person', 'Open hours', 'Capacity', 'Utilisation', 'Effort points done'], rows: data.charts.workload.map((r) => [r.user.name, r.openHours, r.capacityHours, `${r.utilization ?? 0}%`, r.effortCompleted]) }}
              >
                <WorkloadChart rows={data.charts.workload} />
              </ChartPanel>
            ) : (
              <ChartPanel title="By category" table={{ columns: ['Category', 'Tasks', 'Completed'], rows: data.charts.byCategory.map((c) => [c.name, c.total, c.completed]) }}>
                <HBarChart data={data.charts.byCategory.slice(0, 8).map((c) => ({ label: c.name, value: c.total }))} />
              </ChartPanel>
            )}
            <ChartPanel title="Productivity trend" description="Share of completed tasks finished by their deadline" table={{ columns: ['Month', 'Completed', 'On time', 'Rate'], rows: data.charts.monthly.map((m) => [m.period, m.completed, m.onTime, m.onTimeRate == null ? '—' : `${m.onTimeRate}%`]) }}>
              <OnTimeChart data={data.charts.monthly} />
            </ChartPanel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <TaskList title="My assigned tasks" tasks={data.lists.myTasks} empty="Nothing is assigned to you right now." link="/tasks/my" showAssignee={false} />
            <TaskList title="Awaiting my approval" tasks={data.lists.awaitingApproval} empty="No submissions are waiting for your review." link="/tasks?tab=approvals" />
            <TaskList title="Overdue" tasks={data.lists.overdue} empty="Nothing is overdue." link="/tasks?tab=overdue" />
            <TaskList title="Recently created" tasks={data.lists.recent} empty="No tasks yet." link="/tasks" />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel>
              <div className="border-b px-4 py-2.5"><h2 className="font-semibold">Recent activity</h2></div>
              {data.lists.activities.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">No recent activity.</p> : (
                <ul className="divide-y">
                  {data.lists.activities.map((a) => (
                    <li key={a._id} className="flex gap-3 px-4 py-2.5">
                      <UserAvatar user={a.actor || { name: 'System' }} size={24} />
                      <div className="min-w-0 text-sm">
                        <p><span className="font-medium">{a.actor?.name || 'System'}</span> {a.message}</p>
                        {a.task && <Link to={`/tasks/${a.task._id}`} className="block truncate text-xs text-muted-foreground hover:underline">{a.task.taskId} {a.task.title}</Link>}
                        <p className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel>
              <div className="flex items-center justify-between border-b px-4 py-2.5"><h2 className="font-semibold">Upcoming meetings and events</h2><Link to="/calendar" className="text-sm text-primary hover:underline">Calendar</Link></div>
              {data.lists.meetings.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">No meetings scheduled.</p> : (
                <ul className="divide-y">
                  {data.lists.meetings.map((m) => (
                    <li key={m._id}>
                      <Link to={`/meetings/${m._id}`} className="flex gap-3 px-4 py-2.5 hover:bg-accent/50">
                        <div className="w-11 shrink-0 rounded-md border text-center leading-tight">
                          <p className="bg-primary-soft text-[10px] font-semibold text-primary">{fmtDate(m.startAt, 'MMM')}</p>
                          <p className="tabular py-0.5 text-md font-semibold">{fmtDate(m.startAt, 'd')}</p>
                        </div>
                        <div className="min-w-0 text-sm">
                          <p className="truncate font-medium">{m.title}</p>
                          <p className="text-xs text-muted-foreground">{fmtDateTime(m.startAt)}</p>
                          {m.location && <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {m.location}</p>}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel>
              <div className="flex items-center justify-between border-b px-4 py-2.5"><h2 className="font-semibold">Announcements</h2><Link to="/announcements" className="text-sm text-primary hover:underline">See all</Link></div>
              {data.lists.announcements.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">No announcements.</p> : (
                <ul className="divide-y">
                  {data.lists.announcements.map((a) => (
                    <li key={a._id} className="px-4 py-2.5">
                      <Link to="/announcements" className="flex items-start gap-2 hover:underline">
                        {a.isPinned && <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-highlight" aria-label="Pinned" />}
                        <span className="text-sm font-medium">{a.title}</span>
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        {a.priority !== 'normal' && <Badge variant={a.priority === 'urgent' ? 'destructive' : 'highlight'} className="capitalize">{a.priority}</Badge>}
                        {a.author?.name}, {timeAgo(a.publishAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
