'use client';

interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

interface FilterBarProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

export default function FilterBar({ options, value, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
            value === opt.value
              ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
              : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
          }`}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span className="ml-1 text-xs opacity-70">{opt.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
