// Simplified stub component to satisfy old imports after rollback.
// Remove once no code references MarkdownTextarea.
import React from 'react';

export interface MarkdownTextareaProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const MarkdownTextarea: React.FC<MarkdownTextareaProps> = ({ value, onChange, placeholder, className }) => {
  return (
    <textarea
      className={className || 'w-full border rounded px-2 py-1 min-h-[160px] font-mono text-xs'}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder || 'Markdown content'}
    />
  );
};

export default MarkdownTextarea;
