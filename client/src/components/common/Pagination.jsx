import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Pagination({ meta, onPage, onLimit }) {
  if (!meta || !meta.total) return null;
  const { page, pages, total, limit } = meta;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-sm text-muted-foreground">
      <span className="tabular">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        {onLimit && (
          <select aria-label="Rows per page" className="h-8 rounded-md border bg-surface px-2 text-sm" value={limit} onChange={(e) => onLimit(Number(e.target.value))}>
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n} per page</option>
            ))}
          </select>
        )}
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft /></Button>
        <span className="tabular">{page} / {pages}</span>
        <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight /></Button>
      </div>
    </div>
  );
}

/** Clickable sortable header: sort param "field" / "-field". */
export function SortHeader({ field, sort, onSort, children, className }) {
  const active = sort === field || sort === `-${field}`;
  const desc = sort === `-${field}`;
  return (
    <button type="button" className={`inline-flex items-center gap-1 font-medium hover:text-foreground ${className || ''}`} onClick={() => onSort(active && !desc ? `-${field}` : field)} aria-sort={active ? (desc ? 'descending' : 'ascending') : 'none'}>
      {children}
      <span className="text-[10px]">{active ? (desc ? '▼' : '▲') : ''}</span>
    </button>
  );
}
