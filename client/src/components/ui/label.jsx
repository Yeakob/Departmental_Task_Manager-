import { forwardRef } from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

export const Label = forwardRef(({ className, ...props }, ref) => <LabelPrimitive.Root ref={ref} className={cn('text-sm font-medium leading-none', className)} {...props} />);
Label.displayName = 'Label';

/** Label + control + error/help text. */
export function Field({ label, htmlFor, error, help, required, className, children }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
    </div>
  );
}
