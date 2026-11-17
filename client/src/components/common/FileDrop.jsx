import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn, fileSize } from '@/lib/utils';

export const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif,.zip,.txt,.csv';
export const MAX_MB = 20;

export default function FileDrop({ onFiles, multiple = true, className, hint }) {
  const ref = useRef(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');
  const take = (list) => {
    const files = [...list];
    const big = files.find((f) => f.size > MAX_MB * 1048576);
    if (big) return setError(`${big.name} is ${fileSize(big.size)}; the limit is ${MAX_MB} MB.`);
    setError('');
    onFiles(multiple ? files : files.slice(0, 1));
  };
  return (
    <div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
        className={cn('flex w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:bg-accent', over && 'border-primary bg-primary-soft', className)}
      >
        <UploadCloud className="h-5 w-5" />
        <span><span className="font-medium text-foreground">Choose files</span> or drop them here</span>
        <span className="text-xs">{hint || `PDF, Office files, images, ZIP — up to ${MAX_MB} MB each`}</span>
      </button>
      <input ref={ref} type="file" accept={ACCEPT} multiple={multiple} className="hidden" onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
