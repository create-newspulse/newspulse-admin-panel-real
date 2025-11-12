// Minimal placeholder to satisfy lingering references after rollback.
// Remove this file once all imports to AddArticleForm are gone.
import React from 'react';

export interface AddArticleFormProps {
  initial?: { title?: string; content?: string };
  onSubmit?: (data: { title: string; content: string }) => void;
}

const AddArticleForm: React.FC<AddArticleFormProps> = ({ initial, onSubmit }) => {
  const [title, setTitle] = React.useState(initial?.title || '');
  const [content, setContent] = React.useState(initial?.content || '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.({ title, content });
      }}
      className="p-4 border rounded bg-white space-y-2 text-sm"
    >
      <div>
        <label className="block mb-1 font-medium">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border px-2 py-1 rounded"
          placeholder="Title"
        />
      </div>
      <div>
        <label className="block mb-1 font-medium">Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full border px-2 py-1 rounded min-h-[120px]"
          placeholder="Content"
        />
      </div>
      <button type="submit" className="px-3 py-1 rounded bg-green-600 text-white">
        Save
      </button>
    </form>
  );
};

export default AddArticleForm;
