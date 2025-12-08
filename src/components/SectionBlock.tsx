import React from 'react';

interface SectionBlockProps {
  title?: string;
  children: React.ReactNode;
}

const SectionBlock: React.FC<SectionBlockProps> = ({ title, children }) => (
  <section className="bg-white dark:bg-slate-800 rounded-xl shadow p-5 mb-8 border border-slate-200 dark:border-slate-700">
    {title && <h2 className="text-xl font-semibold mb-4 text-slate-800 dark:text-white">{title}</h2>}
    {children}
  </section>
);

export default SectionBlock;
