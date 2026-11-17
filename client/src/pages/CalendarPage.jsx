import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import multiMonthPlugin from '@fullcalendar/multimonth';
import interactionPlugin from '@fullcalendar/interaction';
import { Download, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/common/PageHeader';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/misc';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MeetingFormDialog from '@/features/meetings/MeetingFormDialog';
import { useCalendarEventsQuery, useCreateEventMutation, useUpdateEventMutation, useDeleteEventMutation, useRescheduleMutation } from '@/services/endpoints';
import { useAction, useDownload, usePermissions } from '@/hooks';
import { apiError, toLocalInput, fmtDateTime, cn } from '@/lib/utils';

const TYPES = [
  ['task', 'Task deadlines', '#2F6DB8'],
  ['meeting', 'Meetings', '#7c3aed'],
  ['exam', 'Examinations', '#9333ea'],
  ['seminar', 'Seminars', '#059669'],
  ['workshop', 'Workshops', '#16a34a'],
  ['event', 'Departmental events', '#0891b2'],
  ['academic', 'Academic milestones', '#ca8a04'],
  ['milestone', 'Project milestones', '#d97706'],
  ['session', 'Semester dates', '#0d9488'],
  ['holiday', 'Holidays', '#e11d48'],
  ['other', 'Other', '#475569'],
];
const EVENT_TYPES = ['exam', 'seminar', 'workshop', 'event', 'academic', 'holiday', 'other'];

function EventDialog({ open, onOpenChange, initial }) {
  const run = useAction();
  const [create, cs] = useCreateEventMutation();
  const [update, us] = useUpdateEventMutation();
  const [remove] = useDeleteEventMutation();
  const editing = initial?.id;
  const [f, setF] = useState({});
  useEffect(() => {
    if (open) setF({ title: initial?.title || '', type: initial?.type || 'event', description: initial?.description || '', location: initial?.location || '', allDay: initial?.allDay ?? false, startAt: toLocalInput(initial?.start), endAt: toLocalInput(initial?.end || (initial?.start && new Date(+new Date(initial.start) + 3600000))) });
  }, [open, initial]);
  const save = async () => {
    if (!f.title.trim() || !f.startAt) return toast.error('Add a title and a start time.');
    const body = { ...f, startAt: new Date(f.startAt).toISOString(), endAt: new Date(f.endAt || f.startAt).toISOString() };
    if (await run(editing ? update({ id: editing, ...body }) : create(body), { success: editing ? 'Event updated' : 'Event added to the calendar' })) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit event' : 'Add a calendar event'}</DialogTitle>
          <DialogDescription>For exams, seminars, holidays and other departmental dates. Use Meetings for anything with invitations and minutes.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2" required><Input autoFocus value={f.title || ''} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{EVENT_TYPES.map((t) => <option key={t} value={t}>{TYPES.find((x) => x[0] === t)[1]}</option>)}</Select></Field>
          <Field label="Location"><Input value={f.location || ''} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
          <Field label="Starts" required><Input type="datetime-local" value={f.startAt || ''} onChange={(e) => setF({ ...f, startAt: e.target.value })} /></Field>
          <Field label="Ends"><Input type="datetime-local" value={f.endAt || ''} onChange={(e) => setF({ ...f, endAt: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={!!f.allDay} onCheckedChange={(v) => setF({ ...f, allDay: !!v })} /> All-day event</label>
          <Field label="Description" className="sm:col-span-2"><Textarea rows={2} value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          {editing && <Button variant="ghost" className="mr-auto text-destructive" onClick={async () => { if (await run(remove(editing), { success: 'Event deleted' })) onOpenChange(false); }}><Trash2 /> Delete</Button>}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} loading={cs.isLoading || us.isLoading}>{editing ? 'Save' : 'Add event'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const download = useDownload();
  const { can } = usePermissions();
  const calRef = useRef(null);
  const [range, setRange] = useState(null);
  const [hidden, setHidden] = useState([]);
  const [mineOnly, setMineOnly] = useState(false);
  const [eventDialog, setEventDialog] = useState(null);
  const [meetingDefaults, setMeetingDefaults] = useState(null);
  const [choice, setChoice] = useState(null);
  const [reschedule] = useRescheduleMutation();
  const types = TYPES.map((t) => t[0]).filter((t) => !hidden.includes(t));
  const { data: events = [], isFetching } = useCalendarEventsQuery(range ? { from: range.from, to: range.to, types: hidden.length ? types : undefined, scope: mineOnly ? 'mine' : undefined } : undefined, { skip: !range });
  const canCreate = can('meeting:create', 'announcement:create');

  const fcEvents = events.map((e) => ({ id: e.id, title: e.title, start: e.start, end: e.end, allDay: e.allDay, backgroundColor: e.color, borderColor: e.color, editable: e.editable, extendedProps: { ...e.extendedProps, type: e.type, entityId: e.entityId, canEdit: e.editable } }));

  const onDrop = async (info) => {
    const { type, entityId } = info.event.extendedProps;
    const kind = type === 'task' ? 'task' : type === 'meeting' ? 'meeting' : 'event';
    try {
      await reschedule({ type: kind, id: entityId, start: info.event.start.toISOString(), end: info.event.end?.toISOString() }).unwrap();
      toast.success(kind === 'task' ? 'Deadline moved; assignees will see the new date' : 'Rescheduled');
    } catch (e) {
      info.revert();
      toast.error(apiError(e, 'Couldn’t reschedule'));
    }
  };

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Deadlines, meetings, exams, seminars and project milestones in one view. Drag to reschedule what you’re allowed to change."
        actions={
          <>
            <Button variant="outline" onClick={() => range && download(`/api/v1/calendar/export.ics?from=${range.from}&to=${range.to}${hidden.length ? `&types=${types.join(',')}` : ''}`, 'dwmt-calendar.ics')}><Download /> Export .ics</Button>
            {canCreate && <Button onClick={() => setEventDialog({})}><Plus /> Add event</Button>}
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Panel className="p-3">
            <p className="mb-2 text-sm font-semibold">Show</p>
            <ul className="space-y-1.5">
              {TYPES.map(([k, l, c]) => (
                <li key={k}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={!hidden.includes(k)} onCheckedChange={(v) => setHidden(v ? hidden.filter((x) => x !== k) : [...hidden, k])} />
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
                    {l}
                  </label>
                </li>
              ))}
            </ul>
            <label className="mt-3 flex items-center gap-2 border-t pt-3 text-sm"><Checkbox checked={mineOnly} onCheckedChange={(v) => setMineOnly(!!v)} /> Only my task deadlines</label>
          </Panel>
          <p className={cn('px-1 text-xs text-muted-foreground', !isFetching && 'invisible')}>Loading events…</p>
        </aside>
        <Panel className="min-w-0 p-3">
          <FullCalendar
            ref={calRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, multiMonthPlugin, interactionPlugin]}
            initialView={window.innerWidth < 640 ? 'listWeek' : 'dayGridMonth'}
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth,multiMonthYear,listMonth' }}
            buttonText={{ today: 'Today', timeGridDay: 'Day', timeGridWeek: 'Week', dayGridMonth: 'Month', multiMonthYear: 'Year', listMonth: 'Agenda' }}
            firstDay={6}
            height="auto"
            dayMaxEvents={3}
            nowIndicator
            events={fcEvents}
            datesSet={(d) => setRange({ from: d.start.toISOString(), to: d.end.toISOString() })}
            eventDrop={onDrop}
            eventResize={onDrop}
            selectable={canCreate}
            select={(s) => setChoice({ start: s.start, end: s.end, allDay: s.allDay })}
            eventClick={(info) => {
              info.jsEvent.preventDefault();
              const p = info.event.extendedProps;
              if (p.link) return navigate(p.link);
              if (EVENT_TYPES.includes(p.type) && p.canEdit) {
                setEventDialog({ id: p.entityId, title: info.event.title, type: p.type, description: p.description, location: p.location, allDay: info.event.allDay, start: info.event.start, end: info.event.end });
              } else {
                toast(info.event.title, { description: `${fmtDateTime(info.event.start)}${p.location ? `, ${p.location}` : ''}${p.description ? `. ${p.description}` : ''}` });
              }
            }}
            eventDidMount={(info) => { info.el.setAttribute('title', info.event.title); }}
          />
        </Panel>
      </div>

      <Dialog open={!!choice} onOpenChange={(v) => !v && setChoice(null)}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Add to {choice && fmtDateTime(choice.start)}</DialogTitle></DialogHeader>
          <div className="grid gap-2">
            <Button variant="outline" onClick={() => { setEventDialog({ start: choice.start, end: choice.end, allDay: choice.allDay }); setChoice(null); }}>Calendar event (exam, seminar, holiday…)</Button>
            {can('meeting:create') && <Button variant="outline" onClick={() => { setMeetingDefaults({ startAt: choice.allDay ? new Date(new Date(choice.start).setHours(11)) : choice.start, endAt: choice.allDay ? new Date(new Date(choice.start).setHours(12)) : choice.end }); setChoice(null); }}>Meeting with invitations</Button>}
          </div>
        </DialogContent>
      </Dialog>
      <EventDialog open={!!eventDialog} onOpenChange={(v) => !v && setEventDialog(null)} initial={eventDialog} />
      <MeetingFormDialog open={!!meetingDefaults} onOpenChange={(v) => !v && setMeetingDefaults(null)} defaults={meetingDefaults || {}} />
    </div>
  );
}
