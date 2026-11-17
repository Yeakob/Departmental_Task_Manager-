import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Pencil, Trash2, MapPin, Video, Plus, ArrowRightLeft, Check, X, Upload, FileText, Ban } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/label';
import { UserAvatar } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ErrorState, PageLoader } from '@/components/common/States';
import { RichTextEditor, RichTextView } from '@/components/common/RichText';
import { StatusBadge } from '@/components/common/TaskBits';
import UserPicker from '@/components/common/UserPicker';
import MeetingFormDialog from '@/features/meetings/MeetingFormDialog';
import { UploadDocumentDialog, DocumentDetailDialog } from '@/features/documents/DocumentDialogs';
import { MEETING_TONE } from './Meetings';
import {
  useMeetingQuery, useUpdateMeetingMutation, useDeleteMeetingMutation, useMeetingAttendanceMutation, useSaveMinutesMutation,
  useAddDecisionMutation, useUpdateDecisionMutation, useDeleteDecisionMutation, useConvertDecisionMutation, useCategoriesQuery,
} from '@/services/endpoints';
import { useAction, usePermissions } from '@/hooks';
import { fmtDate, fmtDateTime, oid, toLocalInput, PRIORITIES, PRIORITY_META, cn } from '@/lib/utils';

const ATTEND = { invited: 'Invited', accepted: 'Accepted', declined: 'Declined', present: 'Present', absent: 'Absent' };
const DECISION_STATUS = { open: 'Open', in_progress: 'In progress', implemented: 'Implemented', dropped: 'Dropped' };

function Minutes({ meeting, canManage }) {
  const run = useAction();
  const [save, st] = useSaveMinutesMutation();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(meeting.minutes?.body || '');
  const [upload, setUpload] = useState(false);
  const [docId, setDocId] = useState(null);
  useEffect(() => setBody(meeting.minutes?.body || ''), [meeting.minutes?.body]);
  return (
    <Panel>
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="font-semibold">Minutes</h2>
        {canManage && !editing && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setUpload(true)}><Upload /> Attach file</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil /> {meeting.minutes ? 'Edit' : 'Write minutes'}</Button>
          </div>
        )}
      </div>
      <div className="p-4">
        {editing ? (
          <div className="space-y-2">
            <RichTextEditor value={body} onChange={setBody} placeholder="Discussion points, decisions and who is responsible" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setEditing(false); setBody(meeting.minutes?.body || ''); }}>Cancel</Button>
              <Button loading={st.isLoading} onClick={async () => { if (await run(save({ id: meeting.id, body, document: oid(meeting.minutes?.document) || null }), { success: 'Minutes saved' })) setEditing(false); }}>Save minutes</Button>
            </div>
            <p className="text-xs text-muted-foreground">Attendance marked below is recorded with the minutes when you save.</p>
          </div>
        ) : (
          <>
            <RichTextView html={meeting.minutes?.body} empty={canManage ? 'No minutes yet. Write them here or attach a file.' : 'Minutes haven’t been recorded yet.'} />
            {meeting.minutes?.recordedBy && <p className="mt-3 text-xs text-muted-foreground">Recorded by {meeting.minutes.recordedBy.name}, {fmtDateTime(meeting.minutes.updatedAt)}</p>}
          </>
        )}
        {meeting.minutes?.document && (
          <button onClick={() => setDocId(oid(meeting.minutes.document))} className="mt-3 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"><FileText className="h-4 w-4" /> {meeting.minutes.document.title}</button>
        )}
      </div>
      <UploadDocumentDialog open={upload} onOpenChange={setUpload} defaultCategory="Meeting Minutes" links={{ meeting: meeting.id, committee: oid(meeting.committee) }} onUploaded={(d) => run(save({ id: meeting.id, body: meeting.minutes?.body || body || '', document: oid(d) }), { success: 'File attached to the minutes' })} />
      <DocumentDetailDialog id={docId} onOpenChange={(v) => !v && setDocId(null)} />
    </Panel>
  );
}

