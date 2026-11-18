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
    <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-100/70 p-1" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const activo = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activo}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activo
                ? "bg-white text-[#9A3412] shadow-sm"
                : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
            }`}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                  activo ? "bg-orange-100 text-[#9A3412]" : "bg-slate-200/80 text-slate-500"
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
