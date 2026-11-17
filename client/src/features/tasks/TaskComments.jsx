import { useMemo, useRef, useState } from 'react';
import { CornerDownRight, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/misc';
import { EmptyState, RowsSkeleton } from '@/components/common/States';
import { useCommentsQuery, useAddCommentMutation, useUpdateCommentMutation, useDeleteCommentMutation, useDirectoryQuery } from '@/services/endpoints';
import { useAction, usePermissions } from '@/hooks';
import { oid, timeAgo, cn } from '@/lib/utils';

const MENTION = /@\[([^\]]+)\]\(([a-f0-9]{24})\)/g;
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const renderBody = (body) => esc(body).replace(/@\[([^\]]+)\]\(([a-f0-9]{24})\)/g, '<span class="rounded bg-primary-soft px-1 font-medium text-primary">@$1</span>').replace(/\n/g, '<br/>');

/** Textarea with @mention autocomplete; mentions are stored as @[Name](id). */
function MentionInput({ value, onChange, onSubmit, placeholder, autoFocus }) {
  const { data: users = [] } = useDirectoryQuery();
  const ref = useRef(null);
  const [query, setQuery] = useState(null);
  const [active, setActive] = useState(0);
  const matches = useMemo(() => (query == null ? [] : users.filter((u) => u.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6)), [query, users]);

  const detect = (text, caret) => {
    const m = /(^|\s)@([^\s@\]]{0,30})$/.exec(text.slice(0, caret));
    setQuery(m ? m[2] : null);
    setActive(0);
  };
  const pick = (u) => {
    const el = ref.current;
    const caret = el.selectionStart;
    const before = value.slice(0, caret).replace(/@([^\s@\]]{0,30})$/, `@[${u.name}](${oid(u)}) `);
    const next = before + value.slice(caret);
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(before.length, before.length); });
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        rows={3}
        onChange={(e) => { onChange(e.target.value); detect(e.target.value, e.target.selectionStart); }}
        onKeyDown={(e) => {
          if (matches.length) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % matches.length); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); return; }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(matches[active]); return; }
            if (e.key === 'Escape') { setQuery(null); return; }
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSubmit?.(); }
        }}
      />
      {matches.length > 0 && (
        <ul className="absolute bottom-full left-0 z-20 mb-1 w-64 rounded-md border bg-popover p-1 shadow-lg" role="listbox">
          {matches.map((u, i) => (
            <li key={oid(u)}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(u); }} className={cn('flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm', i === active && 'bg-accent')}>
                <UserAvatar user={u} size={20} /> {u.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Composer({ taskId, parent, onDone, autoFocus }) {
  const [body, setBody] = useState('');
  const [add, st] = useAddCommentMutation();
  const run = useAction();
  const send = async () => {
    if (!body.trim()) return;
    const mentions = [...body.matchAll(MENTION)].map((m) => m[2]);
    if (await run(add({ id: taskId, body: body.trim(), parent: parent || undefined, mentions }))) {
      setBody('');
      onDone?.();
    }
  };
  return (
    <div className="space-y-2">
      <MentionInput value={body} onChange={setBody} onSubmit={send} autoFocus={autoFocus} placeholder={parent ? 'Write a reply…' : 'Add a comment. Type @ to mention someone.'} />
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto text-xs text-muted-foreground">Ctrl + Enter to send</span>
        {onDone && <Button variant="ghost" size="sm" onClick={onDone}>Cancel</Button>}
        <Button size="sm" onClick={send} loading={st.isLoading} disabled={!body.trim()}>{parent ? 'Reply' : 'Comment'}</Button>
      </div>
    </div>
  );
}

function Comment({ c, taskId, replies = [], depth = 0 }) {
  const { user, can } = usePermissions();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.body);
  const [update] = useUpdateCommentMutation();
  const [remove] = useDeleteCommentMutation();
  const run = useAction();
  const mine = String(oid(c.author)) === String(user?.id);
  return (
    <div className={cn('flex gap-3', depth && 'mt-3')}>
      <UserAvatar user={c.author} size={depth ? 24 : 30} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium">{c.author?.name}</span>
          <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}{c.editedAt && ' (edited)'}</span>
        </div>
        {editing ? (
          <div className="mt-1 space-y-2">
            <MentionInput value={text} onChange={setText} autoFocus />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={async () => { if (await run(update({ id: taskId, commentId: c._id, body: text }))) setEditing(false); }}>Save</Button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 max-w-[72ch] break-words text-base" dangerouslySetInnerHTML={{ __html: renderBody(c.body) }} />
        )}
        <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
          {depth === 0 && <button className="hover:text-foreground" onClick={() => setReplying((r) => !r)}>Reply</button>}
          {mine && !editing && <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /> Edit</button>}
          {(mine || can('task:update_any')) && <button className="inline-flex items-center gap-1 hover:text-destructive" onClick={() => run(remove({ id: taskId, commentId: c._id }), { success: 'Comment deleted' })}><Trash2 className="h-3 w-3" /> Delete</button>}
        </div>
        {replies.map((r) => <Comment key={r._id} c={r} taskId={taskId} depth={1} />)}
        {replying && (
          <div className="mt-3 flex gap-2">
            <CornerDownRight className="mt-2 h-4 w-4 text-muted-foreground" />
            <div className="flex-1"><Composer taskId={taskId} parent={c._id} autoFocus onDone={() => setReplying(false)} /></div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TaskComments({ taskId }) {
  const { data = [], isLoading } = useCommentsQuery(taskId);
  const roots = data.filter((c) => !c.parent);
  const repliesOf = (id) => data.filter((c) => String(c.parent) === String(id));
  return (
    <div className="space-y-5">
      <Composer taskId={taskId} />
      {isLoading ? <RowsSkeleton rows={3} /> : roots.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No discussion yet" description="Ask questions or share updates here; everyone on the task is notified." className="py-6" />
      ) : (
        <div className="space-y-5">{roots.map((c) => <Comment key={c._id} c={c} taskId={taskId} replies={repliesOf(c._id)} />)}</div>
      )}
    </div>
  );
}
