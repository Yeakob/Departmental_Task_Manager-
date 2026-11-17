import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const field = 'flex w-full rounded-md border border-input bg-surface px-3 text-base placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive';

export const Input = forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input ref={ref} type={type} className={cn(field, 'h-9 py-1.5 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium', className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef(({ className, ...props }, ref) => <textarea ref={ref} className={cn(field, 'min-h-[80px] py-2', className)} {...props} />);
Textarea.displayName = 'Textarea';

// Arrow styling lives inline: tailwind-merge would read bg-[length:…]/bg-[position] as colour classes and drop bg-surface.
const SELECT_ARROW = {
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23778a83' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.6rem center',
  backgroundSize: '16px',
};

/** Styled native select — accessible, mobile-friendly and form-library friendly. */
export const Select = forwardRef(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(field, 'h-9 appearance-none pr-8', className)} style={SELECT_ARROW} {...props}>
    {children}
  </select>
));
Select.displayName = 'Select';
