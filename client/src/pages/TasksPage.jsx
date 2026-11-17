import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Plus, Search, SlidersHorizontal, Bookmark, X, ListTodo, Trash2, UserPlus, Download, Copy } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import Pagination, { SortHeader } from '@/components/common/Pagination';
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/States';
import { StatusBadge, PriorityBadge, DeadlineText, CategoryTag } from '@/components/common/TaskBits';
import UserPicker from '@/components/common/UserPicker';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { AvatarGroup, Checkbox, Progress } from '@/components/ui/misc';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Field } from '@/components/ui/label';
import { openTaskForm } from '@/store/uiSlice';
import { useTasksQuery, useCategoriesQuery, useCommitteesQuery, useProjectsQuery, useBulkStatusMutation, useBulkAssignMutation, useDeleteTaskMutation, usePreferencesQuery, useUpdatePreferencesMutation, useCreateFromTemplateMutation } from '@/services/endpoints';
import { useAction, useDebounce, usePermissions } from '@/hooks';
import { STATUS_META, PRIORITIES, PRIORITY_META, urgencyColor, oid, cn, fmtDate } from '@/lib/utils';
import { exportRows } from '@/utils/exporters';

const ALL_TABS = [
  ['all', 'All tasks'],
  ['created', 'Assigned by me'],
  ['watching', 'Watching'],
  ['approvals', 'Awaiting approval'],
  ['overdue', 'Overdue'],
  ['upcoming', 'Due this week'],
  ['templates', 'Templates'],
];
const MY_TABS = [
  ['mine', 'Open'],
  ['mine-done', 'Completed'],
  ['overdue', 'Overdue'],
  ['upcoming', 'Due this week'],
];
const FILTER_KEYS = ['status', 'priority', 'category', 'assignee', 'committee', 'project', 'deadlineFrom', 'deadlineTo', 'q'];

