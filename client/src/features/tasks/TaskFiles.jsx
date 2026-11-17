import { useState } from 'react';
import { FileText, Download, Trash2, Eye, Paperclip, History, CheckCircle2, XCircle, RotateCcw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar, useFileUrl } from '@/components/ui/misc';
import FileDrop from '@/components/common/FileDrop';
import { EmptyState, RowsSkeleton } from '@/components/common/States';
import { useAttachmentsQuery, useUploadAttachmentsMutation, useDeleteAttachmentMutation, useActivityQuery, useApprovalsQuery } from '@/services/endpoints';
import { useAction, useDownload, usePermissions } from '@/hooks';
import { fileSize, fmtDateTime, oid, timeAgo, humanize } from '@/lib/utils';

function FileRow({ a, taskId, canDelete }) {
  const url = useFileUrl(a.path);
  const download = useDownload();
  const [remove] = useDeleteAttachmentMutation();
  const run = useAction();
  const previewable = /^(image\/|application\/pdf)/.test(a.mimeType);
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{a.originalName}</p>
        <p className="text-xs text-muted-foreground">
          {fileSize(a.size)}, {a.uploadedBy?.name || 'someone'}, {timeAgo(a.createdAt)}
        </p>
      </div>
      {a.kind === 'deliverable' && <Badge variant="primary">Deliverable v{a.version}</Badge>}
      {previewable && <Button variant="ghost" size="icon-sm" asChild aria-label="Preview"><a href={url} target="_blank" rel="noreferrer"><Eye /></a></Button>}
      <Button variant="ghost" size="icon-sm" aria-label="Download" onClick={() => download(a.path, a.originalName)}><Download /></Button>
      {canDelete && <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => run(remove({ id: taskId, attachmentId: a._id }), { success: 'File removed' })}><Trash2 /></Button>}
    </li>
  );
}

export function TaskAttachments({ taskId, canUpload }) {
  const { data = [], isLoading } = useAttachmentsQuery(taskId);
  const [upload, st] = useUploadAttachmentsMutation();
  const run = useAction();
  const { user, can } = usePermissions();
  return (
    <div className="space-y-3">
      {canUpload && <FileDrop onFiles={(files) => run(upload({ id: taskId, files }), { success: `${files.length} file(s) uploaded` })} />}
      {st.isLoading && <p className="text-sm text-muted-foreground">Uploading…</p>}
      {isLoading ? <RowsSkeleton rows={2} /> : data.length === 0 ? (
        <EmptyState icon={Paperclip} title="No files yet" description="Attach references here. When you submit for approval you can mark files as deliverables." className="py-6" />
      ) : (
        <ul className="divide-y rounded-md border">{data.map((a) => <FileRow key={a._id} a={a} taskId={taskId} canDelete={String(oid(a.uploadedBy)) === String(user?.id) || can('task:update_any')} />)}</ul>
      )}
    </div>
  );
}

const ACT_ICON = { approved: CheckCircle2, rejected: XCircle, revision_requested: RotateCcw };

export function TaskActivity({ taskId }) {
  const { data = [], isLoading } = useActivityQuery(taskId);
  if (isLoading) return <RowsSkeleton rows={4} />;
  if (!data.length) return <EmptyState icon={History} title="No activity yet" className="py-6" />;
  return (
    <ol className="relative ml-3 border-l pl-5">
      {data.map((a) => {
        const Icon = ACT_ICON[a.type];
        return (
          <li key={a._id} className="relative pb-4 last:pb-0">
            <span className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-surface ring-2 ring-background">
              {Icon ? <Icon className="h-4 w-4 text-primary" /> : <UserAvatar user={a.actor || { name: 'System' }} size={20} />}
            </span>
            <p className="text-sm"><span className="font-medium">{a.actor?.name || 'System'}</span> {a.message || humanize(a.type)}</p>
            <p className="text-xs text-muted-foreground" title={fmtDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</p>
          </li>
        );
      })}
    </ol>
  );
}

const DECISION = {
  pending: ['Waiting for review', Clock, 'text-highlight'],
  approved: ['Approved', CheckCircle2, 'text-emerald-600'],
  rejected: ['Rejected', XCircle, 'text-destructive'],
  revision_requested: ['Revision requested', RotateCcw, 'text-amber-600'],
};

export function TaskApprovals({ taskId }) {
  const { data = [], isLoading } = useApprovalsQuery(taskId);
  const download = useDownload();
  if (isLoading) return <RowsSkeleton rows={2} />;
  if (!data.length) return <EmptyState icon={CheckCircle2} title="Not submitted yet" description="Each submission for approval and the reviewer’s decision appear here, newest first." className="py-6" />;
  return (
    <ol className="space-y-3">
      {data.map((r) => {
        const [label, Icon, tone] = DECISION[r.decision];
        return (
          <li key={r._id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Submission {r.round}</span>
              <span className={`inline-flex items-center gap-1 text-sm ${tone}`}><Icon className="h-4 w-4" /> {label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(r.createdAt)}</span>
            </div>
            <p className="mt-1.5 text-sm"><span className="text-muted-foreground">Submitted by</span> {r.submittedBy?.name}{r.submissionNote && `: ${r.submissionNote}`}</p>
            {r.deliverables?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.deliverables.map((d) => (
                  <button key={d._id} onClick={() => download(d.path, d.originalName)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"><Paperclip className="h-3 w-3" /> {d.originalName}</button>
                ))}
              </div>
            )}
            {r.reviewer && (
              <p className="mt-2 border-l-2 pl-3 text-sm">
                <span className="text-muted-foreground">{r.reviewer.name}, {timeAgo(r.decidedAt)}:</span> {r.reviewerComment || 'No comment.'}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
