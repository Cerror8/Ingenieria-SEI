export type TabSegmento = {
  id: string;
  label: string;
  count?: number;
};

export function SegmentedTabs({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: readonly TabSegmento[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-slate-200"
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const activo = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activo}
            onClick={() => onChange(tab.id)}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] transition-colors ${
              activo
                ? "border-[#F39200] text-[#1B1B1B]"
                : "border-transparent text-slate-400 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span
                className={`sei-figure px-1.5 py-0.5 text-[10px] font-medium tracking-normal ${
                  activo ? "bg-[#F39200]/15 text-[#9A3412]" : "bg-slate-100 text-slate-500"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
