import * as A from '@radix-ui/react-alert-dialog';
import { buttonVariants } from './button';
import { cn } from '@/lib/utils';

/** Confirmation for destructive or irreversible actions. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', destructive = true, onConfirm, loading }) {
  return (
    <A.Root open={open} onOpenChange={onOpenChange}>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <A.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-popover p-5">
          <A.Title className="text-lg font-semibold">{title}</A.Title>
          {description && <A.Description className="mt-2 text-sm text-muted-foreground">{description}</A.Description>}
          <div className="mt-5 flex justify-end gap-2">
            <A.Cancel className={buttonVariants({ variant: 'outline' })}>Cancel</A.Cancel>
            <A.Action
              className={cn(buttonVariants({ variant: destructive ? 'destructive' : 'default' }))}
              disabled={loading}
              onClick={(e) => {
                e.preventDefault();
                onConfirm?.();
              }}
            >
              {confirmLabel}
            </A.Action>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
