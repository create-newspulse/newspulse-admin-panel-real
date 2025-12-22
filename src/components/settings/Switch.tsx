type Props = {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
};

export default function Switch({ checked, onCheckedChange, disabled, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={
        `relative inline-flex h-6 w-11 items-center rounded-full border transition ` +
        (disabled
          ? 'opacity-50 cursor-not-allowed border-slate-300 bg-slate-200'
          : checked
            ? 'border-blue-600 bg-blue-600'
            : 'border-slate-300 bg-slate-200')
      }
    >
      <span
        className={
          `inline-block h-5 w-5 transform rounded-full bg-white shadow transition ` +
          (checked ? 'translate-x-5' : 'translate-x-0.5')
        }
      />
    </button>
  );
}
