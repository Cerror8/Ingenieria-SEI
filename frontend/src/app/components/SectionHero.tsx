import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type KpiHero = {
  label: string;
  value: string | number;
  icon: LucideIcon;
};

const COLUMNAS_KPI: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
};

export function SectionHero({
  eyebrow,
  icon: IconoEtiqueta,
  title,
  subtitle,
  actions,
  kpis,
  compact = false,
}: {
  eyebrow: string;
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  kpis?: KpiHero[];
  compact?: boolean;
}) {
  return (
    <section
      className={`sei-fade-up relative overflow-hidden rounded-2xl bg-[#1B1B1B] text-white shadow-sm ${
        compact ? "px-4 py-4 sm:px-5" : "px-5 py-6 sm:px-7"
      }`}
    >
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#F39200]/15" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-white/5" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F39200]/40 bg-[#F39200]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#FDBA74]">
            {IconoEtiqueta && <IconoEtiqueta className="h-3 w-3" />}
            {eyebrow}
          </span>
          <h1
            className={`mt-3 font-black leading-tight tracking-tight ${
              compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"
            }`}
          >
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-white/60">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {kpis && kpis.length > 0 && (
        <div className={`relative mt-5 grid grid-cols-2 gap-2 ${COLUMNAS_KPI[kpis.length] ?? "sm:grid-cols-4"}`}>
          {kpis.map((item, indice) => {
            const Icono = item.icon;
            return (
              <div
                key={item.label}
                style={{ animationDelay: `${80 + indice * 60}ms` }}
                className="sei-pop rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <Icono className="h-3.5 w-3.5 text-[#FDBA74]" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                    {item.label}
                  </p>
                </div>
                <p className="mt-1 text-xl font-black leading-none text-white">{item.value}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
