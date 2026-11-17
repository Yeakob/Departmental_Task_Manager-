import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/misc';
import UserPicker from '@/components/common/UserPicker';
import { RichTextEditor } from '@/components/common/RichText';
import { closeTaskForm } from '@/store/uiSlice';
import { useCategoriesQuery, useCommitteesQuery, useProjectsQuery, useCreateTaskMutation, useUpdateTaskMutation } from '@/services/endpoints';
import { usePermissions } from '@/hooks';
import { PRIORITIES, PRIORITY_META, apiError, oid, toLocalInput } from '@/lib/utils';

const schema = z
  .object({
    title: z.string().trim().min(3, 'Give the task a title of at least 3 characters').max(200),
    description: z.string().optional(),
    category: z.string().optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    assignees: z.array(z.string()),
    primary: z.string().nullable().optional(),
    supporters: z.array(z.string()),
    approvers: z.array(z.string()),
    committee: z.string().optional(),
    project: z.string().optional(),
    startDate: z.string().optional(),
    deadline: z.string().optional(),
    estimatedHours: z.coerce.number().min(0).max(10000).optional(),
    requiresApproval: z.boolean(),
    tags: z.string().optional(),
    isTemplate: z.boolean().optional(),
    templateName: z.string().optional(),
  })
  .refine((v) => !v.startDate || !v.deadline || new Date(v.deadline) >= new Date(v.startDate), { path: ['deadline'], message: 'The deadline must be after the start date' });

const empty = { title: '', description: '', category: '', priority: 'medium', assignees: [], primary: null, supporters: [], approvers: [], committee: '', project: '', startDate: '', deadline: '', estimatedHours: 0, requiresApproval: true, tags: '', isTemplate: false, templateName: '' };

function fromTask(t) {
  return {
    ...empty,
    title: t.title,
    description: t.description || '',
    category: oid(t.category) || '',
    priority: t.priority,
    assignees: (t.assignees || []).map((a) => String(oid(a.user))),
    primary: String(oid((t.assignees || []).find((a) => a.isPrimary)?.user) || ''),
    supporters: (t.supporters || []).map((u) => String(oid(u))),
    approvers: (t.approvers || []).map((u) => String(oid(u))),
    committee: oid(t.committee) || '',
    project: oid(t.project) || '',
    startDate: toLocalInput(t.startDate),
    deadline: toLocalInput(t.deadline),
    estimatedHours: t.estimatedHours || 0,
    requiresApproval: t.requiresApproval ?? true,
    tags: (t.tags || []).join(', '),
  };
}

/**
 * Global create / edit dialog. Opened via `openTaskForm(defaults)`;
 * pass `{ task }` to edit, or `{ project, committee, parentTask, deadline }` to prefill.
 */
