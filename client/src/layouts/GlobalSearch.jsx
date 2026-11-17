import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Command } from 'cmdk';
import * as D from '@radix-ui/react-dialog';
import { Search, ListTodo, FolderKanban, Users2, CalendarClock, FileText, User, History, Loader2 } from 'lucide-react';
import { setSearchOpen } from '@/store/uiSlice';
import { useSearchQuery, usePreferencesQuery } from '@/services/endpoints';
import { useDebounce } from '@/hooks';
import { StatusBadge } from '@/components/common/TaskBits';
import { fmtDate } from '@/lib/utils';

const GROUPS = [
  ['tasks', 'Tasks', ListTodo, (x) => `/tasks/${x._id}`, (x) => <><span className="task-code mr-2">{x.taskId}</span>{x.title}</>, (x) => <StatusBadge status={x.status} />],
  ['projects', 'Projects', FolderKanban, (x) => `/projects/${x._id}`, (x) => x.title],
  ['committees', 'Committees', Users2, (x) => `/committees/${x._id}`, (x) => x.name],
  ['meetings', 'Meetings', CalendarClock, (x) => `/meetings/${x._id}`, (x) => x.title, (x) => <span className="text-xs text-muted-foreground">{fmtDate(x.startAt)}</span>],
  ['documents', 'Documents', FileText, (x) => `/documents?open=${x._id}`, (x) => x.title, (x) => <span className="text-xs text-muted-foreground">{x.category}</span>],
  ['users', 'People', User, (x) => `/reports?tab=faculty&user=${x._id}`, (x) => x.name, (x) => <span className="text-xs text-muted-foreground">{x.designation}</span>],
];

export default function GlobalSearch() {
  const open = useSelector((s) => s.ui.searchOpen);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const dq = useDebounce(q.trim(), 250);
  const { data, isFetching } = useSearchQuery(dq, { skip: dq.length < 2 });
  const { data: prefs } = usePreferencesQuery(undefined, { skip: !open });

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        dispatch(setSearchOpen(true));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  const go = (to) => {
    dispatch(setSearchOpen(false));
    setQ('');
    navigate(to);
  };
  const total = data ? Object.values(data).reduce((n, a) => n + a.length, 0) : 0;

  return (
    <D.Root open={open} onOpenChange={(v) => dispatch(setSearchOpen(v))}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <D.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-lg border bg-popover shadow-2xl">
          <D.Title className="sr-only">Search</D.Title>
          <Command shouldFilter={false} label="Global search">
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Command.Input value={q} onValueChange={setQ} placeholder="Search tasks, IDs, projects, committees, meetings, documents, people…" className="h-12 flex-1 bg-transparent text-md outline-none placeholder:text-muted-foreground" />
              {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              {dq.length < 2 && (
                <>
                  {prefs?.recentSearches?.length ? (
                    <Command.Group heading="Recent searches" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground">
                      {prefs.recentSearches.map((s) => (
                        <Command.Item key={s} value={`recent-${s}`} onSelect={() => setQ(s)} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm aria-selected:bg-accent">
                          <History className="h-4 w-4 text-muted-foreground" /> {s}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : (
                    <p className="px-2 py-8 text-center text-sm text-muted-foreground">Type at least two characters. Task IDs like CSE-0012 work too.</p>
                  )}
                </>
              )}
              {dq.length >= 2 && !isFetching && total === 0 && <p className="px-2 py-8 text-center text-sm text-muted-foreground">Nothing matches “{dq}” in what you can access.</p>}
              {dq.length >= 2 &&
                data &&
                GROUPS.map(([key, label, Icon, href, title, meta]) =>
                  data[key]?.length ? (
                    <Command.Group key={key} heading={label} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground">
                      {data[key].map((x) => (
                        <Command.Item key={x._id} value={`${key}-${x._id}`} onSelect={() => go(href(x))} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm aria-selected:bg-accent">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{title(x)}</span>
                          {meta?.(x)}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null
                )}
            </Command.List>
          </Command>
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <span>↑↓ to move, Enter to open, Esc to close</span>
            <button className="hover:text-foreground" onClick={() => go(`/tasks?q=${encodeURIComponent(q)}`)} disabled={!q.trim()}>
              Advanced task search
            </button>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
