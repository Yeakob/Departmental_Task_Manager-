import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { MoreHorizontal, Pencil, Copy, Trash2, Eye, EyeOff, Share2, UserPlus, Forward, CalendarPlus, Send, CheckCircle2, ListPlus, ChevronDown, Hand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/misc';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { ConfirmDialog } from '@/components/ui/confirm';
import UserPicker from '@/components/common/UserPicker';
import FileDrop from '@/components/common/FileDrop';
import { openTaskForm } from '@/store/uiSlice';
import {
  useChangeStatusMutation, useSubmitTaskMutation, useDecideApprovalMutation, useAssignTaskMutation, useDelegateTaskMutation, useRequestExtensionMutation,
  useWatchTaskMutation, useDuplicateTaskMutation, useDeleteTaskMutation, useAttachmentsQuery, useUploadAttachmentsMutation,
} from '@/services/endpoints';
import { useAction, usePermissions } from '@/hooks';
import { STATUS_META, STATUS_TRANSITIONS, oid, toLocalInput, fileSize } from '@/lib/utils';

/** Derives what the current user may do with a task (mirrors server rules). */
export function useTaskAbilities(task) {
  const { can, user, isSuperAdmin } = usePermissions();
  const me = String(user?.id);
  const isAssignee = (task?.assignees || []).some((a) => String(oid(a.user)) === me);
  const isOwner = String(oid(task?.assignedBy)) === me;
  const isSupporter = (task?.supporters || []).some((u) => String(oid(u)) === me);
  const isWatcher = (task?.watchers || []).some((w) => String(oid(w)) === me);
  const manager = isSuperAdmin || can('task:update_any') || isOwner;
  const approver = isSuperAdmin || (task?.approvers || []).some((u) => String(oid(u)) === me) || (can('task:approve') && !isAssignee) || (isOwner && !task?.approvers?.length);
  return {
    isAssignee,
    isSupporter,
    isOwner,
    isWatcher,
    manager,
    canEdit: manager || (isAssignee && can('task:update_own')),
    canAssign: can('task:assign') && manager,
    canDelegate: isAssignee && can('task:assign'),
    canReview: approver && task?.status === 'under_review',
    canSubmit: (isAssignee || can('task:update_any')) && ['assigned', 'acknowledged', 'in_progress', 'revision_required'].includes(task?.status),
    canExtend: isAssignee && can('task:extension_request') && !['completed', 'cancelled', 'rejected'].includes(task?.status),
    canDelete: can('task:delete') || (task?.isPersonal && isOwner),
  };
}

export default function TaskActions({ task }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const run = useAction();
  const ab = useTaskAbilities(task);
  const id = oid(task);
  const [dialog, setDialog] = useState(null);
  const [changeStatus] = useChangeStatusMutation();
  const [watch] = useWatchTaskMutation();
  const [duplicate] = useDuplicateTaskMutation();
  const [del, delState] = useDeleteTaskMutation();

  const transitions = (STATUS_TRANSITIONS[task.status] || []).filter((s) => {
    if (['completed'].includes(s) && task.requiresApproval && task.status !== 'under_review') return false; // must go through approval
    if (['under_review'].includes(s)) return false; // via Submit
    if (task.status === 'under_review') return false; // via Review
    if (!ab.manager && ['cancelled', 'assigned'].includes(s)) return false;
    return ab.canEdit;
  });

  const close = () => setDialog(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ab.isAssignee && task.status === 'assigned' && (
        <Button onClick={() => run(changeStatus({ id, status: 'acknowledged' }), { success: 'Acknowledged; the assigner has been told you received it.' })}><Hand /> Acknowledge</Button>
      )}
      {ab.isAssignee && ['acknowledged', 'revision_required'].includes(task.status) && (
        <Button variant="outline" onClick={() => run(changeStatus({ id, status: 'in_progress' }), { success: 'Marked as in progress' })}>Start work</Button>
      )}
      {ab.canSubmit && ['in_progress', 'revision_required', 'acknowledged'].includes(task.status) && (
        <Button onClick={() => setDialog('submit')}><Send /> {task.requiresApproval ? 'Submit for approval' : 'Mark complete'}</Button>
      )}
      {ab.canReview && <Button onClick={() => setDialog('review')}><CheckCircle2 /> Review submission</Button>}

      {transitions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Change status <ChevronDown /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {transitions.map((s) => (
              <DropdownMenuItem key={s} onSelect={() => run(changeStatus({ id, status: s }), { success: `Status changed to ${STATUS_META[s].label.toLowerCase()}` })}>{STATUS_META[s].label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          {ab.canEdit && <DropdownMenuItem onSelect={() => dispatch(openTaskForm({ task }))}><Pencil /> Edit details</DropdownMenuItem>}
          {ab.canAssign && <DropdownMenuItem onSelect={() => setDialog('assign')}><UserPlus /> Reassign or add people</DropdownMenuItem>}
          {ab.canDelegate && <DropdownMenuItem onSelect={() => setDialog('delegate')}><Forward /> Delegate my part</DropdownMenuItem>}
          {ab.canExtend && <DropdownMenuItem onSelect={() => setDialog('extend')}><CalendarPlus /> Request deadline extension</DropdownMenuItem>}
          {ab.manager && !task.parentTask && <DropdownMenuItem onSelect={() => dispatch(openTaskForm({ parentTask: id, project: oid(task.project), committee: oid(task.committee) }))}><ListPlus /> Add subtask</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => run(watch({ id, watch: !ab.isWatcher }), { success: ab.isWatcher ? 'You will no longer get updates' : 'You will get updates on this task' })}>
            {ab.isWatcher ? <><EyeOff /> Stop watching</> : <><Eye /> Watch</>}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('share')}><Share2 /> Share or QR code</DropdownMenuItem>
          {ab.manager && (
            <DropdownMenuItem onSelect={async () => { const t = await run(duplicate(id), { success: 'Task duplicated as a draft' }); if (t) navigate(`/tasks/${oid(t)}`); }}><Copy /> Duplicate</DropdownMenuItem>
          )}
          {ab.canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setDialog('delete')}><Trash2 /> Move to recycle bin</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === 'submit' && <SubmitDialog task={task} onClose={close} />}
      {dialog === 'review' && <ReviewDialog task={task} onClose={close} />}
      {dialog === 'assign' && <AssignDialog task={task} onClose={close} />}
      {dialog === 'delegate' && <DelegateDialog task={task} onClose={close} />}
      {dialog === 'extend' && <ExtensionDialog task={task} onClose={close} />}
      {dialog === 'share' && <ShareDialog task={task} onClose={close} />}
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(v) => !v && close()}
        title={`Move ${task.taskId} to the recycle bin?`}
        description="Assignees lose access to it. Authorized users can restore it from Settings, Recycle bin."
        confirmLabel="Move to recycle bin"
        loading={delState.isLoading}
        onConfirm={async () => { if (await run(del(id), { success: 'Task moved to the recycle bin' })) navigate('/tasks'); }}
      />
    </div>
  );
}

function SubmitDialog({ task, onClose }) {
  const id = oid(task);
  const run = useAction();
  const { data: files = [] } = useAttachmentsQuery(id);
  const [upload, up] = useUploadAttachmentsMutation();
  const [submit, st] = useSubmitTaskMutation();
  const [note, setNote] = useState('');
  const [picked, setPicked] = useState([]);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task.requiresApproval ? 'Submit for approval' : 'Mark as complete'}</DialogTitle>
          <DialogDescription>{task.requiresApproval ? 'The reviewer is notified and can approve it or ask for changes.' : 'This task doesn’t need approval, so it will be marked completed.'}</DialogDescription>
        </DialogHeader>
        <Field label="Note to reviewer">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you did, anything the reviewer should check" />
        </Field>
        <Field label="Deliverables" help="Choose the files that make up this submission. Earlier versions stay in the approval history.">
          <div className="space-y-2">
            <FileDrop onFiles={async (fs) => { const res = await run(upload({ id, files: fs })); if (Array.isArray(res)) setPicked((p) => [...p, ...res.map((r) => oid(r))]); }} hint="Upload new deliverable files" />
            {up.isLoading && <p className="text-xs text-muted-foreground">Uploading…</p>}
            {files.length > 0 && (
              <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
                {files.map((f) => (
                  <li key={f._id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <Checkbox id={`f-${f._id}`} checked={picked.includes(f._id)} onCheckedChange={(v) => setPicked(v ? [...picked, f._id] : picked.filter((x) => x !== f._id))} />
                    <label htmlFor={`f-${f._id}`} className="flex-1 truncate">{f.originalName}</label>
                    <span className="text-xs text-muted-foreground">{fileSize(f.size)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={st.isLoading} onClick={async () => { if (await run(submit({ id, note: note || undefined, attachmentIds: picked }), { success: task.requiresApproval ? 'Submitted for approval' : 'Task completed' })) onClose(); }}>
            {task.requiresApproval ? 'Submit for approval' : 'Mark complete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({ task, onClose }) {
  const run = useAction();
  const [decide, st] = useDecideApprovalMutation();
  const [comment, setComment] = useState('');
  const go = async (decision, msg) => {
    if (decision !== 'approved' && !comment.trim()) return toast.error('Add a comment explaining what needs to change.');
    if (await run(decide({ id: oid(task), decision, comment: comment || undefined }), { success: msg })) onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review {task.taskId}</DialogTitle>
          <DialogDescription>Check the deliverables in the Approvals tab before deciding. The assignees are notified of your decision.</DialogDescription>
        </DialogHeader>
        <Field label="Comment" help="Required when requesting a revision or rejecting.">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Feedback for the assignee" />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="outline" className="text-destructive" disabled={st.isLoading} onClick={() => go('rejected', 'Submission rejected')}>Reject</Button>
          <Button variant="outline" disabled={st.isLoading} onClick={() => go('revision_requested', 'Revision requested')}>Request revision</Button>
          <Button loading={st.isLoading} onClick={() => go('approved', 'Approved; the task is completed')}>Approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ task, onClose }) {
  const run = useAction();
  const [assign, st] = useAssignTaskMutation();
  const current = (task.assignees || []).map((a) => String(oid(a.user)));
  const [mode, setMode] = useState('replace');
  const [people, setPeople] = useState(current);
  const [primary, setPrimary] = useState(String(oid((task.assignees || []).find((a) => a.isPrimary)?.user) || current[0] || ''));
  const [note, setNote] = useState('');
  const [deadline, setDeadline] = useState(toLocalInput(task.deadline));
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign {task.taskId}</DialogTitle>
          <DialogDescription>Newly added people are notified. Assignment history is kept on the task.</DialogDescription>
        </DialogHeader>
        <Field label="Change">
          <Select value={mode} onChange={(e) => { setMode(e.target.value); setPeople(e.target.value === 'add' ? [] : current); }}>
            <option value="replace">Replace the assignees</option>
            <option value="add">Add more people</option>
          </Select>
        </Field>
        <Field label={mode === 'add' ? 'People to add' : 'Assignees'}>
          <UserPicker value={people} onChange={setPeople} primary={mode === 'replace' ? primary : undefined} onPrimaryChange={mode === 'replace' ? setPrimary : undefined} exclude={mode === 'add' ? current : []} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Deadline"><Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
          <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason or instructions" /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            loading={st.isLoading}
            disabled={!people.length}
            onClick={async () => {
              const assignees = people.map((u) => ({ user: u, isPrimary: mode === 'replace' && String(u) === String(primary || people[0]) }));
              if (await run(assign({ id: oid(task), assignees, mode, note: note || undefined, deadline: deadline ? new Date(deadline).toISOString() : undefined }), { success: 'Assignment updated' })) onClose();
            }}
          >
            Save assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DelegateDialog({ task, onClose }) {
  const run = useAction();
  const [delegate, st] = useDelegateTaskMutation();
  const [to, setTo] = useState(null);
  const [note, setNote] = useState('');
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Delegate your part</DialogTitle>
          <DialogDescription>The person you choose takes your place on the task. You stay on as a watcher.</DialogDescription>
        </DialogHeader>
        <Field label="Delegate to"><UserPicker multiple={false} value={to} onChange={setTo} exclude={(task.assignees || []).map((a) => oid(a.user))} /></Field>
        <Field label="Note"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Context for the new assignee" /></Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={st.isLoading} disabled={!to} onClick={async () => { if (await run(delegate({ id: oid(task), to, note: note || undefined }), { success: 'Task delegated' })) onClose(); }}>Delegate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExtensionDialog({ task, onClose }) {
  const run = useAction();
  const [request, st] = useRequestExtensionMutation();
  const [date, setDate] = useState(toLocalInput(task.deadline ? new Date(new Date(task.deadline).getTime() + 3 * 86400000) : new Date(Date.now() + 7 * 86400000)));
  const [reason, setReason] = useState('');
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Request a deadline extension</DialogTitle>
          <DialogDescription>The person who assigned the task decides. The current deadline stays until they approve.</DialogDescription>
        </DialogHeader>
        <Field label="New deadline" required><Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Reason" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why the extra time is needed" /></Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={st.isLoading} disabled={!date || reason.trim().length < 3} onClick={async () => { if (await run(request({ id: oid(task), requestedDeadline: new Date(date).toISOString(), reason }), { success: 'Extension requested' })) onClose(); }}>Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShareDialog({ task, onClose }) {
  const url = `${window.location.origin}/tasks/${oid(task)}`;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Share {task.taskId}</DialogTitle>
          <DialogDescription>Only people with access to this task can open the link. Print the QR code on paper notices or files.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center rounded-md border bg-white p-4">
          <QRCodeSVG value={url} size={180} fgColor="#13231D" />
        </div>
        <div className="flex gap-2">
          <Input readOnly value={url} onFocus={(e) => e.target.select()} />
          <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(url); toast.success('Link copied'); }}><Copy /> Copy</Button>
        </div>
        <p className="text-center text-sm"><span className="task-code text-sm">{task.taskId}</span> {task.title}</p>
      </DialogContent>
    </Dialog>
  );
}

