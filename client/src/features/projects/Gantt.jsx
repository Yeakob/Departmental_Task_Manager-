import { Link } from 'react-router-dom';
import { eachMonthOfInterval, format, differenceInCalendarDays, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { Tooltip } from '@/components/ui/misc';
import { STATUS_META, isOverdue, fmtDate, cn } from '@/lib/utils';

/**
 * Lightweight Gantt timeline: one row per task (start → deadline), milestone
 * diamonds, month gridlines and a today line. Pure HTML, scrolls horizontally.
 */
export default function Gantt({ tasks = [], milestones = [], project }) {
  const startOf = (t) => new Date(t.startDate || t.createdAt);
  const endOf = (t) => new Date(t.deadline || addDays(startOf(t), 1));
  const dates = [
    ...tasks.flatMap((t) => [startOf(t), endOf(t)]),
    ...milestones.filter((m) => m.dueDate).map((m) => new Date(m.dueDate)),
    project?.startDate && new Date(project.startDate),
    project?.endDate && new Date(project.endDate),
    new Date(),
  ].filter(Boolean);
  if (!tasks.length && !milestones.length) return <p className="py-10 text-center text-sm text-muted-foreground">Add tasks with start dates and deadlines to see them on the timeline.</p>;

  const min = startOfMonth(new Date(Math.min(...dates)));
  const max = endOfMonth(new Date(Math.max(...dates)));
  const total = differenceInCalendarDays(max, min) + 1;
  const pct = (d) => (differenceInCalendarDays(d, min) / total) * 100;
  const months = eachMonthOfInterval({ start: min, end: max });
  const width = Math.max(720, months.length * 140);
  const today = pct(new Date());

  const barTone = (t) => (t.status === 'completed' ? 'bg-emerald-600' : isOverdue(t) ? 'bg-destructive' : t.status === 'under_review' ? 'bg-violet-600' : 'bg-primary');

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: width + 240 }}>
        <div className="flex border-b text-xs text-muted-foreground">
          <div className="w-60 shrink-0 px-3 py-2 font-medium">Task</div>
          <div className="relative flex-1">
            {months.map((m) => (
              <div key={+m} className="absolute top-0 border-l px-2 py-2" style={{ left: `${pct(m)}%` }}>{format(m, 'MMM yyyy')}</div>
            ))}
            <div className="h-8" />
          </div>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-60 right-0">
            {months.map((m) => <div key={+m} className="absolute inset-y-0 border-l border-dashed" style={{ left: `${pct(m)}%` }} />)}
            {today >= 0 && today <= 100 && (
              <div className="absolute inset-y-0 w-px bg-highlight" style={{ left: `${today}%` }}>
                <span className="absolute -top-0 left-1 rounded bg-highlight px-1 text-[10px] font-medium text-[#1b1a14]">Today</span>
              </div>
            )}
          </div>
          {milestones.length > 0 && (
            <div className="flex items-center border-b bg-muted/30">
              <div className="w-60 shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground">Milestones</div>
              <div className="relative h-9 flex-1">
                {milestones.filter((m) => m.dueDate).map((m) => (
                  <Tooltip key={m._id} content={`${m.title}, ${fmtDate(m.dueDate)} (${m.status.replace('_', ' ')})`}>
                    <span className={cn('absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-card', m.status === 'completed' ? 'bg-emerald-600' : 'bg-highlight')} style={{ left: `${pct(new Date(m.dueDate))}%` }} aria-label={m.title} />
                  </Tooltip>
                ))}
              </div>
            </div>
          )}
          {tasks.map((t) => {
            const s = pct(startOf(t));
            const e = pct(addDays(endOf(t), 1));
            return (
              <div key={t._id} className="flex items-center border-b last:border-0 hover:bg-accent/40">
                <Link to={`/tasks/${t._id}`} className="w-60 shrink-0 truncate px-3 py-2 text-sm hover:underline"><span className="task-code mr-1">{t.taskId}</span>{t.title}</Link>
                <div className="relative h-9 flex-1">
                  <Tooltip content={`${STATUS_META[t.status]?.label}: ${fmtDate(startOf(t))} to ${fmtDate(endOf(t))}, ${t.progress}% done${t.dependsOn?.length ? `, depends on ${t.dependsOn.length}` : ''}`}>
                    <div className={cn('absolute top-1/2 h-5 -translate-y-1/2 overflow-hidden rounded-[4px] opacity-90', barTone(t))} style={{ left: `${s}%`, width: `${Math.max(0.8, e - s)}%` }}>
                      <div className="h-full bg-white/30" style={{ width: `${t.progress}%` }} />
                    </div>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 px-1 text-xs text-muted-foreground">Bars run from start date to deadline; the lighter part shows progress. Green is completed, red is overdue, purple is under review. Diamonds are milestones.</p>
    </div>
  );
}
