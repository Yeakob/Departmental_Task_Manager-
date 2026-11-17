import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { apiError, cn } from '@/lib/utils';

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {Icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }) {
  const status = error?.status;
  const message = status === 403 ? 'You don’t have access to this. Ask your chairman or administrator if you need it.' : status === 404 ? 'This item no longer exists or was moved to the recycle bin.' : apiError(error, 'The server didn’t respond. Check your connection and try again.');
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <AlertTriangle className="mb-2 h-6 w-6 text-highlight" />
      <p className="font-medium">{status === 403 ? 'Access restricted' : status === 404 ? 'Not found' : 'Couldn’t load this'}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && status !== 403 && status !== 404 && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function RowsSkeleton({ rows = 6, className }) {
  return (
    <div className={cn('space-y-2 p-4', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

/** Renders loading / error / empty / content for a RTK Query result. */
export function QueryState({ query, empty, isEmpty, skeleton, children }) {
  if (query.isLoading) return skeleton || <RowsSkeleton />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const data = query.data;
  const emptyCheck = isEmpty ? isEmpty(data) : Array.isArray(data) ? !data.length : Array.isArray(data?.items) ? !data.items.length : !data;
  if (emptyCheck && empty) return empty;
  return children(data);
}
