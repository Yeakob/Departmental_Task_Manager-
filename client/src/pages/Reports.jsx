import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Printer, Info, ArrowLeft } from 'lucide-react';
import { startOfMonth, subMonths, startOfYear, format } from 'date-fns';
import PageHeader from '@/components/common/PageHeader';
import { ErrorState, RowsSkeleton } from '@/components/common/States';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar, Progress } from '@/components/ui/misc';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { StatusBadge, DeadlineText } from '@/components/common/TaskBits';
import { SortHeader } from '@/components/common/Pagination';
import { MonthlyChart, OnTimeChart, HBarChart, priorityRows } from '@/features/dashboard/charts';
import { useDepartmentReportQuery, useFacultyReportQuery, useLazyTaskReportQuery } from '@/services/endpoints';
import { usePermissions } from '@/hooks';
import { exportRows } from '@/utils/exporters';
import { STATUS_META, PRIORITY_META, fmtDate, cn } from '@/lib/utils';

const PRESETS = {
  month: ['This month', () => startOfMonth(new Date())],
  quarter: ['Last 3 months', () => subMonths(new Date(), 3)],
  half: ['Last 6 months', () => subMonths(new Date(), 6)],
  year: ['This year', () => startOfYear(new Date())],
  all: ['All time', () => null],
};

