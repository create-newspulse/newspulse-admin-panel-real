import { useState, KeyboardEvent } from 'react';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}

export default function TagInput({ value, onChange, suggestions = [] }: TagInputProps) {
  const [input, setInput] = useState('');
  const addTag = (tag: string) => {
    tag = tag.trim();
    if (!tag || value.includes(tag)) return;
    onChange([...value, tag]);
    setInput('');
  };
  const removeTag = (tag: string) => onChange(value.filter(t => t !== tag));

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && value.length) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map(tag => (
          <span key={tag} className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 flex items-center gap-1">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="text-red-600">×</button>
          </span>
        ))}
      </div>
      <input
        value={input}
        onChange={e=> setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Type and press Enter"
        className="w-full border px-2 py-2 rounded"
      />
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {suggestions.slice(0,8).map(s => (
            <button key={s} type="button" onClick={()=>addTag(s)} className="px-2 py-1 rounded border hover:bg-slate-100">{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}
