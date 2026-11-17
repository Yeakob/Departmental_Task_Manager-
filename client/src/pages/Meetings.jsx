import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, CalendarClock, MapPin, Video } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import Pagination from '@/components/common/Pagination';
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/States';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AvatarGroup } from '@/components/ui/misc';
import MeetingFormDialog from '@/features/meetings/MeetingFormDialog';
import { useMeetingsQuery, useCommitteesQuery } from '@/services/endpoints';
import { useDebounce, usePermissions } from '@/hooks';
import { fmtDate, oid, cn } from '@/lib/utils';

export const MEETING_TONE = { scheduled: 'primary', in_progress: 'highlight', completed: 'default', cancelled: 'outline' };

export default function Meetings() {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('upcoming');
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [committee, setCommittee] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [defaults, setDefaults] = useState({});
  const { data: committees } = useCommitteesQuery({ limit: 100 });
  const query = useMeetingsQuery({ q: dq, committee, page, limit: 20, ...(tab === 'upcoming' ? { upcoming: 'true', status: 'scheduled,in_progress' } : tab === 'past' ? { to: new Date().toISOString() } : { mine: 'true' }) });

  useEffect(() => {
    if (params.get('new')) {
      setDefaults({ committee: params.get('committee') || '' });
      setOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const items = query.data?.items || [];
  return (
    <div>
      <PageHeader title="Meetings" description="Schedules, agendas, attendance, minutes and decisions, all searchable." actions={can('meeting:create') && <Button onClick={() => { setDefaults({}); setOpen(true); }}><Plus /> Schedule meeting</Button>} />
      <div className="mb-3 flex gap-1 border-b">
        {[['upcoming', 'Upcoming'], ['past', 'Archive'], ['mine', 'My meetings']].map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setPage(1); }} className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-medium', tab === k ? 'border-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{l}</button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative w-full sm:w-72"><Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search meetings" className="pl-8" /></div>
        <Select className="w-auto" value={committee} onChange={(e) => { setCommittee(e.target.value); setPage(1); }} aria-label="Committee"><option value="">All committees</option>{(committees?.items || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select>
      </div>
      <Panel className="overflow-hidden">
        {query.isLoading ? <RowsSkeleton /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : !items.length ? (
          <EmptyState icon={CalendarClock} title={tab === 'upcoming' ? 'No upcoming meetings' : 'No meetings found'} description={tab === 'upcoming' ? 'Scheduled meetings appear here with their agenda and participants.' : 'Try another search or committee.'} action={can('meeting:create') && tab === 'upcoming' && <Button variant="outline" onClick={() => setOpen(true)}><Plus /> Schedule meeting</Button>} />
        ) : (
          <ul className="divide-y">
            {items.map((m) => (
              <li key={m._id}>
                <Link to={`/meetings/${m._id}`} className="flex gap-4 px-4 py-3.5 hover:bg-accent/40">
                  <div className="w-12 shrink-0 overflow-hidden rounded-md border text-center leading-tight">
                    <p className="bg-primary-soft py-0.5 text-[10px] font-semibold text-primary">{fmtDate(m.startAt, 'MMM')}</p>
                    <p className="tabular py-1 text-lg font-semibold">{fmtDate(m.startAt, 'd')}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{m.title}</span><Badge variant={MEETING_TONE[m.status]} className="capitalize">{m.status.replace('_', ' ')}</Badge></div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <span>{fmtDate(m.startAt, 'EEE, h:mm a')} to {fmtDate(m.endAt, 'h:mm a')}</span>
                      {m.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{m.location}</span>}
                      {m.meetingLink && <span className="inline-flex items-center gap-1"><Video className="h-3 w-3" />Online</span>}
                      {m.committee && <span>{m.committee.name}</span>}
                    </p>
                  </div>
                  <div className="hidden sm:block"><AvatarGroup users={m.participants.map((p) => p.user)} max={4} /></div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pagination meta={query.data?.meta} onPage={setPage} />
      </Panel>
      <MeetingFormDialog open={open} onOpenChange={setOpen} defaults={defaults} onSaved={(m) => navigate(`/meetings/${oid(m)}`)} />
    </div>
  );
}
