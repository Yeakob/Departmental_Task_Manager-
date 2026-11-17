import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Checkbox, Progress } from '@/components/ui/misc';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAddChecklistItemMutation, useUpdateChecklistItemMutation, useDeleteChecklistItemMutation } from '@/services/endpoints';
import { useAction } from '@/hooks';
import { cn } from '@/lib/utils';

export default function TaskChecklist({ taskId, checklist, editable }) {
  const items = [...(checklist?.items || [])].sort((a, b) => a.order - b.order);
  const done = items.filter((i) => i.done).length;
  const [text, setText] = useState('');
  const [add, st] = useAddChecklistItemMutation();
  const [update] = useUpdateChecklistItemMutation();
  const [remove] = useDeleteChecklistItemMutation();
  const run = useAction();
  const submit = async () => {
    if (!text.trim()) return;
    if (await run(add({ id: taskId, text: text.trim() }))) setText('');
  };
  if (!items.length && !editable) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <h3 className="text-sm font-semibold">Checklist</h3>
        {items.length > 0 && (
          <>
            <span className="tabular text-xs text-muted-foreground">{done} of {items.length}</span>
            <Progress value={(done / items.length) * 100} className="max-w-40" />
          </>
        )}
      </div>
      <ul className="space-y-0.5">
        {items.map((i) => (
          <li key={i._id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/60">
            <Checkbox checked={i.done} disabled={!editable} onCheckedChange={(v) => update({ id: taskId, itemId: i._id, done: !!v })} aria-label={i.text} />
            <span className={cn('flex-1 text-sm', i.done && 'text-muted-foreground line-through')}>{i.text}</span>
            {editable && (
              <button onClick={() => remove({ id: taskId, itemId: i._id })} className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 focus:opacity-100" aria-label={`Remove ${i.text}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <div className="mt-2 flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Add a checklist item" className="h-8" />
          <Button size="sm" variant="outline" onClick={submit} loading={st.isLoading}><Plus /> Add</Button>
        </div>
      )}
      {items.length > 0 && <p className="mt-1.5 text-xs text-muted-foreground">Ticking items updates the task’s progress automatically.</p>}
    </div>
  );
}
