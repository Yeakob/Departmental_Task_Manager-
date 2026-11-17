import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import UserPicker from '@/components/common/UserPicker';
import { RichTextEditor } from '@/components/common/RichText';
import { useCreateProjectMutation, useUpdateProjectMutation } from '@/services/endpoints';
import { useAction } from '@/hooks';
import { oid, toDateInput } from '@/lib/utils';

const schema = z
  .object({
    title: z.string().trim().min(3, 'Use at least 3 characters').max(200),
    code: z.string().trim().max(30).optional(),
    description: z.string().optional(),
    manager: z.string({ required_error: 'Choose a project manager' }).min(1, 'Choose a project manager'),
    members: z.array(z.string()),
    status: z.enum(['planning', 'active', 'on_hold', 'completed', 'archived']),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    budget: z.coerce.number().min(0).optional(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, { path: ['endDate'], message: 'The end date must be after the start date' });

export const PROJECT_STATUS = { planning: 'Planning', active: 'Active', on_hold: 'On hold', completed: 'Completed', archived: 'Archived' };

export default function ProjectFormDialog({ open, onOpenChange, project, onSaved }) {
  const run = useAction();
  const [create, cs] = useCreateProjectMutation();
  const [update, us] = useUpdateProjectMutation();
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset(project ? {
      title: project.title, code: project.code || '', description: project.description || '', manager: String(oid(project.manager) || ''),
      members: (project.members || []).map((m) => String(oid(m))), status: project.status, startDate: toDateInput(project.startDate), endDate: toDateInput(project.endDate), budget: project.budget?.amount || 0,
    } : { title: '', code: '', description: '', manager: '', members: [], status: 'planning', startDate: '', endDate: '', budget: 0 });
  }, [open, project, reset]);

  const onSubmit = handleSubmit(async (v) => {
    const body = { ...v, startDate: v.startDate || null, endDate: v.endDate || null, budget: v.budget ? { amount: Number(v.budget), currency: 'BDT' } : undefined };
    const res = await run(project ? update({ id: oid(project), ...body }) : create(body), { success: project ? 'Project updated' : 'Project created; the team has been notified' });
    if (res) { onOpenChange(false); onSaved?.(res); }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{project ? 'Edit project' : 'New project'}</DialogTitle>
          <DialogDescription>Projects group related tasks, milestones and documents, such as accreditation preparation or a contest.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <Field label="Title" error={errors.title?.message} required><Input autoFocus {...register('title')} aria-invalid={!!errors.title} /></Field>
            <Field label="Short code"><Input placeholder="ACC" {...register('code')} /></Field>
          </div>
          <Field label="Description"><Controller control={control} name="description" render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} minimal placeholder="Goals, scope and deliverables" />} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project manager" error={errors.manager?.message} required>
              <Controller control={control} name="manager" render={({ field }) => <UserPicker multiple={false} value={field.value} onChange={(v) => field.onChange(v || '')} invalid={!!errors.manager} />} />
            </Field>
            <Field label="Status"><Select {...register('status')}>{Object.entries(PROJECT_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          </div>
          <Field label="Team members"><Controller control={control} name="members" render={({ field }) => <UserPicker value={field.value} onChange={field.onChange} />} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Start date"><Input type="date" {...register('startDate')} /></Field>
            <Field label="End date" error={errors.endDate?.message}><Input type="date" {...register('endDate')} /></Field>
            <Field label="Budget (BDT, optional)"><Input type="number" min="0" step="1000" {...register('budget')} /></Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={cs.isLoading || us.isLoading}>{project ? 'Save changes' : 'Create project'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
