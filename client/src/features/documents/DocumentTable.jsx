import { useState } from 'react';
import { FileText, Download, Trash2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm';
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/States';
import Pagination from '@/components/common/Pagination';
import { DocumentDetailDialog } from './DocumentDialogs';
import { useDeleteDocumentMutation } from '@/services/endpoints';
import { useAction, useDownload, usePermissions } from '@/hooks';
import { fileSize, fmtDate, oid } from '@/lib/utils';

export default function DocumentTable({ query, onPage, emptyAction, openId, setOpenId }) {
  const [localOpen, setLocalOpen] = useState(null);
  const open = openId !== undefined ? openId : localOpen;
  const setOpen = setOpenId || setLocalOpen;
  const download = useDownload();
  const run = useAction();
  const { user, can } = usePermissions();
  const [del] = useDeleteDocumentMutation();
  const [confirm, setConfirm] = useState(null);
  const items = query.data?.items || [];

  if (query.isLoading) return <RowsSkeleton />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  return (
    <>
      {!items.length ? (
        <EmptyState icon={FileText} title="No documents here" description="Upload minutes, notices, course files or evidence so everyone works from the same copy." action={emptyAction} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <tr><th className="px-4 py-2.5 font-medium">Document</th><th className="px-3 py-2.5 font-medium">Category</th><th className="px-3 py-2.5 font-medium">Linked to</th><th className="px-3 py-2.5 font-medium">Uploaded</th><th className="px-3 py-2.5 font-medium">Size</th><th className="w-20" /></tr>
            </thead>
            <tbody className="divide-y">
              {items.map((d) => (
                <tr key={d._id} className="hover:bg-accent/50">
                  <td className="max-w-[340px] px-4 py-2.5">
                    <button className="flex items-center gap-2 text-left font-medium hover:text-primary hover:underline" onClick={() => setOpen(d._id)}>
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{d.title}</span>
                      {d.visibility === 'restricted' && <Lock className="h-3.5 w-3.5 shrink-0 text-highlight" aria-label="Restricted" />}
                      {d.currentVersion > 1 && <Badge variant="outline">v{d.currentVersion}</Badge>}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{d.category}</td>
                  <td className="max-w-[200px] truncate px-3 py-2.5 text-muted-foreground">{d.task?.taskId || d.project?.title || d.committee?.name || d.meeting?.title || '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(d.createdAt)}, {d.uploadedBy?.name}</td>
                  <td className="tabular px-3 py-2.5 text-muted-foreground">{fileSize(d.latest?.size)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Button variant="ghost" size="icon-sm" aria-label="Download" onClick={() => download(`/api/v1/documents/${d._id}/download`, d.latest?.fileName || d.title)}><Download /></Button>
                    {(String(oid(d.uploadedBy)) === String(user?.id) || can('document:delete')) && <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setConfirm(d)}><Trash2 /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {onPage && <Pagination meta={query.data?.meta} onPage={onPage} />}
      <DocumentDetailDialog id={open} onOpenChange={(v) => !v && setOpen(null)} />
      <ConfirmDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)} title={`Delete “${confirm?.title}”?`} description="It is removed from the repository for everyone. An administrator can purge it permanently later." confirmLabel="Delete" onConfirm={async () => { await run(del(confirm._id), { success: 'Document deleted' }); setConfirm(null); }} />
    </>
  );
}
