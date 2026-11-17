import { cn } from '@/lib/utils';

export function Badge({ className, variant = 'default', ...props }) {
  const variants = {
    default: 'bg-secondary text-secondary-foreground',
    primary: 'bg-primary-soft text-primary',
    outline: 'border border-border text-foreground',
    highlight: 'bg-highlight-soft text-amber-800 dark:text-amber-300',
    destructive: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', variants[variant], className)} {...props} />;
}