function ConvertDialog({ meeting, decision, onClose }) {
  const run = useAction();
  const navigate = useNavigate();
  const { data: categories = [] } = useCategoriesQuery();
  const [convert, st] = useConvertDecisionMutation();
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('');
  const [deadline, setDeadline] = useState(toLocalInput(decision.deadline));
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Turn decision into a task</DialogTitle>
          <DialogDescription>“{decision.title}” will be assigned to {decision.responsible.map((u) => u.name).join(', ')}, who are notified.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Deadline"><Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
          <Field label="Priority"><Select value={priority} onChange={(e) => setPriority(e.target.value)}>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}</Select></Field>
          <Field label="Category"><Select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Uncategorized</option>{categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={st.isLoading} onClick={async () => { const r = await run(convert({ id: meeting.id, decisionId: decision._id, priority, category: category || undefined, deadline: deadline ? new Date(deadline).toISOString() : undefined }), { success: 'Task created from the decision' }); if (r) { onClose(); navigate(`/tasks/${oid(r.task)}`); } }}>Create task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Decisions({ meeting, canManage }) {
  const run = useAction();
  const { can, user } = usePermissions();
  const [add, st] = useAddDecisionMutation();
  const [update] = useUpdateDecisionMutation();
  const [remove] = useDeleteDecisionMutation();
  const [form, setForm] = useState({ title: '', details: '', responsible: [], deadline: '' });
  const [adding, setAdding] = useState(false);
  const [converting, setConverting] = useState(null);
  const submit = async () => {
    if (form.title.trim().length < 2) return;
    if (await run(add({ id: meeting.id, ...form, deadline: form.deadline ? new Date(form.deadline).toISOString() : null }), { success: 'Decision recorded' })) {
      setForm({ title: '', details: '', responsible: [], deadline: '' });
      setAdding(false);
    }
  };
  return (
    <Panel>
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div><h2 className="font-semibold">Decisions</h2><p className="text-xs text-muted-foreground">Track each decision through to implementation.</p></div>
        {canManage && !adding && <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus /> Record decision</Button>}
      </div>
      {adding && (
        <div className="grid gap-3 border-b bg-muted/30 p-4 sm:grid-cols-2">
          <Field label="Decision" className="sm:col-span-2"><Input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What was decided" /></Field>
          <Field label="Details" className="sm:col-span-2"><Textarea rows={2} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} /></Field>
          <Field label="Responsible"><UserPicker value={form.responsible} onChange={(v) => setForm({ ...form, responsible: v })} /></Field>
          <Field label="Complete by"><Input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button><Button onClick={submit} loading={st.isLoading}>Save decision</Button></div>
        </div>
      )}
      {meeting.decisions.length === 0 && !adding ? <p className="px-4 py-6 text-sm text-muted-foreground">No decisions recorded.</p> : (
        <ul className="divide-y">
          {meeting.decisions.map((d) => {
            const mine = d.responsible.some((u) => String(oid(u)) === String(user?.id));
            return (
              <li key={d._id} className="px-4 py-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{d.title}</p>
                    {d.details && <p className="mt-0.5 text-sm text-muted-foreground">{d.details}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {d.responsible.map((u) => <span key={u._id} className="inline-flex items-center gap-1"><UserAvatar user={u} size={18} /> {u.name}</span>)}
                      {d.deadline && <span className={cn(new Date(d.deadline) < new Date() && !['implemented', 'dropped'].includes(d.status) && 'font-medium text-destructive')}>By {fmtDate(d.deadline)}</span>}
                    </div>
                  </div>
                  {canManage || mine ? (
                    <Select className="h-8 w-36" value={d.status} onChange={(e) => run(update({ id: meeting.id, decisionId: d._id, status: e.target.value }))} aria-label="Decision status">
                      {Object.entries(DECISION_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </Select>
                  ) : <Badge>{DECISION_STATUS[d.status]}</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {d.task ? (
                    <Link to={`/tasks/${d.task._id}`} className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs hover:bg-accent"><span className="task-code">{d.task.taskId}</span> <StatusBadge status={d.task.status} /> {d.task.progress}%</Link>
                  ) : canManage && can('task:assign') ? (
                    <Button size="sm" variant="outline" disabled={!d.responsible.length} title={!d.responsible.length ? 'Add a responsible person first' : undefined} onClick={() => setConverting(d)}><ArrowRightLeft /> Convert to task</Button>
                  ) : null}
                  {canManage && <Button size="sm" variant="ghost" onClick={() => run(remove({ id: meeting.id, decisionId: d._id }))}><Trash2 /> Delete</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {converting && <ConvertDialog meeting={meeting} decision={converting} onClose={() => setConverting(null)} />}
    </Panel>
  );
}

function Attendance({ meeting, canManage }) {
  const run = useAction();
  const { user } = usePermissions();
  const [mark, st] = useMeetingAttendanceMutation();
  const me = meeting.participants.find((p) => String(oid(p.user)) === String(user?.id));
  const counts = meeting.participants.reduce((a, p) => ({ ...a, [p.attendance]: (a[p.attendance] || 0) + 1 }), {});
  return (
    <Panel>
      <div className="border-b px-4 py-2.5">
        <h2 className="font-semibold">Participants</h2>
        <p className="text-xs text-muted-foreground">{Object.entries(counts).map(([k, n]) => `${n} ${ATTEND[k].toLowerCase()}`).join(', ') || 'No one invited'}</p>
      </div>
      {me && meeting.status === 'scheduled' && !canManage && (
        <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5 text-sm">
          <span className="flex-1">Will you attend?</span>
          <Button size="sm" variant={me.attendance === 'accepted' ? 'default' : 'outline'} loading={st.isLoading} onClick={() => run(mark({ id: meeting.id, rsvp: 'accepted' }), { success: 'Marked as attending' })}><Check /> Yes</Button>
          <Button size="sm" variant={me.attendance === 'declined' ? 'default' : 'outline'} onClick={() => run(mark({ id: meeting.id, rsvp: 'declined' }), { success: 'Marked as not attending' })}><X /> No</Button>
        </div>
      )}
      <ul className="divide-y">
        <li className="flex items-center gap-2 px-4 py-2 text-sm"><UserAvatar user={meeting.organizer} size={24} /><span className="flex-1 truncate">{meeting.organizer?.name}</span><Badge variant="primary">Organizer</Badge></li>
        {meeting.participants.map((p) => (
          <li key={oid(p.user)} className="flex items-center gap-2 px-4 py-2 text-sm">
            <UserAvatar user={p.user} size={24} />
            <span className="flex-1 truncate">{p.user?.name}</span>
            {canManage ? (
              <Select className="h-7 w-28 text-xs" value={p.attendance} onChange={(e) => run(mark({ id: meeting.id, entries: [{ user: oid(p.user), attendance: e.target.value }] }))} aria-label={`Attendance for ${p.user?.name}`}>
                {Object.entries(ATTEND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            ) : <span className="text-xs text-muted-foreground">{ATTEND[p.attendance]}</span>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default function MeetingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const run = useAction();
  const query = useMeetingQuery(id);
  const [update] = useUpdateMeetingMutation();
  const [del] = useDeleteMeetingMutation();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const m = query.data;
  if (query.isLoading) return <PageLoader />;
  if (query.isError) return <Panel><ErrorState error={query.error} onRetry={query.refetch} /></Panel>;
  const canManage = m.canManage;

  return (
    <div>
      <nav className="mb-3 flex items-center gap-1 text-sm text-muted-foreground"><Link to="/meetings" className="hover:text-foreground">Meetings</Link><ChevronRight className="h-3.5 w-3.5" /><span className="truncate">{m.title}</span></nav>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold">{m.title}</h1><Badge variant={MEETING_TONE[m.status]} className="capitalize">{m.status.replace('_', ' ')}</Badge></div>
          <p className="mt-1.5 text-sm">{fmtDate(m.startAt, 'EEEE, d MMMM yyyy')}, {fmtDate(m.startAt, 'h:mm a')} to {fmtDate(m.endAt, 'h:mm a')}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {m.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{m.location}</span>}
            {m.meetingLink && <a href={m.meetingLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><Video className="h-4 w-4" />Join online</a>}
            {m.committee && <Link to={`/committees/${oid(m.committee)}`} className="hover:underline">{m.committee.name}</Link>}
            {m.project && <Link to={`/projects/${oid(m.project)}`} className="hover:underline">{m.project.title}</Link>}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {m.status === 'scheduled' && new Date(m.startAt) < new Date() && <Button onClick={() => run(update({ id: m.id, status: 'completed' }), { success: 'Meeting marked as held' })}><Check /> Mark as held</Button>}
            <Button variant="outline" onClick={() => setEdit(true)}><Pencil /> Edit</Button>
            {m.status === 'scheduled' && <Button variant="outline" onClick={() => setConfirm('cancel')}><Ban /> Cancel meeting</Button>}
            <Button variant="outline" size="icon" aria-label="Delete meeting" onClick={() => setConfirm('delete')}><Trash2 /></Button>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {(m.agenda?.length > 0 || m.description) && (
            <Panel className="p-4">
              <h2 className="mb-2 font-semibold">Agenda</h2>
              {m.agenda?.length > 0 ? (
                <ol className="list-decimal space-y-1 pl-5 text-sm">{[...m.agenda].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((a) => <li key={a._id}>{a.title}{a.presenter && <span className="text-muted-foreground">, {a.presenter.name}</span>}{a.durationMinutes ? <span className="text-muted-foreground"> ({a.durationMinutes} min)</span> : null}</li>)}</ol>
              ) : <p className="text-sm text-muted-foreground">No agenda items.</p>}
              {m.description && <p className="mt-3 text-sm text-muted-foreground">{m.description}</p>}
            </Panel>
          )}
          <Minutes meeting={m} canManage={canManage} />
          <Decisions meeting={m} canManage={canManage} />
        </div>
        <aside><Attendance meeting={m} canManage={canManage} /></aside>
      </div>

      <MeetingFormDialog open={edit} onOpenChange={setEdit} meeting={m} />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={confirm === 'cancel' ? 'Cancel this meeting?' : 'Delete this meeting?'}
        description={confirm === 'cancel' ? 'Participants are notified that it’s cancelled. The record stays in the archive.' : 'Its minutes and decisions are removed from view. Tasks created from decisions are kept.'}
        confirmLabel={confirm === 'cancel' ? 'Cancel meeting' : 'Delete meeting'}
        onConfirm={async () => {
          if (confirm === 'cancel') { await run(update({ id: m.id, status: 'cancelled' }), { success: 'Meeting cancelled; participants notified' }); setConfirm(null); }
          else if (await run(del(m.id), { success: 'Meeting deleted' })) navigate('/meetings');
        }}
      />
    </div>
  );
}
