import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Users2 } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/States';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AvatarGroup, Progress, UserAvatar } from '@/components/ui/misc';
import CommitteeFormDialog from '@/features/committees/CommitteeFormDialog';
import { useCommitteesQuery } from '@/services/endpoints';
import { useDebounce, usePermissions } from '@/hooks';
import { oid } from '@/lib/utils';

export default function Committees() {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [mine, setMine] = useState(false);
  const dq = useDebounce(q);
  const [open, setOpen] = useState(false);
  const query = useCommitteesQuery({ q: dq, mine: mine ? 'true' : undefined, limit: 100 });
  useEffect(() => { if (params.get('new')) { setOpen(true); setParams({}, { replace: true }); } }, [params, setParams]);
  const items = query.data?.items || [];

  return (
    <div>
      <PageHeader title="Committees" description="Standing committees, their members, and the work assigned to them." actions={can('committee:create') && <Button onClick={() => setOpen(true)}><Plus /> New committee</Button>} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search committees" className="pl-8" />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="accent-[hsl(var(--primary))]" /> Only committees I’m on</label>
      </div>
      <Panel className="overflow-hidden">
        {query.isLoading ? <RowsSkeleton /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : !items.length ? (
          <EmptyState icon={Users2} title="No committees" description="Create committees such as Examination or IQAC to assign work to a group." action={can('committee:create') && <Button variant="outline" onClick={() => setOpen(true)}><Plus /> New committee</Button>} />
        ) : (
          <ul className="divide-y">
            {items.map((c) => (
              <li key={c._id}>
                <Link to={`/committees/${c._id}`} className="grid gap-3 px-4 py-4 hover:bg-accent/40 md:grid-cols-[minmax(0,1.4fr)_12rem_minmax(0,1fr)_7rem] md:items-center">
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.responsibilities?.slice(0, 3).join(', ') || c.description || 'No responsibilities listed'}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm"><UserAvatar user={c.coordinator} size={24} /><span className="truncate">{c.coordinator?.name}</span></div>
                  <div>
                    <div className="flex items-center gap-2"><Progress value={c.stats?.progress || 0} className="flex-1" /><span className="tabular w-10 text-right text-sm">{c.stats?.progress || 0}%</span></div>
                    <p className="tabular mt-1 text-xs text-muted-foreground">{c.stats?.completed || 0} of {c.stats?.total || 0} tasks done{c.stats?.overdue ? `, ${c.stats.overdue} overdue` : ''}</p>
                  </div>
                  <AvatarGroup users={c.members.map((m) => m.user)} max={4} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <CommitteeFormDialog open={open} onOpenChange={setOpen} onSaved={(c) => navigate(`/committees/${oid(c)}`)} />
    </div>
  );
}
