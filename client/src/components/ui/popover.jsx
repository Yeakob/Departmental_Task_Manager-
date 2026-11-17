import { forwardRef } from 'react';
import * as P from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export const PopoverContent = forwardRef(({ className, align = 'start', sideOffset = 6, ...props }, ref) => (
  <P.Portal>
    <P.Content ref={ref} align={align} sideOffset={sideOffset} className={cn('z-50 w-72 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg shadow-black/5 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0', className)} {...props} />
  </P.Portal>
));
PopoverContent.displayName = 'PopoverContent';
