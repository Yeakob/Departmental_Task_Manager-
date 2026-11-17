import { Clock, AlertCircle } from 'lucide-react';
import { STATUS_META, PRIORITY_META, isOverdue, relativeDeadline, fmtDateTime, cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/misc';

export function StatusBadge({ status, className }) {
  const m = STATUS_META[status] || { label: status, tone: 'bg-muted' };
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', m.tone, className)}>{m.label}</span>;
}

export function PriorityBadge({ priority, showLabel = true, className }) {
  const m = PRIORITY_META[priority] || PRIORITY_META.medium;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium', m.tone, className)}>
      <span className={cn('h-2 w-2 rounded-full', m.dot)} />
      {showLabel && m.label}
    </span>
  );
}

export function DeadlineText({ task, className }) {
  if (!task?.deadline) return <span className={cn('text-xs text-muted-foreground', className)}>No deadline</span>;
  const overdue = isOverdue(task);
  return (
    <Tooltip content={fmtDateTime(task.deadline)}>
      <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-xs', overdue ? 'font-medium text-destructive' : 'text-muted-foreground', className)}>
        {overdue ? <AlertCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
        {overdue ? `Overdue (${relativeDeadline(task.deadline)})` : relativeDeadline(task.deadline)}
      </span>
    </Tooltip>
  );
}

export function CategoryTag({ category }) {
  if (!category) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="h-2 w-2 rounded-sm" style={{ background: category.color || '#94a3a0' }} />
      {category.name}
    </span>
  );
}
