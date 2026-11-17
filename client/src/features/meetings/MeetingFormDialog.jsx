import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import UserPicker from '@/components/common/UserPicker';
import { useCreateMeetingMutation, useUpdateMeetingMutation, useCommitteesQuery, useProjectsQuery, useCommitteeQuery } from '@/services/endpoints';
import { useAction } from '@/hooks';
import { oid, toLocalInput } from '@/lib/utils';

export default function MeetingFormDialog({ open, onOpenChange, meeting, defaults = {}, onSaved }) {
  const run = useAction();
  const [create, cs] = useCreateMeetingMutation();
  const [update, us] = useUpdateMeetingMutation();
  const { data: committees } = useCommitteesQuery({ limit: 100 }, { skip: !open });
  const { data: projects } = useProjectsQuery({ limit: 100 }, { skip: !open });
  const [f, setF] = useState({});
  const [item, setItem] = useState('');
  const [error, setError] = useState('');
  const { data: committee } = useCommitteeQuery(f.committee, { skip: !open || !f.committee || !!meeting });

  useEffect(() => {
    if (!open) return;
    setError('');
    const start = new Date(Date.now() + 86400000);
    start.setHours(11, 0, 0, 0);
    setF(meeting ? {
      title: meeting.title, description: meeting.description || '', committee: oid(meeting.committee) || '', project: oid(meeting.project) || '',
      participants: (meeting.participants || []).map((p) => String(oid(p.user))), agenda: (meeting.agenda || []).map((a) => ({ title: a.title, durationMinutes: a.durationMinutes })),
      location: meeting.location || '', meetingLink: meeting.meetingLink || '', startAt: toLocalInput(meeting.startAt), endAt: toLocalInput(meeting.endAt),
    } : { title: '', description: '', committee: defaults.committee || '', project: defaults.project || '', participants: [], agenda: [], location: '', meetingLink: '', startAt: toLocalInput(defaults.startAt || start), endAt: toLocalInput(defaults.endAt || new Date(+start + 3600000)) });
  }, [open, meeting]); // eslint-disable-line react-hooks/exhaustive-deps

  const addCommitteeMembers = () => {
    if (!committee) return;
    const ids = committee.members.map((m) => String(oid(m.user)));
    setF((s) => ({ ...s, participants: [...new Set([...s.participants, ...ids])] }));
  };

  const save = async () => {
    if ((f.title || '').trim().length < 3) return setError('Give the meeting a title.');
    if (!f.startAt || !f.endAt || new Date(f.endAt) <= new Date(f.startAt)) return setError('The meeting must end after it starts.');
    const body = { ...f, committee: f.committee || null, project: f.project || null, startAt: new Date(f.startAt).toISOString(), endAt: new Date(f.endAt).toISOString(), agenda: f.agenda.map((a, i) => ({ ...a, order: i })) };
    const res = await run(meeting ? update({ id: oid(meeting), ...body }) : create(body), { success: meeting ? 'Meeting updated; participants were told about any time change' : 'Meeting scheduled; invitations sent' });
    if (res) { onOpenChange(false); onSaved?.(res); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{meeting ? 'Edit meeting' : 'Schedule a meeting'}</DialogTitle>
          <DialogDescription>Participants get an invitation now and a reminder an hour before it starts.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Title" required><Input autoFocus value={f.title || ''} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Monthly faculty meeting" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" required><Input type="datetime-local" value={f.startAt || ''} onChange={(e) => { const s = e.target.value; const dur = f.startAt && f.endAt ? new Date(f.endAt) - new Date(f.startAt) : 3600000; setF({ ...f, startAt: s, endAt: s ? toLocalInput(new Date(+new Date(s) + dur)) : f.endAt }); }} /></Field>
            <Field label="Ends" required><Input type="datetime-local" value={f.endAt || ''} onChange={(e) => setF({ ...f, endAt: e.target.value })} /></Field>
            <Field label="Location"><Input value={f.location || ''} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Room 401" /></Field>
            <Field label="Online meeting link"><Input type="url" value={f.meetingLink || ''} onChange={(e) => setF({ ...f, meetingLink: e.target.value })} placeholder="https://" /></Field>
            <Field label="Committee"><Select value={f.committee || ''} onChange={(e) => setF({ ...f, committee: e.target.value })}><option value="">None</option>{(committees?.items || []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></Field>
            <Field label="Project"><Select value={f.project || ''} onChange={(e) => setF({ ...f, project: e.target.value })}><option value="">None</option>{(projects?.items || []).map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}</Select></Field>
          </div>
          <Field label="Participants">
            <UserPicker value={f.participants || []} onChange={(v) => setF({ ...f, participants: v })} />
            {committee && !meeting && <button type="button" onClick={addCommitteeMembers} className="mt-1 text-xs font-medium text-primary hover:underline">Invite all {committee.members.length} members of {committee.name}</button>}
          </Field>
          <Field label="Agenda">
            <ol className="space-y-1">
              {(f.agenda || []).map((a, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                  <span className="tabular w-5 text-muted-foreground">{i + 1}.</span>
                  <span className="flex-1">{a.title}</span>
                  <button type="button" onClick={() => setF({ ...f, agenda: f.agenda.filter((_, k) => k !== i) })} aria-label={`Remove ${a.title}`} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ol>
            <div className="mt-1.5 flex gap-2">
              <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Add an agenda item" onKeyDown={(e) => { if (e.key === 'Enter' && item.trim()) { e.preventDefault(); setF({ ...f, agenda: [...(f.agenda || []), { title: item.trim() }] }); setItem(''); } }} />
              <Button type="button" variant="outline" onClick={() => { if (item.trim()) { setF({ ...f, agenda: [...(f.agenda || []), { title: item.trim() }] }); setItem(''); } }}><Plus /> Add</Button>
            </div>
          </Field>
          <Field label="Notes for participants"><Textarea rows={2} value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} loading={cs.isLoading || us.isLoading}>{meeting ? 'Save changes' : 'Schedule and invite'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
