import { useEffect, useState } from 'react';
import { FileText, Download, Eye, UploadCloud, History } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import FileDrop from '@/components/common/FileDrop';
import UserPicker from '@/components/common/UserPicker';
import { RowsSkeleton } from '@/components/common/States';
import { useUploadDocumentMutation, useAddDocumentVersionMutation, useDocumentQuery, useRolesQuery } from '@/services/endpoints';
import { useAction, useDownload } from '@/hooks';
import { fileSize, fmtDateTime } from '@/lib/utils';

export const DOC_CATEGORIES = ['Meeting Minutes', 'Official Notices', 'Academic Documents', 'Course Files', 'Examination Documents', 'Accreditation Documents', 'Research Documents', 'Reports', 'Task Deliverables', 'Other'];

/** links: { project?, committee?, meeting?, task? } preselected associations */
export function UploadDocumentDialog({ open, onOpenChange, links = {}, defaultCategory, onUploaded }) {
  const run = useAction();
  const [upload, st] = useUploadDocumentMutation();
  const { data: roles = [] } = useRolesQuery(undefined, { skip: !open });
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({});
  useEffect(() => {
    if (open) { setFile(null); setForm({ title: '', category: defaultCategory || 'Other', description: '', tags: '', visibility: 'department', allowedUsers: [], allowedRoles: [] }); }
  }, [open, defaultCategory]);
  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });

  const submit = async () => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', form.title || file.name);
    fd.append('category', form.category);
    if (form.description) fd.append('description', form.description);
    fd.append('tags', JSON.stringify(form.tags.split(',').map((s) => s.trim()).filter(Boolean)));
    fd.append('visibility', form.visibility);
    if (form.visibility === 'restricted') {
      fd.append('allowedUsers', JSON.stringify(form.allowedUsers));
      fd.append('allowedRoles', JSON.stringify(form.allowedRoles));
    }
    for (const [k, v] of Object.entries(links)) if (v) fd.append(k, v);
    const res = await run(upload(fd), { success: 'Document uploaded' });
    if (res) { onOpenChange(false); onUploaded?.(res); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
          <DialogDescription>Files are stored privately and can only be downloaded by people allowed to see them.</DialogDescription>
        </DialogHeader>
        {!file ? <FileDrop multiple={false} onFiles={([f]) => { setFile(f); setForm((s) => ({ ...s, title: s.title || f.name.replace(/\.[^.]+$/, '') })); }} /> : (
          <div className="flex items-center gap-3 rounded-md border px-3 py-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{fileSize(file.size)}</p></div>
            <Button size="sm" variant="ghost" onClick={() => setFile(null)}>Change</Button>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2"><Input value={form.title || ''} onChange={set('title')} /></Field>
          <Field label="Category"><Select value={form.category} onChange={set('category')}>{DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Tags" help="Comma separated"><Input value={form.tags || ''} onChange={set('tags')} placeholder="fall-2026, cse-3201" /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea value={form.description || ''} onChange={set('description')} rows={2} /></Field>
          <Field label="Who can see it" className="sm:col-span-2">
            <Select value={form.visibility} onChange={set('visibility')}>
              <option value="department">Everyone in the department</option>
              <option value="restricted">Only specific people or roles</option>
            </Select>
          </Field>
          {form.visibility === 'restricted' && (
            <>
              <Field label="People" className="sm:col-span-2"><UserPicker value={form.allowedUsers} onChange={set('allowedUsers')} /></Field>
              <Field label="Roles" className="sm:col-span-2">
                <div className="flex flex-wrap gap-1.5">
                  {roles.filter((r) => r.key !== 'super_admin').map((r) => {
                    const on = form.allowedRoles.includes(r.key);
                    return <button type="button" key={r.key} onClick={() => setForm({ ...form, allowedRoles: on ? form.allowedRoles.filter((x) => x !== r.key) : [...form.allowedRoles, r.key] })} className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-primary bg-primary-soft text-primary' : 'hover:bg-accent'}`}>{r.name}</button>;
                  })}
                </div>
              </Field>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!file} loading={st.isLoading}><UploadCloud /> Upload</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentDetailDialog({ id, onOpenChange }) {
  const { data: doc, isLoading } = useDocumentQuery(id, { skip: !id });
  const download = useDownload();
  const run = useAction();
  const [addVersion, st] = useAddDocumentVersionMutation();
  const [note, setNote] = useState('');
  const url = (v, inline) => `/api/v1/documents/${id}/download?version=${v}${inline ? '&inline=true' : ''}`;
  const previewable = (m) => /^(application\/pdf|image\/)/.test(m || '');
  return (
    <Dialog open={!!id} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {isLoading || !doc ? <RowsSkeleton rows={4} /> : (
          <>
            <DialogHeader>
              <DialogTitle>{doc.title}</DialogTitle>
              <DialogDescription>{doc.category}, uploaded by {doc.uploadedBy?.name} on {fmtDateTime(doc.createdAt)}</DialogDescription>
            </DialogHeader>
            {doc.description && <p className="text-sm">{doc.description}</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => download(url(doc.currentVersion), doc.latest?.fileName)}><Download /> Download v{doc.currentVersion}</Button>
              {previewable(doc.latest?.mimeType) && <Button variant="outline" onClick={() => download(url(doc.currentVersion, true), doc.latest?.fileName, { inline: true })}><Eye /> Preview</Button>}
            </div>
            <div className="text-sm text-muted-foreground">
              {[doc.task && `Task ${doc.task.taskId}`, doc.project && `Project: ${doc.project.title}`, doc.committee && `Committee: ${doc.committee.name}`, doc.meeting && `Meeting: ${doc.meeting.title}`].filter(Boolean).join('; ') || 'Not linked to a task, project, committee or meeting.'}
              {doc.visibility === 'restricted' && <p className="mt-1 text-highlight">Restricted to selected people and roles.</p>}
            </div>
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><History className="h-4 w-4" /> Version history</h3>
              <ul className="divide-y rounded-md border">
                {[...doc.versions].reverse().map((v) => (
                  <li key={v.version} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="tabular w-8 font-medium">v{v.version}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{v.fileName}</p>
                      <p className="text-xs text-muted-foreground">{fileSize(v.size)}, {v.uploadedBy?.name}, {fmtDateTime(v.uploadedAt)}{v.note && `: ${v.note}`}</p>
                    </div>
                    <Button variant="ghost" size="icon-sm" aria-label={`Download version ${v.version}`} onClick={() => download(url(v.version), v.fileName)}><Download /></Button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Upload a new version</p>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed (optional)" />
              <FileDrop multiple={false} onFiles={async ([f]) => { const fd = new FormData(); fd.append('file', f); if (note) fd.append('note', note); if (await run(addVersion({ id, formData: fd }), { success: 'New version uploaded' })) setNote(''); }} hint="Earlier versions are kept" />
              {st.isLoading && <p className="text-xs text-muted-foreground">Uploading…</p>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
