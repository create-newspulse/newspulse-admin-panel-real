import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import CodeBlock from '@tiptap/extension-code-block';
import Underline from '@tiptap/extension-underline'; // Γ£à Fix for toggleUnderline
const MenuBar = ({ editor }) => {
    if (!editor)
        return null;
    const buttonClass = 'px-2 py-1 bg-white dark:bg-gray-700 rounded shadow hover:bg-blue-100 dark:hover:bg-slate-600 transition';
    return (_jsxs("div", { className: "flex flex-wrap gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded mb-3 text-sm", children: [_jsx("button", { onClick: () => editor.chain().focus().toggleBold().run(), className: buttonClass, children: "Bold" }), _jsx("button", { onClick: () => editor.chain().focus().toggleItalic().run(), className: buttonClass, children: "Italic" }), _jsx("button", { onClick: () => editor.chain().focus().toggleUnderline().run(), className: buttonClass, children: "Underline" }), _jsx("button", { onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), className: buttonClass, children: "H2" }), _jsx("button", { onClick: () => editor.chain().focus().toggleBulletList().run(), className: buttonClass, children: "\u2022 List" }), _jsx("button", { onClick: () => editor.chain().focus().toggleBlockquote().run(), className: buttonClass, children: "\u275D Quote" }), _jsx("button", { onClick: () => editor.chain().focus().toggleCodeBlock().run(), className: buttonClass, children: "Code" })] }));
};
const RichTextEditor = ({ content, onChange }) => {
    const editor = useEditor({
        extensions: [StarterKit, Underline, Image, Link, CodeBlock],
        content,
        editorProps: {
            attributes: {
                class: 'min-h-[200px] outline-none prose dark:prose-invert max-w-full',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);
    return (_jsxs("div", { className: "border rounded p-3 bg-white dark:bg-gray-900", children: [_jsx(MenuBar, { editor: editor }), _jsx(EditorContent, { editor: editor })] }));
};
export default RichTextEditor;
