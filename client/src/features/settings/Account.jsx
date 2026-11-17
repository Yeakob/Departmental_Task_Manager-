import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera } from 'lucide-react';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Switch, UserAvatar } from '@/components/ui/misc';
import { useUpdateProfileMutation, useUploadAvatarMutation, useChangePasswordMutation, usePreferencesQuery, useUpdatePreferencesMutation } from '@/services/endpoints';
import { setTheme } from '@/store/uiSlice';
import { loggedOut } from '@/store/authSlice';
import { useAction, usePermissions } from '@/hooks';
import { cn } from '@/lib/utils';

export function Profile() {
  const { user } = usePermissions();
  const run = useAction();
  const [save, st] = useUpdateProfileMutation();
  const [avatar, av] = useUploadAvatarMutation();
  const fileRef = useRef(null);
  const { register, handleSubmit, formState: { errors, isDirty }, reset } = useForm({
    resolver: zodResolver(z.object({ name: z.string().trim().min(2, 'Enter your full name').max(120), designation: z.string().max(100).optional(), phone: z.string().max(30).optional() })),
    defaultValues: { name: user?.name, designation: user?.designation || '', phone: user?.phone || '' },
  });
  return (
    <Panel>
      <PanelHeader title="Profile" description="How you appear to colleagues across DWMT." />
      <PanelBody>
        <form className="grid max-w-xl gap-4" onSubmit={handleSubmit(async (v) => { if (await run(save(v), { success: 'Profile saved' })) reset(v); })}>
          <div className="flex items-center gap-4">
            <UserAvatar user={user} size={64} />
            <div>
              <Button type="button" variant="outline" size="sm" loading={av.isLoading} onClick={() => fileRef.current?.click()}><Camera /> Change photo</Button>
              <p className="mt-1 text-xs text-muted-foreground">PNG, JPG or WebP</p>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) run(avatar(f), { success: 'Photo updated' }); e.target.value = ''; }} />
            </div>
          </div>
          <Field label="Full name" error={errors.name?.message}><Input {...register('name')} aria-invalid={!!errors.name} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Designation"><Input {...register('designation')} placeholder="Assistant Professor" /></Field>
            <Field label="Phone"><Input {...register('phone')} /></Field>
          </div>
          <Field label="Email" help="Ask an administrator to change your sign-in email."><Input value={user?.email} disabled /></Field>
          <p className="text-sm text-muted-foreground">Roles: {user?.roles?.map((r) => r.name).join(', ')}{user?.department ? `. Department: ${user.department.name}` : ''}</p>
          <div><Button type="submit" loading={st.isLoading} disabled={!isDirty}>Save profile</Button></div>
        </form>
      </PanelBody>
    </Panel>
  );
}

const pwSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'At least 8 characters').regex(/[A-Z]/, 'Include an uppercase letter').regex(/[a-z]/, 'Include a lowercase letter').regex(/[0-9]/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords don’t match' });

export function Security() {
  const run = useAction();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = usePermissions();
  const [change, st] = useChangePasswordMutation();
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(pwSchema) });
  return (
    <Panel>
      <PanelHeader title="Password" description="Changing your password signs you out on every device." />
      <PanelBody>
        {user?.mustChangePassword && <p className="mb-4 rounded-md border border-highlight/40 bg-highlight-soft px-3 py-2 text-sm">Your account uses a temporary password. Set your own to continue securely.</p>}
        <form className="grid max-w-sm gap-4" onSubmit={handleSubmit(async ({ currentPassword, newPassword }) => {
          if (await run(change({ currentPassword, newPassword }), { success: 'Password changed. Sign in with your new password.' })) { dispatch(loggedOut()); navigate('/login'); }
        })}>
          <Field label="Current password" error={errors.currentPassword?.message}><Input type="password" autoComplete="current-password" {...register('currentPassword')} /></Field>
          <Field label="New password" error={errors.newPassword?.message} help="At least 8 characters with upper and lower case letters and a number."><Input type="password" autoComplete="new-password" {...register('newPassword')} /></Field>
          <Field label="Confirm new password" error={errors.confirm?.message}><Input type="password" autoComplete="new-password" {...register('confirm')} /></Field>
          <div><Button type="submit" loading={st.isLoading}>Change password</Button></div>
        </form>
      </PanelBody>
    </Panel>
  );
}

const MUTABLE = [
  ['comment', 'Comments on my tasks'], ['status_changed', 'Status changes'], ['deadline_approaching', 'Deadline reminders'], ['task_completed', 'Task completions'],
  ['meeting_invited', 'Meeting invitations and reminders'], ['announcement', 'Announcements'], ['extension_decided', 'Extension decisions'],
];

export function Preferences() {
  const dispatch = useDispatch();
  const theme = useSelector((s) => s.ui.theme);
  const { data: prefs } = usePreferencesQuery();
  const [save] = useUpdatePreferencesMutation();
  const run = useAction();
  const [n, setN] = useState(null);
  useEffect(() => { if (prefs) setN(prefs.notifications); }, [prefs]);
  if (!n) return null;
  const update = (patch) => {
    const next = { ...n, ...patch };
    setN(next);
    run(save({ notifications: next }), { success: 'Preferences saved' });
  };
  const muted = n.mutedTypes || [];
  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader title="Appearance" />
        <PanelBody>
          <div className="inline-flex rounded-md border p-0.5 text-sm" role="radiogroup" aria-label="Theme">
            {[['light', 'Light'], ['dark', 'Dark'], ['system', 'Match system']].map(([k, l]) => (
              <button key={k} role="radio" aria-checked={theme === k} onClick={() => { dispatch(setTheme(k)); save({ theme: k }); }} className={cn('rounded px-3 py-1.5', theme === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{l}</button>
            ))}
          </div>
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader title="Notifications" description="Assignments, mentions, approval requests and overdue alerts are always delivered in the app." />
        <PanelBody className="space-y-4">
          {[
            ['email', 'Email notifications', 'Also send important notifications to your email.'],
            ['dailySummary', 'Daily task summary', 'A short email at 8:00 each morning with what’s overdue and due soon.'],
          ].map(([k, l, d]) => (
            <label key={k} className="flex items-start justify-between gap-4">
              <span><span className="block text-sm font-medium">{l}</span><span className="block text-sm text-muted-foreground">{d}</span></span>
              <Switch checked={!!n[k]} onCheckedChange={(v) => update({ [k]: v })} />
            </label>
          ))}
          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">Notify me about</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {MUTABLE.map(([k, l]) => (
                <label key={k} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  {l}
                  <Switch checked={!muted.includes(k)} onCheckedChange={(v) => update({ mutedTypes: v ? muted.filter((x) => x !== k) : [...muted, k] })} />
                </label>
              ))}
            </div>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}

