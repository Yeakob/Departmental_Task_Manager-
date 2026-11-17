import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, KeyRound, ShieldCheck } from 'lucide-react';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox, UserAvatar, Switch } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState, RowsSkeleton } from '@/components/common/States';
import Pagination from '@/components/common/Pagination';
import UserPicker from '@/components/common/UserPicker';
import {
  useUsersQuery, useCreateUserMutation, useUpdateUserMutation, useResetUserPasswordMutation, useDeleteUserMutation, useRolesQuery, usePermissionsQuery,
  useCreateRoleMutation, useUpdateRoleMutation, useDeleteRoleMutation, useDepartmentsQuery, useCreateDepartmentMutation, useUpdateDepartmentMutation,
  useDeleteDepartmentMutation, useCategoriesQuery, useCreateCategoryMutation, useUpdateCategoryMutation, useDeleteCategoryMutation, useSessionsQuery,
  useCreateSessionMutation, useUpdateSessionMutation, useDeleteSessionMutation,
} from '@/services/endpoints';
import { useAction, useDebounce, usePermissions } from '@/hooks';
import { fmtDate, timeAgo, toDateInput, oid, cn } from '@/lib/utils';

// ---------------- Users ----------------
function UserDialog({ open, onOpenChange, user }) {
  const run = useAction();
  const { isSuperAdmin } = usePermissions();
  const { data: roles = [] } = useRolesQuery(undefined, { skip: !open });
  const { data: departments = [] } = useDepartmentsQuery(undefined, { skip: !open || !isSuperAdmin });
  const [create, cs] = useCreateUserMutation();
  const [update, us] = useUpdateUserMutation();
  const [f, setF] = useState({});
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!open) return;
    setErr('');
    setF(user ? { name: user.name, email: user.email, designation: user.designation || '', employeeId: user.employeeId || '', phone: user.phone || '', roles: user.roles.map((r) => r.key), department: oid(user.department) || '', weeklyCapacityHours: user.weeklyCapacityHours ?? 40, isActive: user.isActive }
      : { name: '', email: '', designation: '', employeeId: '', phone: '', roles: ['faculty'], department: '', weeklyCapacityHours: 40, password: '' });
  }, [open, user]);
  const save = async () => {
    if (f.name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Enter a name and a valid email.');
    if (!f.roles.length) return setErr('Give the user at least one role.');
    const body = { ...f, weeklyCapacityHours: Number(f.weeklyCapacityHours) || 0, department: isSuperAdmin ? f.department || null : undefined, password: f.password || undefined };
    if (await run(user ? update({ id: user._id, ...body, email: undefined }) : create(body), { success: user ? 'User updated' : f.password ? 'Account created' : 'Account created; a temporary password was emailed' })) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{user ? `Edit ${user.name}` : 'Add a user'}</DialogTitle>
          <DialogDescription>{user ? 'Role changes apply the next time they load a page.' : 'Leave the password empty to email a temporary one; they will be asked to change it.'}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required><Input value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Email" required><Input type="email" disabled={!!user} value={f.email || ''} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Designation"><Input value={f.designation || ''} onChange={(e) => setF({ ...f, designation: e.target.value })} placeholder="Lecturer" /></Field>
          <Field label="Employee ID"><Input value={f.employeeId || ''} onChange={(e) => setF({ ...f, employeeId: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.phone || ''} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Weekly capacity (hours)" help="Used for workload balancing"><Input type="number" min="0" max="168" value={f.weeklyCapacityHours ?? 40} onChange={(e) => setF({ ...f, weeklyCapacityHours: e.target.value })} /></Field>
          {isSuperAdmin && <Field label="Department"><Select value={f.department || ''} onChange={(e) => setF({ ...f, department: e.target.value })}><option value="">None (system-wide)</option>{departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</Select></Field>}
          {!user && <Field label="Initial password" help="Optional"><Input type="password" autoComplete="new-password" value={f.password || ''} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>}
          <Field label="Roles" className="sm:col-span-2" help="A person can hold several roles; their permissions combine.">
            <div className="flex flex-wrap gap-1.5">
              {roles.filter((r) => isSuperAdmin || r.key !== 'super_admin').map((r) => {
                const on = (f.roles || []).includes(r.key);
                return <button type="button" key={r.key} onClick={() => setF({ ...f, roles: on ? f.roles.filter((x) => x !== r.key) : [...f.roles, r.key] })} className={cn('rounded-full border px-2.5 py-1 text-xs', on ? 'border-primary bg-primary-soft text-primary' : 'hover:bg-accent')}>{r.name}</button>;
              })}
            </div>
          </Field>
          {user && <label className="flex items-center gap-2 text-sm sm:col-span-2"><Switch checked={!!f.isActive} onCheckedChange={(v) => setF({ ...f, isActive: v })} /> Account active (inactive users can’t sign in)</label>}
          {err && <p className="text-sm text-destructive sm:col-span-2">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} loading={cs.isLoading || us.isLoading}>{user ? 'Save changes' : 'Create account'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Users() {
  const run = useAction();
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [role, setRole] = useState('');
  const [active, setActive] = useState('true');
  const [page, setPage] = useState(1);
  const query = useUsersQuery({ q: dq, role, isActive: active || undefined, page, limit: 20 });
  const { data: roles = [] } = useRolesQuery();
  const [dialog, setDialog] = useState(null);
  const [reset, setReset] = useState(null);
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [resetPw, rs] = useResetUserPasswordMutation();
  const [del] = useDeleteUserMutation();
  return (
    <Panel className="overflow-hidden">
      <PanelHeader title="Users" description="Faculty, staff and coordinators who can sign in." actions={<Button size="sm" onClick={() => setDialog({})}><Plus /> Add user</Button>} />
      <div className="flex flex-wrap gap-2 border-b px-4 py-3">
        <div className="relative w-full sm:w-64"><Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Name, email, designation, ID" className="pl-8" /></div>
        <Select className="w-auto" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Role"><option value="">All roles</option>{roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</Select>
        <Select className="w-auto" value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }} aria-label="Status"><option value="true">Active</option><option value="false">Inactive</option><option value="">All</option></Select>
      </div>
      {query.isLoading ? <RowsSkeleton /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">Person</th><th className="px-3 py-2.5 font-medium">Roles</th><th className="px-3 py-2.5 font-medium">Department</th><th className="px-3 py-2.5 font-medium">Last sign-in</th><th className="w-32" /></tr></thead>
            <tbody className="divide-y">
              {query.data.items.map((u) => (
                <tr key={u._id} className={cn(!u.isActive && 'opacity-60')}>
                  <td className="px-4 py-2.5"><span className="flex items-center gap-2"><UserAvatar user={u} size={28} /><span><span className="block font-medium">{u.name}</span><span className="block text-xs text-muted-foreground">{u.email}{u.designation && `, ${u.designation}`}</span></span></span></td>
                  <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r.key} variant={r.key === 'super_admin' || r.key === 'chairman' ? 'primary' : 'default'}>{r.name}</Badge>)}</div></td>
                  <td className="px-3 py-2.5 text-muted-foreground">{u.department?.code || '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setDialog(u)}><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Reset password" onClick={() => { setReset(u); setPw(''); }}><KeyRound /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setConfirm(u)}><Trash2 /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={query.data?.meta} onPage={setPage} />
      <UserDialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)} user={dialog?._id ? dialog : null} />
      <Dialog open={!!reset} onOpenChange={(v) => !v && setReset(null)}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Reset password for {reset?.name}</DialogTitle><DialogDescription>They’ll be signed out everywhere and asked to choose a new password after signing in. Share the temporary password with them directly.</DialogDescription></DialogHeader>
          <Field label="Temporary password" help="At least 8 characters with upper and lower case letters and a number."><Input value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <DialogFooter><Button variant="ghost" onClick={() => setReset(null)}>Cancel</Button><Button loading={rs.isLoading} disabled={pw.length < 8} onClick={async () => { if (await run(resetPw({ id: reset._id, password: pw }), { success: 'Password reset' })) setReset(null); }}>Reset password</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)} title={`Remove ${confirm?.name}?`} description="Their account is deactivated and hidden. Tasks and records they worked on are kept. Prefer deactivating if they may return." confirmLabel="Remove user" onConfirm={async () => { await run(del(confirm._id), { success: 'User removed' }); setConfirm(null); }} />
    </Panel>
  );
}

// ---------------- Roles ----------------
export function Roles() {
  const run = useAction();
  const { can } = usePermissions();
  const { data: roles = [], isLoading } = useRolesQuery();
  const { data: perms = [] } = usePermissionsQuery(undefined, { skip: !can('role:manage') });
  const [create] = useCreateRoleMutation();
  const [update, us] = useUpdateRoleMutation();
  const [del] = useDeleteRoleMutation();
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState([]);
  const [newRole, setNewRole] = useState(null);
  const groups = useMemo(() => perms.reduce((a, p) => ({ ...a, [p.group]: [...(a[p.group] || []), p] }), {}), [perms]);
  const role = roles.find((r) => r._id === sel) || roles[0];
  useEffect(() => { if (role) setDraft(role.permissions); }, [role?._id, role?.permissions]); // eslint-disable-line react-hooks/exhaustive-deps
  if (isLoading) return <RowsSkeleton />;
  const locked = role?.key === 'super_admin' || !can('role:manage');
  const dirty = role && JSON.stringify([...draft].sort()) !== JSON.stringify([...role.permissions].sort());
  return (
    <Panel className="overflow-hidden">
      <PanelHeader title="Roles and permissions" description="Roles are sets of granular permissions. A user’s permissions are the union of their roles." actions={can('role:manage') && <Button size="sm" onClick={() => setNewRole({ key: '', name: '', description: '' })}><Plus /> New role</Button>} />
      <div className="grid md:grid-cols-[220px_1fr]">
        <ul className="border-b p-2 md:border-b-0 md:border-r">
          {roles.map((r) => (
            <li key={r._id}><button onClick={() => setSel(r._id)} className={cn('flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm', role?._id === r._id ? 'bg-accent font-medium' : 'hover:bg-accent/60')}>{r.key === 'super_admin' && <ShieldCheck className="h-4 w-4 text-primary" />}<span className="flex-1 truncate">{r.name}</span>{!r.isSystem && <Badge variant="outline">Custom</Badge>}</button></li>
          ))}
        </ul>
        {role && (
          <div className="p-4">
            <div className="mb-3 flex flex-wrap items-start gap-2">
              <div className="flex-1"><p className="font-semibold">{role.name}</p><p className="text-sm text-muted-foreground">{role.description}</p></div>
              {!locked && dirty && <Button size="sm" loading={us.isLoading} onClick={() => run(update({ id: role._id, permissions: draft }), { success: 'Permissions saved' })}>Save permissions</Button>}
              {!role.isSystem && can('role:manage') && <Button size="sm" variant="outline" onClick={() => run(del(role._id), { success: 'Role deleted' })}><Trash2 /> Delete</Button>}
            </div>
            {role.key === 'super_admin' ? <p className="text-sm text-muted-foreground">Super admins hold every permission. This role can’t be edited.</p> : !can('role:manage') ? (
              <div className="flex flex-wrap gap-1.5">{role.permissions.map((p) => <Badge key={p} variant="outline">{p}</Badge>)}</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Object.entries(groups).map(([g, list]) => (
                  <fieldset key={g} className="rounded-md border p-3">
                    <legend className="px-1 text-sm font-medium capitalize">{g}</legend>
                    {list.map((p) => (
                      <label key={p.key} className="flex items-center gap-2 py-0.5 text-sm">
                        <Checkbox checked={draft.includes(p.key)} onCheckedChange={(v) => setDraft(v ? [...draft, p.key] : draft.filter((x) => x !== p.key))} />
                        <span className="truncate">{p.key.split(':')[1].replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <Dialog open={!!newRole} onOpenChange={(v) => !v && setNewRole(null)}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>New role</DialogTitle><DialogDescription>Start with no permissions, then tick what this role needs.</DialogDescription></DialogHeader>
          <Field label="Name"><Input value={newRole?.name || ''} onChange={(e) => setNewRole({ ...newRole, name: e.target.value, key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') })} placeholder="Lab In-charge" /></Field>
          <Field label="Key" help="Lowercase letters, numbers and underscores"><Input value={newRole?.key || ''} onChange={(e) => setNewRole({ ...newRole, key: e.target.value })} /></Field>
          <Field label="Description"><Textarea rows={2} value={newRole?.description || ''} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} /></Field>
          <DialogFooter><Button variant="ghost" onClick={() => setNewRole(null)}>Cancel</Button><Button onClick={async () => { const r = await run(create({ ...newRole, permissions: [] }), { success: 'Role created' }); if (r) { setNewRole(null); setSel(r.data?._id || r.data?.id); } }}>Create role</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

// ---------------- Departments ----------------
export function Departments() {
  const run = useAction();
  const { isSuperAdmin } = usePermissions();
  const { data = [], isLoading } = useDepartmentsQuery();
  const [create] = useCreateDepartmentMutation();
  const [update] = useUpdateDepartmentMutation();
  const [del] = useDeleteDepartmentMutation();
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null);
  if (isLoading) return <RowsSkeleton />;
  const save = async () => {
    const body = { name: edit.name, code: edit.code, faculty: edit.faculty || undefined, chairman: edit.chairman || null, settings: { taskIdPrefix: edit.taskIdPrefix || null, reminderOffsetsMinutes: edit.reminders.split(',').map((s) => Math.round(parseFloat(s) * 60)).filter((n) => n > 0) } };
    if (await run(edit._id ? update({ id: edit._id, ...body }) : create(body), { success: 'Department saved' })) setEdit(null);
  };
  return (
    <Panel className="overflow-hidden">
      <PanelHeader title={isSuperAdmin ? 'Departments' : 'Department settings'} description="Each department’s data is isolated from the others." actions={isSuperAdmin && <Button size="sm" onClick={() => setEdit({ name: '', code: '', faculty: '', chairman: null, taskIdPrefix: '', reminders: '168, 72, 24, 1' })}><Plus /> New department</Button>} />
      <ul className="divide-y">
        {data.map((d) => (
          <li key={d._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="task-code w-12">{d.code}</span>
            <div className="min-w-0 flex-1"><p className="font-medium">{d.name}</p><p className="text-xs text-muted-foreground">{d.faculty || 'No faculty set'}{d.chairman ? `, chairman ${d.chairman.name}` : ''}. Reminders {((d.settings?.reminderOffsetsMinutes) || []).map((m) => (m >= 1440 ? `${m / 1440}d` : `${m / 60}h`)).join(', ')} before deadlines.</p></div>
            <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEdit({ ...d, chairman: oid(d.chairman) || null, taskIdPrefix: d.settings?.taskIdPrefix || '', reminders: (d.settings?.reminderOffsetsMinutes || []).map((m) => m / 60).join(', ') })}><Pencil /></Button>
            {isSuperAdmin && <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setConfirm(d)}><Trash2 /></Button>}
          </li>
        ))}
      </ul>
      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?._id ? `Edit ${edit.code}` : 'New department'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" className="sm:col-span-2"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Code"><Input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} placeholder="CSE" disabled={!isSuperAdmin} /></Field>
              <Field label="Task ID prefix" help="Defaults to the code"><Input value={edit.taskIdPrefix} onChange={(e) => setEdit({ ...edit, taskIdPrefix: e.target.value.toUpperCase() })} /></Field>
              <Field label="Faculty" className="sm:col-span-2"><Input value={edit.faculty || ''} onChange={(e) => setEdit({ ...edit, faculty: e.target.value })} /></Field>
              {edit._id && <Field label="Chairman" className="sm:col-span-2"><UserPicker multiple={false} value={edit.chairman} onChange={(v) => setEdit({ ...edit, chairman: v })} /></Field>}
              <Field label="Reminder schedule (hours before deadline)" className="sm:col-span-2" help="Comma separated. 168, 72, 24, 1 means 7 days, 3 days, 1 day and 1 hour."><Input value={edit.reminders} onChange={(e) => setEdit({ ...edit, reminders: e.target.value })} /></Field>
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)} title={`Delete ${confirm?.name}?`} description="Only empty departments can be deleted." confirmLabel="Delete" onConfirm={async () => { await run(del(confirm._id), { success: 'Department deleted' }); setConfirm(null); }} />
    </Panel>
  );
}

// ---------------- Categories ----------------
export function Categories() {
  const run = useAction();
  const { data = [], isLoading } = useCategoriesQuery();
  const [create] = useCreateCategoryMutation();
  const [update] = useUpdateCategoryMutation();
  const [del] = useDeleteCategoryMutation();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#1A7A55');
  if (isLoading) return <RowsSkeleton />;
  return (
    <Panel className="overflow-hidden">
      <PanelHeader title="Task categories" description="The 15 standard categories apply to every department. Add your own for anything else." />
      <div className="flex flex-wrap gap-2 border-b px-4 py-3">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-10 cursor-pointer rounded-md border bg-surface" aria-label="Colour" />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" className="w-64" />
        <Button variant="outline" disabled={name.trim().length < 2} onClick={async () => { if (await run(create({ name: name.trim(), color }), { success: 'Category added' })) setName(''); }}><Plus /> Add</Button>
      </div>
      <ul className="grid divide-y sm:grid-cols-2 sm:divide-y-0">
        {data.map((c) => (
          <li key={c._id} className="flex items-center gap-3 border-b px-4 py-2.5 text-sm">
            <input type="color" value={c.color} disabled={!c.department} onChange={(e) => run(update({ id: c._id, color: e.target.value }))} className="h-6 w-7 cursor-pointer rounded border bg-surface disabled:cursor-default" aria-label={`Colour for ${c.name}`} />
            <span className="flex-1">{c.name}</span>
            {c.department ? <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.name}`} onClick={() => run(del(c._id), { success: 'Category removed' })}><Trash2 /></Button> : <Badge variant="outline">Standard</Badge>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ---------------- Academic sessions ----------------
export function Sessions() {
  const run = useAction();
  const { data = [], isLoading } = useSessionsQuery();
  const [create] = useCreateSessionMutation();
  const [update] = useUpdateSessionMutation();
  const [del] = useDeleteSessionMutation();
  const [edit, setEdit] = useState(null);
  if (isLoading) return <RowsSkeleton />;
  const save = async () => {
    const body = { name: edit.name, semester: edit.semester, year: Number(edit.year), startDate: edit.startDate, endDate: edit.endDate, isCurrent: edit.isCurrent };
    if (await run(edit._id ? update({ id: edit._id, ...body }) : create(body), { success: 'Session saved' })) setEdit(null);
  };
  return (
    <Panel className="overflow-hidden">
      <PanelHeader title="Academic sessions" description="Semesters appear on the calendar and help schedule semester-wise recurring work." actions={<Button size="sm" onClick={() => setEdit({ name: '', semester: 'spring', year: new Date().getFullYear(), startDate: '', endDate: '', isCurrent: false })}><Plus /> New session</Button>} />
      {data.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">No sessions configured.</p> : (
        <ul className="divide-y">
          {data.map((s) => (
            <li key={s._id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="flex-1 font-medium">{s.name}</span>
              {s.isCurrent && <Badge variant="primary">Current</Badge>}
              <span className="text-muted-foreground">{fmtDate(s.startDate)} to {fmtDate(s.endDate)}</span>
              <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEdit({ ...s, startDate: toDateInput(s.startDate), endDate: toDateInput(s.endDate) })}><Pencil /></Button>
              <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => run(del(s._id), { success: 'Session deleted' })}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>{edit?._id ? 'Edit session' : 'New academic session'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" className="sm:col-span-2"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Spring 2027" /></Field>
              <Field label="Semester"><Select value={edit.semester} onChange={(e) => setEdit({ ...edit, semester: e.target.value })}><option value="spring">Spring</option><option value="summer">Summer</option><option value="fall">Fall</option><option value="other">Other</option></Select></Field>
              <Field label="Year"><Input type="number" value={edit.year} onChange={(e) => setEdit({ ...edit, year: e.target.value })} /></Field>
              <Field label="Starts"><Input type="date" value={edit.startDate} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} /></Field>
              <Field label="Ends"><Input type="date" value={edit.endDate} onChange={(e) => setEdit({ ...edit, endDate: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={!!edit.isCurrent} onCheckedChange={(v) => setEdit({ ...edit, isCurrent: !!v })} /> This is the current session</label>
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={!edit?.name || !edit?.startDate || !edit?.endDate} onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
