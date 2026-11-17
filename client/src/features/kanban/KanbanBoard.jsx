import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, TouchSensor, useSensor, useSensors, closestCorners, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { Input, Select } from '@/components/ui/input';
import { AvatarGroup, Progress } from '@/components/ui/misc';
import { PriorityBadge, DeadlineText } from '@/components/common/TaskBits';
import { ErrorState } from '@/components/common/States';
import { Skeleton } from '@/components/ui/misc';
import UserPicker from '@/components/common/UserPicker';
import { useKanbanQuery, useKanbanMoveMutation, useCategoriesQuery } from '@/services/endpoints';
import { STATUS_META, STATUS_TRANSITIONS, PRIORITIES, PRIORITY_META, urgencyColor, apiError, cn, oid } from '@/lib/utils';

export const COLUMNS = ['assigned', 'acknowledged', 'in_progress', 'under_review', 'revision_required', 'completed'];

function Card({ task, overlay, dragging }) {
  return (
    <div
      className={cn('urgency-edge rounded-md border bg-card p-3 pl-3.5 text-left', overlay && 'rotate-1 shadow-xl ring-2 ring-primary/40', dragging && 'opacity-40')}
      style={{ '--urgency': urgencyColor(task) }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="task-code">{task.taskId}</span>
        <PriorityBadge priority={task.priority} showLabel={false} />
      </div>
      <Link to={`/tasks/${task._id}`} className="mt-1 line-clamp-2 block text-sm font-medium leading-snug hover:underline" onPointerDown={(e) => e.stopPropagation()}>
        {task.title}
      </Link>
      {(task.category || task.project) && (
        <p className="mt-1 truncate text-xs text-muted-foreground">{task.project?.title || task.category?.name}</p>
      )}
      {task.progress > 0 && task.status !== 'completed' && <Progress value={task.progress} className="mt-2.5" />}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <DeadlineText task={task} />
        <AvatarGroup users={(task.assignees || []).map((a) => a.user)} size={22} />
      </div>
    </div>
  );
}

function SortableCard({ task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task._id, data: { status: task.status } });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners} className="touch-none" aria-roledescription="Draggable task">
      <Card task={task} dragging={isDragging} />
    </li>
  );
}

function Column({ status, tasks, highlight }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  return (
    <section className={cn('flex w-[280px] shrink-0 flex-col rounded-lg border bg-muted/40', isOver && 'border-primary bg-primary-soft/40', highlight === false && 'opacity-50')} aria-label={STATUS_META[status].label}>
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span className={cn('h-2 w-2 rounded-full', status === 'completed' ? 'bg-emerald-600' : status === 'revision_required' ? 'bg-highlight' : status === 'under_review' ? 'bg-violet-600' : status === 'in_progress' ? 'bg-primary' : 'bg-sky-600')} />
        <h2 className="text-sm font-semibold">{STATUS_META[status].label}</h2>
        <span className="tabular ml-auto text-xs text-muted-foreground">{tasks.length}</span>
      </header>
      <SortableContext items={tasks.map((t) => t._id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {tasks.map((t) => <SortableCard key={t._id} task={t} />)}
          {tasks.length === 0 && <li className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">Drop tasks here</li>}
        </ul>
      </SortableContext>
    </section>
  );
}

/** Reusable board. `params` scopes the board (e.g. { project }). */
export default function KanbanBoard({ params = {} }) {
  const [assignee, setAssignee] = useState(null);
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const query = useKanbanQuery({ ...params, assignee: assignee || undefined, priority: priority || undefined, category: category || undefined });
  const { data: categories = [] } = useCategoriesQuery();
  const [move] = useKanbanMoveMutation();
  const [cols, setCols] = useState({});
  const [active, setActive] = useState(null);

  useEffect(() => {
    if (!query.data) return;
    const next = Object.fromEntries(COLUMNS.map((c) => [c, []]));
    for (const t of query.data) if (next[t.status]) next[t.status].push(t);
    setCols(next);
  }, [query.data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const filtered = useMemo(() => {
    if (!q.trim()) return cols;
    const s = q.toLowerCase();
    return Object.fromEntries(Object.entries(cols).map(([k, v]) => [k, v.filter((t) => `${t.taskId} ${t.title}`.toLowerCase().includes(s))]));
  }, [cols, q]);

  const findCol = (id) => (String(id).startsWith('col:') ? id.slice(4) : Object.keys(cols).find((c) => cols[c].some((t) => t._id === id)));

  const onDragEnd = async ({ active: a, over }) => {
    setActive(null);
    if (!over) return;
    const from = findCol(a.id);
    const to = findCol(over.id);
    if (!from || !to) return;
    if (from !== to && !(STATUS_TRANSITIONS[from] || []).includes(to)) {
      toast.error(`A task can’t move from ${STATUS_META[from].label} to ${STATUS_META[to].label}.`, { description: to === 'completed' ? 'Tasks that need approval are completed by approving them.' : undefined });
      return;
    }
    const snapshot = cols;
    const task = cols[from].find((t) => t._id === a.id);
    let dest = cols[to].filter((t) => t._id !== a.id);
    const overIndex = dest.findIndex((t) => t._id === over.id);
    if (from === to) {
      const oldIndex = cols[from].findIndex((t) => t._id === a.id);
      const newIndex = cols[to].findIndex((t) => t._id === over.id);
      if (newIndex < 0 || oldIndex === newIndex) return;
      dest = arrayMove(cols[from], oldIndex, newIndex);
    } else {
      dest.splice(overIndex < 0 ? dest.length : overIndex, 0, { ...task, status: to });
    }
    const next = { ...cols, [to]: dest, ...(from !== to ? { [from]: cols[from].filter((t) => t._id !== a.id) } : {}) };
    setCols(next);
    try {
      await move({ id: a.id, status: to, orderedIds: dest.map((t) => t._id) }).unwrap();
      if (from !== to) toast.success(`${task.taskId} moved to ${STATUS_META[to].label}`);
    } catch (e) {
      setCols(snapshot);
      toast.error(apiError(e, 'That move wasn’t saved'));
    }
  };

  const activeTask = active && Object.values(cols).flat().find((t) => t._id === active);
  const activeFrom = activeTask?.status;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a card" className="pl-8" />
        </div>
        <div className="w-full sm:w-56"><UserPicker multiple={false} value={assignee} onChange={setAssignee} placeholder="Anyone" /></div>
        <Select className="w-auto" value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
        </Select>
        <Select className="w-auto max-w-[14rem]" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">Any category</option>
          {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </Select>
      </div>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.isLoading ? (
        <div className="flex gap-3 overflow-hidden">{COLUMNS.map((c) => <Skeleton key={c} className="h-[60vh] w-[280px] shrink-0" />)}</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={({ active: a }) => setActive(a.id)} onDragCancel={() => setActive(null)} onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-3" style={{ minHeight: '60vh' }}>
            {COLUMNS.map((c) => (
              <Column key={c} status={c} tasks={filtered[c] || []} highlight={activeFrom ? activeFrom === c || (STATUS_TRANSITIONS[activeFrom] || []).includes(c) : undefined} />
            ))}
          </div>
          <DragOverlay>{activeTask ? <Card task={activeTask} overlay /> : null}</DragOverlay>
        </DndContext>
      )}
      <p className="mt-1 text-xs text-muted-foreground">Columns you can’t move a card into fade while dragging. Completed cards older than 30 days are hidden.</p>
    </div>
  );
}
