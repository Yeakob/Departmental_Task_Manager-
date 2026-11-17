import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X, Star } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/misc';
import { useDirectoryQuery } from '@/services/endpoints';
import { cn, oid } from '@/lib/utils';

/**
 * Searchable people picker over the department directory.
 * value: array of ids (multiple) or a single id. `primary` marks the lead person.
 */
export default function UserPicker({ value, onChange, multiple = true, placeholder = 'Select people', exclude = [], primary, onPrimaryChange, disabled, invalid }) {
  const { data: users = [] } = useDirectoryQuery();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = multiple ? (value || []).map(String) : value ? [String(value)] : [];
  const byId = useMemo(() => new Map(users.map((u) => [String(oid(u)), u])), [users]);
  const options = users.filter((u) => !exclude.map(String).includes(String(oid(u))) && (`${u.name} ${u.email} ${u.designation || ''}`.toLowerCase().includes(q.toLowerCase())));

  const toggle = (id) => {
    if (!multiple) {
      onChange(id === selected[0] ? null : id);
      setOpen(false);
      return;
    }
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    onChange(next);
    if (onPrimaryChange && (!primary || !next.includes(String(primary)))) onPrimaryChange(next[0] || null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button type="button" aria-invalid={invalid} className={cn('flex min-h-9 w-full items-center gap-1.5 rounded-md border border-input bg-surface px-2 py-1 text-left text-base aria-[invalid=true]:border-destructive', disabled && 'opacity-50')}>
          <div className="flex flex-1 flex-wrap gap-1">
            {selected.length === 0 && <span className="px-1 text-muted-foreground">{placeholder}</span>}
            {selected.map((id) => {
              const u = byId.get(id);
              const isPrimary = multiple && onPrimaryChange && String(primary) === id;
              return (
                <span key={id} className={cn('inline-flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-1.5 text-xs', isPrimary && 'border-primary bg-primary-soft')}>
                  <UserAvatar user={u || { name: '?' }} size={18} />
                  {u?.name || 'Unknown'}
                  {isPrimary && <Star className="h-3 w-3 fill-primary text-primary" aria-label="Primary" />}
                  {multiple && (
                    <span role="button" tabIndex={-1} aria-label={`Remove ${u?.name}`} onClick={(e) => { e.stopPropagation(); toggle(id); }} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </span>
              );
            })}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="border-b p-2">
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or designation" className="h-8" />
        </div>
        <ul className="max-h-64 overflow-y-auto p-1" role="listbox">
          {options.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">No one matches “{q}”.</li>}
          {options.map((u) => {
            const id = String(oid(u));
            const on = selected.includes(id);
            return (
              <li key={id}>
                <button type="button" onClick={() => toggle(id)} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent">
                  <UserAvatar user={u} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{u.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{u.designation || u.email}</span>
                  </span>
                  {on && <Check className="h-4 w-4 text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
        {multiple && onPrimaryChange && selected.length > 1 && (
          <div className="border-t p-2">
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="primary-person">Primary responsible person</label>
            <select id="primary-person" className="h-8 w-full rounded-md border bg-surface px-2 text-sm" value={primary || ''} onChange={(e) => onPrimaryChange(e.target.value)}>
              {selected.map((id) => (
                <option key={id} value={id}>{byId.get(id)?.name}</option>
              ))}
            </select>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
