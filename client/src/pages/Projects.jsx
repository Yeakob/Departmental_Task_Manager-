import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, FolderKanban, CalendarRange } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import Pagination from '@/components/common/Pagination';
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/States';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { AvatarGroup, Progress, UserAvatar } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import ProjectFormDialog, { PROJECT_STATUS } from '@/features/projects/ProjectFormDialog';
import { useProjectsQuery } from '@/services/endpoints';
import { useDebounce, usePermissions } from '@/hooks';
import { fmtDate, oid, cn } from '@/lib/utils';

export const projectTone = { planning: 'default', active: 'primary', on_hold: 'highlight', completed: 'outline', archived: 'outline' };

export default function Projects() {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [status, setStatus] = useState('');
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const query = useProjectsQuery({ q: dq, status: status === 'archived' ? 'archived' : status, archived: status === 'archived' ? 'true' : undefined, mine: mine ? 'true' : undefined, page, limit: 20 });

  useEffect(() => {
    if (params.get('new')) { setOpen(true); setParams({}, { replace: true }); }
  }, [params, setParams]);

  const items = query.data?.items || [];
  return (
    <div>
      <PageHeader title="Projects" description="Larger departmental initiatives with their own team, milestones, tasks and documents." actions={can('project:create') && <Button onClick={() => setOpen(true)}><Plus /> New project</Button>} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search projects" className="pl-8" />
        </div>
        <Select className="w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
          <option value="">All current</option>
          {Object.entries(PROJECT_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="accent-[hsl(var(--primary))]" /> Only projects I’m on</label>
      </div>
      <Panel className="overflow-hidden">
        {query.isLoading ? <RowsSkeleton /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : !items.length ? (
          <EmptyState icon={FolderKanban} title={dq || status || mine ? 'No projects match' : 'No projects yet'} description="Create a project for work that spans many tasks and people, like accreditation or a curriculum revision." action={can('project:create') && <Button variant="outline" onClick={() => setOpen(true)}><Plus /> New project</Button>} />
        ) : (
          <ul className="divide-y">
            {items.map((p) => {
              const late = p.endDate && new Date(p.endDate) < new Date() && !['completed', 'archived'].includes(p.status);
              return (
                <li key={p._id}>
                  <Link to={`/projects/${p._id}`} className="grid gap-3 px-4 py-4 hover:bg-accent/40 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_10rem_8rem] md:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {p.code && <span className="task-code">{p.code}</span>}
                        <span className="truncate font-medium">{p.title}</span>
                        <Badge variant={projectTone[p.status]}>{PROJECT_STATUS[p.status]}</Badge>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarRange className="h-3.5 w-3.5" /> {p.startDate || p.endDate ? <>{fmtDate(p.startDate)} to <span className={cn(late && 'font-medium text-destructive')}>{fmtDate(p.endDate)}</span></> : 'No dates set'}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Progress value={p.stats?.progress || 0} className="flex-1" />
                        <span className="tabular w-10 text-right text-sm font-medium">{p.stats?.progress || 0}%</span>
                      </div>
                      <p className="tabular mt-1 text-xs text-muted-foreground">{p.stats?.completed || 0} of {p.stats?.total || 0} tasks done{p.stats?.overdue ? `, ${p.stats.overdue} overdue` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm"><UserAvatar user={p.manager} size={24} /><span className="truncate">{p.manager?.name}</span></div>
                    <AvatarGroup users={p.members} max={4} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination meta={query.data?.meta} onPage={setPage} />
      </Panel>
      <ProjectFormDialog open={open} onOpenChange={setOpen} onSaved={(p) => navigate(`/projects/${oid(p)}`)} />
    </div>
  );
}