export default function TaskFormDialog() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const open = useSelector((s) => s.ui.taskFormOpen);
  const defaults = useSelector((s) => s.ui.taskFormDefaults);
  const editing = defaults?.task;
  const { can, user } = usePermissions();
  const canAssign = can('task:assign');
  const { data: categories = [] } = useCategoriesQuery(undefined, { skip: !open });
  const { data: committees } = useCommitteesQuery({ limit: 100 }, { skip: !open });
  const { data: projects } = useProjectsQuery({ limit: 100 }, { skip: !open });
  const [createTask, cState] = useCreateTaskMutation();
  const [updateTask, uState] = useUpdateTaskMutation();
  const [checklist, setChecklist] = useState([]);
  const [item, setItem] = useState('');
  const [more, setMore] = useState(false);

  const { register, control, handleSubmit, reset, watch, formState: { errors } } = useForm({ resolver: zodResolver(schema), defaultValues: empty });

  useEffect(() => {
    if (!open) return;
    setChecklist([]);
    setItem('');
    if (editing) {
      reset(fromTask(editing));
      setMore(true);
    } else {
      reset({ ...empty, project: defaults?.project || '', committee: defaults?.committee || '', deadline: defaults?.deadline ? toLocalInput(defaults.deadline) : '', isTemplate: !!defaults?.isTemplate });
      setMore(Boolean(defaults?.project || defaults?.committee || defaults?.isTemplate));
    }
  }, [open, editing, defaults, reset]);

  const close = () => dispatch(closeTaskForm());
  const isTemplate = watch('isTemplate');

  const submit = (asDraft) =>
    handleSubmit(async (v) => {
      const tags = (v.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
      const base = {
        title: v.title,
        description: v.description || '',
        category: v.category || null,
        priority: v.priority,
        supporters: canAssign ? v.supporters : undefined,
        approvers: v.approvers,
        committee: v.committee || null,
        project: v.project || null,
        startDate: v.startDate ? new Date(v.startDate).toISOString() : null,
        deadline: v.deadline ? new Date(v.deadline).toISOString() : null,
        estimatedHours: Number(v.estimatedHours) || 0,
        requiresApproval: v.requiresApproval,
        tags,
      };
      try {
        if (editing) {
          await updateTask({ id: oid(editing), ...base }).unwrap();
          toast.success('Task updated');
          close();
          return;
        }
        const assignees = canAssign ? v.assignees.map((u) => ({ user: u, isPrimary: String(u) === String(v.primary || v.assignees[0]) })) : [];
        const t = await createTask({
          ...base,
          assignees,
          checklist: checklist.length ? checklist : undefined,
          parentTask: defaults?.parentTask || undefined,
          status: asDraft || v.isTemplate ? 'draft' : undefined,
          isTemplate: v.isTemplate || undefined,
          templateName: v.isTemplate ? v.templateName || v.title : undefined,
        }).unwrap();
        toast.success(v.isTemplate ? 'Template saved' : asDraft ? 'Draft saved' : `Task ${t.taskId} created`, {
          action: v.isTemplate ? undefined : { label: 'Open', onClick: () => navigate(`/tasks/${oid(t)}`) },
        });
        close();
      } catch (e) {
        toast.error(apiError(e, 'The task could not be saved'));
      }
    });

  const projectItems = projects?.items || [];
  const committeeItems = committees?.items || [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.taskId}` : defaults?.parentTask ? 'New subtask' : isTemplate ? 'New task template' : 'New task'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Assignees are changed from the task page with Reassign.' : canAssign ? 'Assigned people are notified as soon as you create the task.' : 'You can create personal tasks for yourself.'}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={submit(false)}>
          <Field label="Title" htmlFor="t-title" error={errors.title?.message} required>
            <Input id="t-title" autoFocus aria-invalid={!!errors.title} placeholder="e.g. Moderate final exam question papers" {...register('title')} />
          </Field>

          <Field label="Description">
            <Controller control={control} name="description" render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} placeholder="What needs to be done, expected deliverables, references…" />} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Priority" htmlFor="t-priority">
              <Select id="t-priority" {...register('priority')}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </Select>
            </Field>
            <Field label="Category" htmlFor="t-category">
              <Select id="t-category" {...register('category')}>
                <option value="">Uncategorized</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Deadline" htmlFor="t-deadline" error={errors.deadline?.message}>
              <Input id="t-deadline" type="datetime-local" {...register('deadline')} />
            </Field>
          </div>

          {!editing && canAssign && !isTemplate && (
            <Field label="Assign to" help="The starred person is the primary responsible person.">
              <Controller
                control={control}
                name="assignees"
                render={({ field }) => (
                  <Controller control={control} name="primary" render={({ field: pf }) => <UserPicker value={field.value} onChange={field.onChange} primary={pf.value} onPrimaryChange={pf.onChange} placeholder="Leave empty to save as a draft" />} />
                )}
              />
            </Field>
          )}

          {!more ? (
            <button type="button" className="justify-self-start text-sm font-medium text-primary hover:underline" onClick={() => setMore(true)}>
              Add supporters, project, committee, effort and checklist
            </button>
          ) : (
            <>
              {canAssign && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Supporting members">
                    <Controller control={control} name="supporters" render={({ field }) => <UserPicker value={field.value} onChange={field.onChange} placeholder="Optional collaborators" />} />
                  </Field>
                  <Field label="Approvers" help="Defaults to the person who assigned the task.">
                    <Controller control={control} name="approvers" render={({ field }) => <UserPicker value={field.value} onChange={field.onChange} placeholder="Default reviewer" />} />
                  </Field>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Project" htmlFor="t-project">
                  <Select id="t-project" {...register('project')}>
                    <option value="">None</option>
                    {projectItems.map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
                  </Select>
                </Field>
                <Field label="Responsible committee" htmlFor="t-committee">
                  <Select id="t-committee" {...register('committee')}>
                    <option value="">None</option>
                    {committeeItems.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Start date" htmlFor="t-start">
                  <Input id="t-start" type="datetime-local" {...register('startDate')} />
                </Field>
                <Field label="Estimated hours" htmlFor="t-est" help="Used for workload and effort-weighted reports.">
                  <Input id="t-est" type="number" min="0" step="0.5" {...register('estimatedHours')} />
                </Field>
                <Field label="Tags" htmlFor="t-tags" help="Comma separated">
                  <Input id="t-tags" placeholder="iqac, fall-2026" {...register('tags')} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Controller control={control} name="requiresApproval" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />} />
                Requires approval before it counts as completed
              </label>
              {!editing && (
                <Field label="Checklist">
                  <div className="space-y-1.5">
                    {checklist.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                        <span className="flex-1">{c}</span>
                        <button type="button" onClick={() => setChecklist(checklist.filter((_, k) => k !== i))} aria-label={`Remove ${c}`} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Add a step" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (item.trim()) { setChecklist([...checklist, item.trim()]); setItem(''); } } }} />
                      <Button type="button" variant="outline" onClick={() => { if (item.trim()) { setChecklist([...checklist, item.trim()]); setItem(''); } }}><Plus /> Add</Button>
                    </div>
                  </div>
                </Field>
              )}
              {!editing && can('task:bulk') && (
                <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-[auto_1fr] sm:items-center">
                  <label className="flex items-center gap-2 text-sm">
                    <Controller control={control} name="isTemplate" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />} />
                    Save as a reusable template
                  </label>
                  {isTemplate && <Input placeholder="Template name, e.g. Course file submission" {...register('templateName')} />}
                </div>
              )}
            </>
          )}

          <DialogFooter className="pt-1">
            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
            {!editing && canAssign && !isTemplate && (
              <Button type="button" variant="outline" onClick={submit(true)} disabled={cState.isLoading}>Save as draft</Button>
            )}
            <Button type="submit" loading={cState.isLoading || uState.isLoading}>
              {editing ? 'Save changes' : isTemplate ? 'Save template' : canAssign ? 'Create and assign' : 'Create task'}
            </Button>
          </DialogFooter>
          {!canAssign && !editing && <p className="text-xs text-muted-foreground">This task will be assigned to you ({user?.name}).</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
