import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { UserAvatar } from '@/components/ui/misc';
import UserPicker from '@/components/common/UserPicker';
import { useCreateCommitteeMutation, useUpdateCommitteeMutation, useDirectoryQuery } from '@/services/endpoints';
import { useAction } from '@/hooks';
import { oid } from '@/lib/utils';

export default function CommitteeFormDialog({ open, onOpenChange, committee, onSaved }) {
  const run = useAction();
  const [create, cs] = useCreateCommitteeMutation();
  const [update, us] = useUpdateCommitteeMutation();
  const { data: users = [] } = useDirectoryQuery();
  const byId = new Map(users.map((u) => [String(oid(u)), u]));
  const [f, setF] = useState({});
  const [resp, setResp] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setF(committee ? {
      name: committee.name, description: committee.description || '', coordinator: String(oid(committee.coordinator)),
      members: (committee.members || []).filter((m) => String(oid(m.user)) !== String(oid(committee.coordinator))).map((m) => ({ user: String(oid(m.user)), role: m.role })),
      responsibilities: committee.responsibilities || [], meetingSchedule: committee.meetingSchedule || '',
    } : { name: '', description: '', coordinator: null, members: [], responsibilities: [], meetingSchedule: '' });
  }, [open, committee]);

  const memberIds = (f.members || []).map((m) => m.user);
  const save = async () => {
    if ((f.name || '').trim().length < 3) return setError('Give the committee a name of at least 3 characters.');
    if (!f.coordinator) return setError('Choose a coordinator.');
    const body = { ...f, members: f.members.filter((m) => m.user !== f.coordinator) };
    const res = await run(committee ? update({ id: oid(committee), ...body }) : create(body), { success: committee ? 'Committee updated' : 'Committee created; members have been notified' });
    if (res) { onOpenChange(false); onSaved?.(res); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{committee ? 'Edit committee' : 'New committee'}</DialogTitle>
          <DialogDescription>The coordinator can assign tasks to members, schedule meetings and record minutes.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" required><Input autoFocus value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Examination Committee" /></Field>
          <Field label="Description"><Textarea rows={2} value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Coordinator" required><UserPicker multiple={false} value={f.coordinator} onChange={(v) => setF({ ...f, coordinator: v })} /></Field>
            <Field label="Meeting schedule"><Input value={f.meetingSchedule || ''} onChange={(e) => setF({ ...f, meetingSchedule: e.target.value })} placeholder="First Sunday of every month" /></Field>
          </div>
          <Field label="Members">
            <UserPicker value={memberIds} onChange={(ids) => setF({ ...f, members: ids.map((id) => f.members.find((m) => m.user === id) || { user: id, role: 'member' }) })} exclude={f.coordinator ? [f.coordinator] : []} />
            {f.members?.length > 0 && (
              <ul className="mt-2 divide-y rounded-md border">
                {f.members.map((m) => (
                  <li key={m.user} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <UserAvatar user={byId.get(m.user)} size={22} />
                    <span className="flex-1 truncate">{byId.get(m.user)?.name}</span>
                    <Select className="h-8 w-32" value={m.role} onChange={(e) => setF({ ...f, members: f.members.map((x) => (x.user === m.user ? { ...x, role: e.target.value } : x)) })} aria-label="Role in committee">
                      <option value="member">Member</option>
                      <option value="secretary">Secretary</option>
                      <option value="coordinator">Co-coordinator</option>
                    </Select>
                  </li>
                ))}
              </ul>
            )}
          </Field>
          <Field label="Responsibilities">
            <ul className="space-y-1">
              {(f.responsibilities || []).map((r, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                  <span className="flex-1">{r}</span>
                  <button type="button" onClick={() => setF({ ...f, responsibilities: f.responsibilities.filter((_, k) => k !== i) })} aria-label={`Remove ${r}`} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
            <div className="mt-1.5 flex gap-2">
              <Input value={resp} onChange={(e) => setResp(e.target.value)} placeholder="Add a responsibility" onKeyDown={(e) => { if (e.key === 'Enter' && resp.trim()) { e.preventDefault(); setF({ ...f, responsibilities: [...(f.responsibilities || []), resp.trim()] }); setResp(''); } }} />
              <Button type="button" variant="outline" onClick={() => { if (resp.trim()) { setF({ ...f, responsibilities: [...(f.responsibilities || []), resp.trim()] }); setResp(''); } }}><Plus /> Add</Button>
            </div>
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} loading={cs.isLoading || us.isLoading}>{committee ? 'Save changes' : 'Create committee'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
