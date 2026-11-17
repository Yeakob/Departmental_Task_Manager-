import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DocumentTable from '@/features/documents/DocumentTable';
import { UploadDocumentDialog, DOC_CATEGORIES } from '@/features/documents/DocumentDialogs';
import { useDocumentsQuery } from '@/services/endpoints';
import { useDebounce, usePermissions } from '@/hooks';
import { cn } from '@/lib/utils';

export default function Documents() {
  const { can } = usePermissions();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [upload, setUpload] = useState(false);
  const [openId, setOpenId] = useState(null);
  const query = useDocumentsQuery({ q: dq, category, from, to: to ? `${to}T23:59:59` : undefined, page, limit: 25 });

  useEffect(() => {
    if (params.get('new')) setUpload(true);
    if (params.get('open')) setOpenId(params.get('open'));
    if (params.get('new') || params.get('open')) setParams({}, { replace: true });
  }, [params, setParams]);

  return (
    <div>
      <PageHeader title="Documents" description="The department’s shared repository. Every file keeps its version history." actions={can('document:upload') && <Button onClick={() => setUpload(true)}><Plus /> Upload</Button>} />
      <div className="mb-3 flex gap-1 overflow-x-auto border-b">
        {['', ...DOC_CATEGORIES].map((c) => (
          <button key={c || 'all'} onClick={() => { setCategory(c); setPage(1); }} className={cn('-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium', category === c ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>{c || 'All'}</button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search titles, tags, descriptions" className="pl-8" />
        </div>
        <label className="text-xs text-muted-foreground">Uploaded from<Input type="date" className="mt-1 h-9 w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs text-muted-foreground">to<Input type="date" className="mt-1 h-9 w-40" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <Panel className="overflow-hidden">
        <DocumentTable query={query} onPage={setPage} openId={openId} setOpenId={setOpenId} emptyAction={can('document:upload') && <Button variant="outline" onClick={() => setUpload(true)}><Plus /> Upload</Button>} />
      </Panel>
      <UploadDocumentDialog open={upload} onOpenChange={setUpload} />
    </div>
  );
}
