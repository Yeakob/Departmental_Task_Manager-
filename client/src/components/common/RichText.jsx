import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import DOMPurify from 'dompurify';
import { Bold, Italic, Underline as U, List, ListOrdered, Heading2, Quote, Link2, Undo2, Redo2, Code } from 'lucide-react';
import { cn } from '@/lib/utils';

function ToolButton({ on, active, label, children }) {
  return (
    <button type="button" onClick={on} aria-label={label} title={label} className={cn('rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground', active && 'bg-accent text-foreground')}>
      {children}
    </button>
  );
}

export function RichTextEditor({ value, onChange, placeholder = 'Write here…', className, minimal = false }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), Underline, Link.configure({ openOnClick: false, autolink: true }), Placeholder.configure({ placeholder })],
    content: value || '',
    editorProps: { attributes: { class: 'prose-dwmt px-3 py-2 max-w-none' } },
    onUpdate: ({ editor: e }) => onChange?.(e.isEmpty ? '' : e.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== undefined && value !== editor.getHTML() && !(editor.isEmpty && !value)) {
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor]);

  if (!editor) return null;
  const c = () => editor.chain().focus();
  const setLink = () => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('Link address', prev || 'https://');
    if (url === null) return;
    if (url === '') c().unsetLink().run();
    else c().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className={cn('rounded-md border border-input bg-surface focus-within:ring-2 focus-within:ring-ring', className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1 [&_svg]:h-4 [&_svg]:w-4">
        <ToolButton label="Bold" on={() => c().toggleBold().run()} active={editor.isActive('bold')}><Bold /></ToolButton>
        <ToolButton label="Italic" on={() => c().toggleItalic().run()} active={editor.isActive('italic')}><Italic /></ToolButton>
        <ToolButton label="Underline" on={() => c().toggleUnderline().run()} active={editor.isActive('underline')}><U /></ToolButton>
        {!minimal && <ToolButton label="Heading" on={() => c().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading')}><Heading2 /></ToolButton>}
        <ToolButton label="Bulleted list" on={() => c().toggleBulletList().run()} active={editor.isActive('bulletList')}><List /></ToolButton>
        <ToolButton label="Numbered list" on={() => c().toggleOrderedList().run()} active={editor.isActive('orderedList')}><ListOrdered /></ToolButton>
        {!minimal && <ToolButton label="Quote" on={() => c().toggleBlockquote().run()} active={editor.isActive('blockquote')}><Quote /></ToolButton>}
        {!minimal && <ToolButton label="Code" on={() => c().toggleCode().run()} active={editor.isActive('code')}><Code /></ToolButton>}
        <ToolButton label="Link" on={setLink} active={editor.isActive('link')}><Link2 /></ToolButton>
        <span className="flex-1" />
        <ToolButton label="Undo" on={() => c().undo().run()}><Undo2 /></ToolButton>
        <ToolButton label="Redo" on={() => c().redo().run()}><Redo2 /></ToolButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function RichTextView({ html, className, empty = 'No description.' }) {
  if (!html || !html.replace(/<[^>]+>/g, '').trim()) return <p className={cn('text-sm text-muted-foreground', className)}>{empty}</p>;
  return <div className={cn('prose-dwmt', className)} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }) }} />;
}
