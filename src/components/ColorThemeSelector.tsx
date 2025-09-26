import { useAdminSettings } from '../context/AdminSettingsContext';
import { useEffect } from 'react';

const THEME_COLORS = [
  { name: 'Blue', value: '#2563eb' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Purple', value: '#8b5cf6' },
];

export default function ColorThemeSelector() {
  const { themeColor, setThemeColor } = useAdminSettings();

  useEffect(() => {
    if (themeColor) {
      document.documentElement.style.setProperty('--tw-color-primary', themeColor);
    }
  }, [themeColor]);

  const applyColor = (color: string) => {
    try {
      document.documentElement.style.setProperty('--tw-color-primary', color);
      setThemeColor(color);
      localStorage.setItem('themeColor', color);
    } catch (err) {
      console.error('❌ Failed to apply theme color:', err);
    }
  };

  return (
    <section className="p-6 border rounded-xl bg-white dark:bg-slate-900 shadow">
      <h2 className="text-xl font-bold text-primary mb-4">
        🎨 Primary Theme Color
      </h2>
      <div className="flex gap-4 flex-wrap items-center">
        {THEME_COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => applyColor(color.value)}
            title={color.name}
            aria-label={`Set theme to ${color.name}`}
            className={`w-10 h-10 rounded-full border-4 transition-all duration-300 focus:outline-none ${
              themeColor === color.value
                ? 'border-primary ring-2 ring-primary'
                : 'border-gray-300 dark:border-gray-700'
            }`}
            style={{ backgroundColor: color.value }}
          />
        ))}
      </div>
    </section>
  );
}
