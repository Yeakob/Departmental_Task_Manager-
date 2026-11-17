import { cn } from '@/lib/utils';

/** Bordered surface. Panels are the primary structural unit (no drop shadows). */
export const Panel = ({ className, ...props }) => <section className={cn('rounded-lg border bg-card text-card-foreground', className)} {...props} />;

export function PanelHeader({ title, description, actions, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b px-4 py-3', className)}>
      <div className="min-w-0">
        <h2 className="text-md font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export const PanelBody = ({ className, ...props }) => <div className={cn('p-4', className)} {...props} />;
