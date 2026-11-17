import { forwardRef } from 'react';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export const DialogContent = forwardRef(({ className, children, size = 'md', side, ...props }, ref) => {
  const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <D.Content
        ref={ref}
        className={cn(
          side === 'left'
            ? 'fixed inset-y-0 left-0 z-50 h-full w-72 border-r bg-sidebar data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left'
            : cn('fixed left-1/2 top-1/2 z-50 grid max-h-[92vh] w-[calc(100%-1.5rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-lg border bg-popover p-5 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0', sizes[size]),
          className
        )}
        {...props}
      >
        {children}
        {side !== 'left' && (
          <D.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </D.Close>
        )}
      </D.Content>
    </D.Portal>
  );
});
DialogContent.displayName = 'DialogContent';

export const DialogHeader = ({ className, ...p }) => <div className={cn('space-y-1 pr-6', className)} {...p} />;
export const DialogFooter = ({ className, ...p }) => <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...p} />;
export const DialogTitle = forwardRef(({ className, ...p }, ref) => <D.Title ref={ref} className={cn('text-lg font-semibold', className)} {...p} />);
DialogTitle.displayName = 'DialogTitle';
export const DialogDescription = forwardRef(({ className, ...p }, ref) => <D.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...p} />);
DialogDescription.displayName = 'DialogDescription';
