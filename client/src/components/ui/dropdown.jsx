import { forwardRef } from 'react';
import * as M from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;
export const DropdownMenuGroup = M.Group;

export const DropdownMenuContent = forwardRef(({ className, sideOffset = 6, align = 'end', ...props }, ref) => (
  <M.Portal>
    <M.Content ref={ref} sideOffset={sideOffset} align={align} className={cn('z-50 min-w-[11rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg shadow-black/5 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95', className)} {...props} />
  </M.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

export const DropdownMenuItem = forwardRef(({ className, destructive, ...props }, ref) => (
  <M.Item ref={ref} className={cn('relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground', destructive && 'text-destructive [&_svg]:text-destructive', className)} {...props} />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuLabel = ({ className, ...p }) => <M.Label className={cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', className)} {...p} />;
export const DropdownMenuSeparator = ({ className, ...p }) => <M.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...p} />;
