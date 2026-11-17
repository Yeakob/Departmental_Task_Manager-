import { forwardRef } from 'react';
import * as T from '@radix-ui/react-tabs';
import * as Tip from '@radix-ui/react-tooltip';
import * as C from '@radix-ui/react-checkbox';
import * as S from '@radix-ui/react-switch';
import * as Av from '@radix-ui/react-avatar';
import * as Pr from '@radix-ui/react-progress';
import { Check } from 'lucide-react';
import { cn, initials } from '@/lib/utils';
import { useSelector } from 'react-redux';

// ---------- Tabs ----------
export const Tabs = T.Root;
export const TabsList = forwardRef(({ className, ...p }, ref) => <T.List ref={ref} className={cn('flex items-center gap-1 overflow-x-auto border-b', className)} {...p} />);
TabsList.displayName = 'TabsList';
export const TabsTrigger = forwardRef(({ className, ...p }, ref) => (
  <T.Trigger ref={ref} className={cn('-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground [&_svg]:size-4', className)} {...p} />
));
TabsTrigger.displayName = 'TabsTrigger';
export const TabsContent = forwardRef(({ className, ...p }, ref) => <T.Content ref={ref} className={cn('pt-4 outline-none', className)} {...p} />);
TabsContent.displayName = 'TabsContent';

// ---------- Tooltip ----------
export const TooltipProvider = Tip.Provider;
export function Tooltip({ content, children, side = 'top' }) {
  if (!content) return children;
  return (
    <Tip.Root delayDuration={300}>
      <Tip.Trigger asChild>{children}</Tip.Trigger>
      <Tip.Portal>
        <Tip.Content side={side} sideOffset={6} className="z-50 rounded-md bg-foreground px-2 py-1 text-xs text-background">
          {content}
        </Tip.Content>
      </Tip.Portal>
    </Tip.Root>
  );
}

// ---------- Checkbox / Switch ----------
export const Checkbox = forwardRef(({ className, ...p }, ref) => (
  <C.Root ref={ref} className={cn('peer h-4 w-4 shrink-0 rounded-sm border border-input bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground', className)} {...p}>
    <C.Indicator className="flex items-center justify-center">
      <Check className="h-3 w-3" strokeWidth={3} />
    </C.Indicator>
  </C.Root>
));
Checkbox.displayName = 'Checkbox';

export const Switch = forwardRef(({ className, ...p }, ref) => (
  <S.Root ref={ref} className={cn('peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input transition-colors data-[state=checked]:bg-primary', className)} {...p}>
    <S.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-surface shadow transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
  </S.Root>
));
Switch.displayName = 'Switch';

// ---------- Avatar ----------
const PALETTE = ['#1F6B52', '#2B7A9B', '#7A5BA6', '#B84A3C', '#8A6D3B', '#3F5E8C', '#5E8C3A', '#9B4F7A'];
const hash = (s = '') => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function useFileUrl(path) {
  const token = useSelector((s) => s.auth.accessToken);
  if (!path) return null;
  if (/^https?:/.test(path)) return path;
  return `${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token || '')}`;
}

export function UserAvatar({ user, size = 28, className }) {
  const src = useFileUrl(user?.avatar);
  const name = user?.name || '?';
  return (
    <Av.Root className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white', className)} style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38), background: PALETTE[hash(name) % PALETTE.length] }} title={name}>
      {src && <Av.Image src={src} alt={name} className="h-full w-full object-cover" />}
      <Av.Fallback delayMs={src ? 400 : 0}>{initials(name)}</Av.Fallback>
    </Av.Root>
  );
}

export function AvatarGroup({ users = [], max = 3, size = 24 }) {
  const shown = users.filter(Boolean).slice(0, max);
  const rest = users.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((u, i) => (
        <UserAvatar key={u._id || u.id || i} user={u} size={size} className="ring-2 ring-card" />
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card" style={{ width: size, height: size }}>
          +{rest}
        </span>
      )}
    </div>
  );
}

// ---------- Progress / Separator / Skeleton ----------
export function Progress({ value = 0, className, tone = 'bg-primary' }) {
  return (
    <Pr.Root className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-muted', className)} value={value}>
      <Pr.Indicator className={cn('h-full transition-all', tone)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </Pr.Root>
  );
}

export const Separator = ({ className, vertical }) => <div role="separator" className={cn(vertical ? 'mx-2 h-5 w-px' : 'my-3 h-px w-full', 'bg-border', className)} />;
export const Skeleton = ({ className }) => <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