export default function TasksPage({ scope }) {
  const dispatch = useDispatch();
  const run = useAction();
  const { can } = usePermissions();
  const [params, setParams] = useSearchParams();
  const tabs = scope === 'mine' ? MY_TABS : ALL_TABS;
  const tab = params.get('tab') || tabs[0][0];
  const page = Number(params.get('page') || 1);
  const limit = Number(params.get('limit') || 20);
  const sort = params.get('sort') || (tab.startsWith('mine') || tab === 'upcoming' ? 'deadline' : '-createdAt');
  const [qInput, setQInput] = useState(params.get('q') || '');
  const q = useDebounce(qInput, 300);
  const [selected, setSelected] = useState([]);

  const set = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) next.delete(k);
      else next.set(k, Array.isArray(v) ? v.join(',') : v);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
    setSelected([]);
  };

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || undefined]));
  filters.q = q || undefined;
  const queryArgs = useMemo(() => {
    const base = { ...filters, page, limit, sort };
    if (tab === 'templates') return { ...base, isTemplate: 'true', scope: 'all' };
    if (tab === 'mine') return { ...base, scope: 'mine', status: filters.status || 'assigned,acknowledged,in_progress,under_review,revision_required,on_hold' };
    if (tab === 'mine-done') return { ...base, scope: 'mine', status: 'completed' };
    return { ...base, scope: tab };
  }, [JSON.stringify(filters), page, limit, sort, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = useTasksQuery(queryArgs);
  const items = query.data?.items || [];
  const activeFilters = FILTER_KEYS.filter((k) => k !== 'q' && params.get(k)).length;
  const allChecked = items.length > 0 && selected.length === items.length;

  return (
    <div>
      <PageHeader
        title={scope === 'mine' ? 'My tasks' : 'All tasks'}
        description={scope === 'mine' ? 'Everything assigned to you or where you are a supporting member.' : 'Departmental tasks you can see, with filters you can save and share by link.'}
        actions={
          <>
            <ExportMenu items={items} />
            <Button onClick={() => dispatch(openTaskForm(tab === 'templates' ? { isTemplate: true } : undefined))}>
              <Plus /> {tab === 'templates' ? 'New template' : 'New task'}
            </Button>
          </>
        }
      />

      <div className="mb-3 flex gap-1 overflow-x-auto border-b">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => set({ tab: k === tabs[0][0] ? null : k, sort: null })} className={cn('-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium', tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={qInput} onChange={(e) => { setQInput(e.target.value); set({ q: e.target.value }); }} placeholder="Search title, task ID, description" className="pl-8" />
        </div>
        <FilterPopover params={params} set={set} count={activeFilters} />
        <SavedFilters params={params} setParams={setParams} />
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={() => set(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}>
            <X /> Clear filters
          </Button>
        )}
      </div>

      {selected.length > 0 && <BulkBar ids={selected} onDone={() => setSelected([])} />}

      <Panel className="overflow-hidden">
        {query.isLoading ? (
          <RowsSkeleton rows={8} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : !items.length ? (
          <EmptyState
            icon={ListTodo}
            title={activeFilters || q ? 'No tasks match these filters' : tab === 'templates' ? 'No templates yet' : 'Nothing here yet'}
            description={activeFilters || q ? 'Remove a filter or search for something else.' : tab === 'templates' ? 'Templates let you create recurring departmental tasks in one step.' : 'New tasks appear here as soon as they are assigned.'}
            action={!activeFilters && !q && <Button variant="outline" onClick={() => dispatch(openTaskForm(tab === 'templates' ? { isTemplate: true } : undefined))}><Plus /> {tab === 'templates' ? 'New template' : 'New task'}</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  {can('task:bulk') && tab !== 'templates' && (
                    <th className="w-10 px-3 py-2.5"><Checkbox aria-label="Select all" checked={allChecked} onCheckedChange={(v) => setSelected(v ? items.map((t) => t._id) : [])} /></th>
                  )}
                  <th className="px-3 py-2.5"><SortHeader field="title" sort={sort} onSort={(s) => set({ sort: s })}>Task</SortHeader></th>
                  <th className="px-3 py-2.5"><SortHeader field="status" sort={sort} onSort={(s) => set({ sort: s })}>Status</SortHeader></th>
                  <th className="px-3 py-2.5"><SortHeader field="priority" sort={sort} onSort={(s) => set({ sort: s })}>Priority</SortHeader></th>
                  <th className="px-3 py-2.5">Assignees</th>
                  <th className="px-3 py-2.5"><SortHeader field="deadline" sort={sort} onSort={(s) => set({ sort: s })}>Deadline</SortHeader></th>
                  <th className="w-32 px-3 py-2.5"><SortHeader field="progress" sort={sort} onSort={(s) => set({ sort: s })}>Progress</SortHeader></th>
                  {tab === 'templates' && <th className="px-3 py-2.5" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((t) => (
                  <tr key={t._id} className={cn('urgency-edge hover:bg-accent/50', selected.includes(t._id) && 'bg-primary-soft/40')} style={{ '--urgency': urgencyColor(t) }}>
                    {can('task:bulk') && tab !== 'templates' && (
                      <td className="px-3 py-2.5"><Checkbox aria-label={`Select ${t.taskId}`} checked={selected.includes(t._id)} onCheckedChange={(v) => setSelected(v ? [...selected, t._id] : selected.filter((x) => x !== t._id))} /></td>
                    )}
                    <td className="max-w-[420px] px-3 py-2.5">
                      <Link to={`/tasks/${t._id}`} className="group block">
                        <span className="task-code">{t.taskId}</span>
                        <span className="ml-2 font-medium group-hover:text-primary group-hover:underline">{t.templateName || t.title}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <CategoryTag category={t.category} />
                          {t.project && <span className="text-xs text-muted-foreground">{t.project.title}</span>}
                          {t.committee && <span className="text-xs text-muted-foreground">{t.committee.name}</span>}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={t.status} /></td>
                    <td className="px-3 py-2.5"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-3 py-2.5"><AvatarGroup users={(t.assignees || []).map((a) => a.user)} /></td>
                    <td className="px-3 py-2.5"><DeadlineText task={t} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2"><Progress value={t.progress} className="w-16" /><span className="tabular text-xs text-muted-foreground">{t.progress}%</span></div>
                    </td>
                    {tab === 'templates' && <td className="px-3 py-2.5 text-right"><UseTemplate template={t} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={query.data?.meta} onPage={(p) => set({ page: p })} onLimit={(l) => set({ limit: l })} />
      </Panel>
    </div>
  );
}

function FilterPopover({ params, set, count }) {
  const { data: categories = [] } = useCategoriesQuery();
  const { data: committees } = useCommitteesQuery({ limit: 100 });
  const { data: projects } = useProjectsQuery({ limit: 100 });
  const multi = (key) => (params.get(key) || '').split(',').filter(Boolean);
  const toggle = (key, v) => {
    const cur = multi(key);
    set({ [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline"><SlidersHorizontal /> Filters {count > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{count}</span>}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(30rem,calc(100vw-1.5rem))] space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Status</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(STATUS_META).map(([k, m]) => (
              <button key={k} onClick={() => toggle('status', k)} className={cn('rounded-full border px-2.5 py-1 text-xs', multi('status').includes(k) ? 'border-primary bg-primary-soft text-primary' : 'hover:bg-accent')}>{m.label}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Priority</p>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITIES.map((p) => (
              <button key={p} onClick={() => toggle('priority', p)} className={cn('rounded-full border px-2.5 py-1 text-xs', multi('priority').includes(p) ? 'border-primary bg-primary-soft text-primary' : 'hover:bg-accent')}>{PRIORITY_META[p].label}</button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category">
            <Select value={params.get('category') || ''} onChange={(e) => set({ category: e.target.value })}>
              <option value="">Any</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Assigned to">
            <UserPicker multiple={false} value={params.get('assignee')} onChange={(v) => set({ assignee: v })} placeholder="Anyone" />
          </Field>
          <Field label="Committee">
            <Select value={params.get('committee') || ''} onChange={(e) => set({ committee: e.target.value })}>
              <option value="">Any</option>
              {(committees?.items || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Project">
            <Select value={params.get('project') || ''} onChange={(e) => set({ project: e.target.value })}>
              <option value="">Any</option>
              {(projects?.items || []).map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
            </Select>
          </Field>
          <Field label="Deadline from"><Input type="date" value={params.get('deadlineFrom') || ''} onChange={(e) => set({ deadlineFrom: e.target.value })} /></Field>
          <Field label="Deadline to"><Input type="date" value={params.get('deadlineTo') || ''} onChange={(e) => set({ deadlineTo: e.target.value })} /></Field>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SavedFilters({ params, setParams }) {
  const { data: prefs } = usePreferencesQuery();
  const [save] = useUpdatePreferencesMutation();
  const saved = (prefs?.savedFilters || []).filter((f) => f.scope === 'tasks');
  const [name, setName] = useState('');
  const store = async () => {
    if (!name.trim()) return;
    const query = Object.fromEntries([...params.entries()].filter(([k]) => k !== 'page'));
    await save({ savedFilters: [...(prefs?.savedFilters || []), { name: name.trim(), scope: 'tasks', query }] });
    setName('');
  };
  const remove = (f) => save({ savedFilters: (prefs?.savedFilters || []).filter((x) => x !== f && x._id !== f._id) });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline"><Bookmark /> Saved</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Saved filters</DropdownMenuLabel>
        {saved.length === 0 && <p className="px-2 pb-2 text-xs text-muted-foreground">Set up filters, then save them here to reuse.</p>}
        {saved.map((f) => (
          <DropdownMenuItem key={f._id || f.name} onSelect={() => setParams(new URLSearchParams(f.query))} className="justify-between">
            <span className="truncate">{f.name}</span>
            <span role="button" tabIndex={-1} aria-label={`Delete ${f.name}`} onClick={(e) => { e.stopPropagation(); e.preventDefault(); remove(f); }} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="flex gap-1.5 p-1.5" onKeyDown={(e) => e.stopPropagation()}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name current filters" className="h-8" />
          <Button size="sm" onClick={store} disabled={!name.trim()}>Save</Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BulkBar({ ids, onDone }) {
  const run = useAction();
  const [bulkStatus, s1] = useBulkStatusMutation();
  const [bulkAssign, s2] = useBulkAssignMutation();
  const [del] = useDeleteTaskMutation();
  const [assignOpen, setAssignOpen] = useState(false);
  const [people, setPeople] = useState([]);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary-soft px-3 py-2 text-sm">
      <span className="font-medium">{ids.length} selected</span>
      <Select className="h-8 w-auto" defaultValue="" onChange={async (e) => { if (!e.target.value) return; const ok = await run(bulkStatus({ taskIds: ids, status: e.target.value }), { success: 'Status updated' }); e.target.value = ''; if (ok) onDone(); }} disabled={s1.isLoading} aria-label="Change status">
        <option value="">Change status…</option>
        {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
      </Select>
      <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}><UserPlus /> Assign</Button>
      <Button size="sm" variant="outline" onClick={() => setConfirm(true)}><Trash2 /> Delete</Button>
      <Button size="sm" variant="ghost" onClick={onDone}>Clear selection</Button>
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Assign {ids.length} tasks</DialogTitle></DialogHeader>
          <UserPicker value={people} onChange={setPeople} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button loading={s2.isLoading} disabled={!people.length} onClick={async () => { const ok = await run(bulkAssign({ taskIds: ids, assignees: people.map((u, i) => ({ user: u, isPrimary: i === 0 })), mode: 'add' }), { success: 'Tasks assigned' }); if (ok) { setAssignOpen(false); onDone(); } }}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={`Move ${ids.length} tasks to the recycle bin?`} description="Authorized users can restore them from Settings, Recycle bin." confirmLabel="Move to recycle bin" onConfirm={async () => { for (const id of ids) await del(id); setConfirm(false); onDone(); }} />
    </div>
  );
}

function UseTemplate({ template }) {
  const run = useAction();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState([]);
  const [deadline, setDeadline] = useState('');
  const [create, st] = useCreateFromTemplateMutation();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Copy /> Use template</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Create from “{template.templateName || template.title}”</DialogTitle></DialogHeader>
          <Field label="Assign to"><UserPicker value={people} onChange={setPeople} /></Field>
          <Field label="Deadline"><Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={st.isLoading} onClick={async () => { const ok = await run(create({ id: template._id, assignees: people.map((u, i) => ({ user: u, isPrimary: i === 0 })), deadline: deadline ? new Date(deadline).toISOString() : undefined }), { success: 'Task created from template' }); if (ok) setOpen(false); }}>Create task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExportMenu({ items }) {
  const rows = () =>
    items.map((t) => ({
      'Task ID': t.taskId,
      Title: t.title,
      Status: STATUS_META[t.status]?.label,
      Priority: PRIORITY_META[t.priority]?.label,
      Category: t.category?.name || '',
      Assignees: (t.assignees || []).map((a) => a.user?.name).join(', '),
      Deadline: t.deadline ? fmtDate(t.deadline) : '',
      'Progress %': t.progress,
      Project: t.project?.title || '',
      Committee: t.committee?.name || '',
    }));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={!items.length}><Download /> Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>This page ({items.length} rows)</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => exportRows(rows(), 'tasks', 'csv')}>CSV</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => exportRows(rows(), 'tasks', 'xlsx')}>Excel</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => exportRows(rows(), 'tasks', 'pdf', { title: 'Task list' })}>PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

