import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';

interface Props { value: string; onChange: (html: string) => void; }

export const RichTextEditor: React.FC<Props> = ({ value, onChange }) => {
  const editor = useEditor({
    extensions: [StarterKit, Underline, Link.configure({ openOnClick: true }), Image],
    content: value || '<p></p>',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    }
  });

  if (!editor) return <div className="text-xs text-slate-500">Loading editor…</div>;

  return (
    <div className="border rounded">
      <div className="flex flex-wrap gap-1 p-2 border-b bg-slate-50">
        <ToolbarButton editor={editor} action="toggleBold" label="B" />
        <ToolbarButton editor={editor} action="toggleItalic" label="I" />
        <ToolbarButton editor={editor} action="toggleUnderline" label="U" />
        <ToolbarButton editor={editor} action="toggleBulletList" label="• List" />
        <ToolbarButton editor={editor} action="toggleOrderedList" label="1." />
        <ToolbarButton editor={editor} action="toggleBlockquote" label="❝" />
        <button type="button" onClick={()=> {
          const url = window.prompt('Image URL');
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }} className="px-2 py-0.5 text-xs bg-indigo-600 text-white rounded">Img</button>
        <button
          type="button"
          onClick={()=> {
            // Reset to an empty paragraph; no need to store previous HTML locally
            editor.commands.clearContent();
            editor.commands.insertContent('<p></p>');
          }}
          className="px-2 py-0.5 text-xs bg-slate-600 text-white rounded"
        >
          Clear
        </button>
      </div>
      <EditorContent editor={editor} className="min-h-40 p-3 prose prose-sm max-w-none focus:outline-none" />
    </div>
  );
};

interface ToolbarButtonProps { editor: any; action: string; label: string; }
const ToolbarButton: React.FC<ToolbarButtonProps> = ({ editor, action, label }) => {
  const activeMap: Record<string, () => boolean> = {
    toggleBold: () => editor.isActive('bold'),
    toggleItalic: () => editor.isActive('italic'),
    toggleUnderline: () => editor.isActive('underline'),
    toggleBulletList: () => editor.isActive('bulletList'),
    toggleOrderedList: () => editor.isActive('orderedList'),
    toggleBlockquote: () => editor.isActive('blockquote'),
  };
  const runMap: Record<string, () => any> = {
    toggleBold: () => editor.chain().focus().toggleBold().run(),
    toggleItalic: () => editor.chain().focus().toggleItalic().run(),
    toggleUnderline: () => editor.chain().focus().toggleUnderline().run(),
    toggleBulletList: () => editor.chain().focus().toggleBulletList().run(),
    toggleOrderedList: () => editor.chain().focus().toggleOrderedList().run(),
    toggleBlockquote: () => editor.chain().focus().toggleBlockquote().run(),
  };
  const isActive = activeMap[action]?.();
  return (
    <button type="button" onClick={runMap[action]} className={`px-2 py-0.5 text-xs rounded ${isActive? 'bg-blue-600 text-white':'bg-white border'}`}>{label}</button>
  );
};

export default RichTextEditor;