function Period({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="inline-flex flex-wrap rounded-md border p-0.5 text-sm" role="group" aria-label="Reporting period">
        {Object.entries(PRESETS).map(([k, [label]]) => (
          <button key={k} onClick={() => onChange({ preset: k })} className={cn('rounded px-2.5 py-1', value.preset === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{label}</button>
        ))}
      </div>
      <label className="text-xs text-muted-foreground">From<Input type="date" className="mt-1 h-8 w-36" value={value.from || ''} onChange={(e) => onChange({ ...value, preset: 'custom', from: e.target.value })} /></label>
      <label className="text-xs text-muted-foreground">To<Input type="date" className="mt-1 h-8 w-36" value={value.to || ''} onChange={(e) => onChange({ ...value, preset: 'custom', to: e.target.value })} /></label>
    </div>
  );
}

function periodParams(p) {
  if (p.preset === 'custom') return { from: p.from ? new Date(p.from).toISOString() : undefined, to: p.to ? new Date(`${p.to}T23:59:59`).toISOString() : undefined };
  const from = PRESETS[p.preset]?.[1]();
  return { from: from ? from.toISOString() : undefined };
}
const periodLabel = (p) => (p.preset === 'custom' ? `${p.from || 'start'} to ${p.to || 'today'}` : PRESETS[p.preset][0]);

function ExportButton({ onExport }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline"><Download /> Export</Button></DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => onExport('pdf')}>PDF</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onExport('xlsx')}>Excel</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onExport('csv')}>CSV</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.print()}><Printer /> Print</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Methodology({ text }) {
  return <p className="flex gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{text}</p>;
}

function Table({ columns, rows, empty = 'No data for this period.' }) {
  if (!rows.length) return <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground"><tr>{columns.map((c) => <th key={c} className="px-4 py-2 font-medium">{c}</th>)}</tr></thead>
        <tbody className="divide-y">{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="px-4 py-2">{v}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function DepartmentReport({ period }) {
  const q = useDepartmentReportQuery(periodParams(period));
  const [loadTasks] = useLazyTaskReportQuery();
  if (q.isLoading) return <RowsSkeleton rows={8} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const d = q.data;
  const c = d.cards;
  const committeeRows = d.committees.map((x) => [x.name, x.coordinator || '—', x.members, x.total, x.completed, x.overdue, `${x.progress}%`]);
  const projectRows = d.projects.map((x) => [x.title, x.manager || '—', x.status, fmtDate(x.endDate), x.total, x.overdue, `${x.progress}%`]);
  const categoryRows = d.byCategory.map((x) => [x.name, x.total, x.completed, x.overdue, x.avgDays ?? '—']);

  const onExport = async (fmt) => {
    const summary = [
      { Measure: 'Total tasks', Value: c.total }, { Measure: 'Completed', Value: c.completed }, { Measure: 'In progress', Value: c.inProgress },
      { Measure: 'Pending', Value: c.pending }, { Measure: 'Overdue', Value: c.overdue }, { Measure: 'Awaiting approval', Value: c.awaitingApproval },
      { Measure: 'Effort points assigned', Value: d.effort.assigned }, { Measure: 'Effort points completed', Value: d.effort.completed },
    ];
    const committees = d.committees.map((x) => ({ Committee: x.name, Coordinator: x.coordinator, Members: x.members, Tasks: x.total, Completed: x.completed, Overdue: x.overdue, 'Progress %': x.progress }));
    const projects = d.projects.map((x) => ({ Project: x.title, Manager: x.manager, Status: x.status, 'End date': fmtDate(x.endDate), Tasks: x.total, Overdue: x.overdue, 'Progress %': x.progress }));
    const categories = d.byCategory.map((x) => ({ Category: x.name, Tasks: x.total, Completed: x.completed, Overdue: x.overdue, 'Avg days to complete': x.avgDays }));
    if (fmt === 'xlsx') {
      const tasks = (await loadTasks(periodParams(period)).unwrap()).map((t) => ({ 'Task ID': t.taskId, Title: t.title, Status: STATUS_META[t.status]?.label, Priority: PRIORITY_META[t.priority]?.label, Category: t.category?.name, Assignees: (t.assignees || []).map((a) => a.user?.name).join(', '), 'Assigned by': t.assignedBy?.name, Committee: t.committee?.name, Project: t.project?.title, Deadline: fmtDate(t.deadline), Completed: t.completedAt ? fmtDate(t.completedAt) : '', 'Est. hours': t.estimatedHours, 'Actual hours': t.actualHours, 'Progress %': t.progress }));
      return exportRows([], 'department-report', 'xlsx', { sheets: { Summary: summary, Monthly: d.monthly, Categories: categories, Committees: committees, Projects: projects, Tasks: tasks } });
    }
    if (fmt === 'csv') return exportRows(categories, 'department-categories', 'csv');
    return exportRows([...summary.map((s) => ({ Section: 'Summary', Item: s.Measure, Value: s.Value })), ...committees.map((x) => ({ Section: 'Committee', Item: x.Committee, Value: `${x['Progress %']}% (${x.Completed}/${x.Tasks}, ${x.Overdue} overdue)` })), ...projects.map((x) => ({ Section: 'Project', Item: x.Project, Value: `${x['Progress %']}% (${x.Overdue} overdue)` })), ...categories.map((x) => ({ Section: 'Category', Item: x.Category, Value: `${x.Completed}/${x.Tasks} done, ${x.Overdue} overdue` }))], 'department-report', 'pdf', { title: 'Departmental report', subtitle: `Period: ${periodLabel(period)}. Generated ${new Date().toLocaleString('en-GB')}` });
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end"><ExportButton onExport={onExport} /></div>
      <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3 lg:grid-cols-6">
        {[['Total', c.total], ['Completed', c.completed], ['In progress', c.inProgress], ['Overdue', c.overdue, c.overdue && 'text-destructive'], ['Effort assigned', d.effort.assigned], ['Effort completed', d.effort.completed]].map(([l, v, tone]) => (
          <div key={l} className="bg-card px-4 py-3"><p className="text-sm text-muted-foreground">{l}</p><p className={cn('tabular text-xl font-semibold', tone)}>{v}</p></div>
        ))}
      </div>
      <Methodology text={d.methodology} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-4"><h2 className="font-semibold">Task completion trend</h2><p className="mb-2 text-xs text-muted-foreground">Created vs completed, last 12 months</p><MonthlyChart data={d.monthly} /></Panel>
        <Panel className="p-4"><h2 className="font-semibold">On-time completion</h2><p className="mb-2 text-xs text-muted-foreground">Share of completed tasks finished by their deadline</p><OnTimeChart data={d.monthly} /></Panel>
      </div>
      <Panel><div className="border-b px-4 py-2.5"><h2 className="font-semibold">Committee performance</h2></div><Table columns={['Committee', 'Coordinator', 'Members', 'Tasks', 'Completed', 'Overdue', 'Progress']} rows={committeeRows} /></Panel>
      <Panel><div className="border-b px-4 py-2.5"><h2 className="font-semibold">Project progress</h2></div><Table columns={['Project', 'Manager', 'Status', 'Ends', 'Tasks', 'Overdue', 'Progress']} rows={projectRows} /></Panel>
      <Panel><div className="border-b px-4 py-2.5"><h2 className="font-semibold">Category statistics</h2></div><Table columns={['Category', 'Tasks', 'Completed', 'Overdue', 'Avg days to complete']} rows={categoryRows} /></Panel>
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="p-4"><h2 className="mb-2 font-semibold">Overdue by age</h2><HBarChart data={d.overdue.byAge.map((b) => ({ label: b.bucket, value: b.count }))} color="#B4421F" /></Panel>
        <Panel className="p-4"><h2 className="mb-2 font-semibold">Overdue by priority</h2><HBarChart data={priorityRows(d.overdue.byPriority)} /></Panel>
        <Panel className="p-4"><h2 className="mb-2 font-semibold">Overdue by category</h2>{d.overdue.byCategory.length ? <HBarChart data={d.overdue.byCategory.map((b) => ({ label: b.name, value: b.count }))} color="#B4421F" /> : <p className="text-sm text-muted-foreground">Nothing overdue.</p>}</Panel>
      </div>
      <Panel><div className="border-b px-4 py-2.5"><h2 className="font-semibold">Approval workflow</h2></div><Table columns={['Decision', 'Submissions', 'Average review time']} rows={d.approvals.map((a) => [a.decision.replace('_', ' '), a.count, a.avgReviewHours != null ? `${a.avgReviewHours} h` : '—'])} /></Panel>
    </div>
  );
}

const FACULTY_COLS = [
  ['user', 'Person'], ['assigned', 'Assigned'], ['completed', 'Done'], ['pending', 'Open'], ['overdue', 'Overdue'], ['completionRate', 'Done %'], ['onTimeRate', 'On time %'],
  ['avgCompletionDays', 'Avg days'], ['effortCompleted', 'Effort done'], ['utilization', 'Load'], ['committees', 'Committees'], ['projectsManaged', 'Projects led'],
];

function FacultyDetail({ userId, period, self }) {
  const q = useFacultyReportQuery({ ...periodParams(period), user: userId });
  if (q.isLoading) return <RowsSkeleton rows={6} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const r = q.data.rows[0];
  const det = q.data.detail;
  if (!r) return <p className="text-sm text-muted-foreground">No data.</p>;
  const onExport = (fmt) => exportRows(det.open.map((t) => ({ 'Task ID': t.taskId, Title: t.title, Status: STATUS_META[t.status]?.label, Deadline: fmtDate(t.deadline), 'Est. hours': t.estimatedHours, 'Progress %': t.progress })), `${r.user.name}-open-tasks`, fmt, { title: `${r.user.name}: open tasks`, subtitle: `Assigned ${r.assigned}, completed ${r.completed}, overdue ${r.overdue}, on time ${r.onTimeRate ?? '—'}%, effort completed ${r.effortCompleted}. Period: ${periodLabel(period)}` });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <UserAvatar user={r.user} size={44} />
        <div className="flex-1"><p className="text-lg font-semibold">{r.user.name}</p><p className="text-sm text-muted-foreground">{r.user.designation}</p></div>
        <ExportButton onExport={onExport} />
      </div>
      <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4 lg:grid-cols-8">
        {[['Assigned', r.assigned], ['Completed', r.completed], ['Open', r.pending], ['Overdue', r.overdue, r.overdue && 'text-destructive'], ['On time', r.onTimeRate == null ? '—' : `${r.onTimeRate}%`], ['Avg days', r.avgCompletionDays ?? '—'], ['Effort done', r.effortCompleted], ['Load', `${r.utilization ?? 0}%`, r.utilization > 100 && 'text-destructive']].map(([l, v, tone]) => (
          <div key={l} className="bg-card px-3 py-2.5"><p className="text-xs text-muted-foreground">{l}</p><p className={cn('tabular text-lg font-semibold', tone)}>{v}</p></div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">Also serves on {r.committees} committee{r.committees === 1 ? '' : 's'} and leads {r.projectsManaged} active project{r.projectsManaged === 1 ? '' : 's'}. Open work is {r.openHours} estimated hours against a weekly capacity of {r.capacityHours} hours.</p>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-4"><h2 className="mb-2 font-semibold">Completed by month</h2><MonthlyChart data={det.monthly} /></Panel>
        <Panel className="p-4"><h2 className="mb-2 font-semibold">Work by category</h2><HBarChart data={det.byCategory.slice(0, 8).map((c) => ({ label: c.name, value: c.total }))} /></Panel>
      </div>
      <Panel>
        <div className="border-b px-4 py-2.5"><h2 className="font-semibold">{self ? 'My open tasks' : 'Open tasks'}</h2></div>
        {det.open.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">No open tasks.</p> : (
          <ul className="divide-y">{det.open.map((t) => <li key={t._id} className="flex flex-wrap items-center gap-3 px-4 py-2.5"><Link to={`/tasks/${t._id}`} className="min-w-0 flex-1 truncate text-sm hover:underline"><span className="task-code mr-1.5">{t.taskId}</span>{t.title}</Link><DeadlineText task={t} /><StatusBadge status={t.status} /></li>)}</ul>
        )}
      </Panel>
      <Methodology text={q.data.methodology} />
    </div>
  );
}

function FacultyReport({ period, selected, setSelected }) {
  const q = useFacultyReportQuery(periodParams(period), { skip: !!selected });
  const [sort, setSort] = useState('-effortCompleted');
  const rows = useMemo(() => {
    const data = [...(q.data?.rows || [])];
    const key = sort.replace('-', '');
    const dir = sort.startsWith('-') ? -1 : 1;
    return data.sort((a, b) => {
      const av = key === 'user' ? a.user.name : a[key] ?? -1;
      const bv = key === 'user' ? b.user.name : b[key] ?? -1;
      return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
    });
  }, [q.data, sort]);
  if (selected) return (<div><Button variant="ghost" size="sm" className="mb-3" onClick={() => setSelected(null)}><ArrowLeft /> All faculty</Button><FacultyDetail userId={selected} period={period} /></div>);
  if (q.isLoading) return <RowsSkeleton rows={8} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const onExport = (fmt) => exportRows(rows.map((r) => ({ Name: r.user.name, Designation: r.user.designation, Assigned: r.assigned, Completed: r.completed, Open: r.pending, Overdue: r.overdue, 'Done %': r.completionRate, 'On time %': r.onTimeRate ?? '', 'Avg days': r.avgCompletionDays ?? '', 'Effort assigned': r.effortAssigned, 'Effort completed': r.effortCompleted, 'Open hours': r.openHours, 'Capacity h/week': r.capacityHours, 'Load %': r.utilization ?? '', Committees: r.committees, 'Projects led': r.projectsManaged })), 'faculty-report', fmt, { title: 'Faculty workload and performance', subtitle: `Period: ${periodLabel(period)}. Effort-weighted; see methodology in DWMT.` });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><Methodology text={q.data.methodology} /><ExportButton onExport={onExport} /></div>
      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground"><tr>{FACULTY_COLS.map(([k, l]) => <th key={k} className="px-3 py-2.5"><SortHeader field={k} sort={sort} onSort={setSort}>{l}</SortHeader></th>)}</tr></thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.user.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelected(r.user.id)}>
                  <td className="px-3 py-2"><span className="flex items-center gap-2"><UserAvatar user={r.user} size={24} /><span><span className="block font-medium">{r.user.name}</span><span className="block text-xs text-muted-foreground">{r.user.designation}</span></span></span></td>
                  <td className="px-3 py-2">{r.assigned}</td>
                  <td className="px-3 py-2">{r.completed}</td>
                  <td className="px-3 py-2">{r.pending}</td>
                  <td className={cn('px-3 py-2', r.overdue && 'font-medium text-destructive')}>{r.overdue}</td>
                  <td className="px-3 py-2"><div className="flex items-center gap-2"><Progress value={r.completionRate} className="w-12" />{r.completionRate}%</div></td>
                  <td className="px-3 py-2">{r.onTimeRate == null ? '—' : `${r.onTimeRate}%`}</td>
                  <td className="px-3 py-2">{r.avgCompletionDays ?? '—'}</td>
                  <td className="px-3 py-2 font-medium">{r.effortCompleted}</td>
                  <td className={cn('px-3 py-2', r.utilization > 100 ? 'font-medium text-destructive' : r.utilization > 80 && 'text-highlight')}>{r.utilization ?? 0}%</td>
                  <td className="px-3 py-2">{r.committees}</td>
                  <td className="px-3 py-2">{r.projectsManaged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="text-xs text-muted-foreground">Select a person to see their trend, categories and open tasks.</p>
    </div>
  );
}

export default function Reports() {
  const { can, user } = usePermissions();
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState({ preset: 'half' });
  const tabs = [
    can('report:department') && ['department', 'Department'],
    can('report:faculty') && ['faculty', 'Faculty'],
    ['me', 'My performance'],
  ].filter(Boolean);
  const tab = tabs.some(([k]) => k === params.get('tab')) ? params.get('tab') : tabs[0][0];
  const selected = params.get('user');
  const setTab = (k) => setParams({ tab: k }, { replace: true });
  const setSelected = (id) => setParams(id ? { tab: 'faculty', user: id } : { tab: 'faculty' }, { replace: true });

  return (
    <div>
      <PageHeader title="Reports" description={`Analytics for ${periodLabel(period).toLowerCase()}, generated ${format(new Date(), 'd MMM yyyy')}.`}>
        <div className="mt-3"><Period value={period} onChange={setPeriod} /></div>
      </PageHeader>
      <div className="mb-4 flex gap-1 border-b no-print">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-medium', tab === k ? 'border-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{l}</button>)}
      </div>
      {tab === 'department' && <DepartmentReport period={period} />}
      {tab === 'faculty' && <FacultyReport period={period} selected={selected} setSelected={setSelected} />}
      {tab === 'me' && <FacultyDetail userId={user?.id} period={period} self />}
    </div>
  );
}
