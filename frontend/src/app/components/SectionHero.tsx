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
      className={`sei-fade-up relative overflow-hidden rounded-xl border border-white/10 bg-[#1B1B1B] text-white ${
        compact ? "px-4 py-4 sm:px-5" : "px-5 py-6 sm:px-7"
      }`}
    >
      <div className="sei-blueprint pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_right,black,transparent_75%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(243,146,0,0.16),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-[#F39200] via-[#F39200]/80 to-transparent" />
      <div className="pointer-events-none absolute left-3 top-3 h-3 w-3 border-l border-t border-white/25" />
      <div className="pointer-events-none absolute right-3 top-3 h-3 w-3 border-r border-t border-white/25" />
      <div className="pointer-events-none absolute bottom-3 left-3 h-3 w-3 border-b border-l border-white/15" />
      <div className="pointer-events-none absolute bottom-3 right-3 h-3 w-3 border-b border-r border-white/15" />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <span className="flex items-center gap-2 text-[#FDBA74]">
            {IconoEtiqueta ? (
              <IconoEtiqueta className="h-3.5 w-3.5" />
            ) : (
              <span className="h-1.5 w-1.5 bg-[#F39200]" />
            )}
            <span className="sei-label">{eyebrow}</span>
            <span className="h-px w-8 bg-[#F39200]/60" />
          </span>
          <h1
            className={`mt-2.5 font-bold leading-tight tracking-[-0.02em] ${
              compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-[28px]"
            }`}
          >
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-white/55">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {kpis && kpis.length > 0 && (
        <div
          className={`relative mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 ${
            COLUMNAS_KPI[kpis.length] ?? "sm:grid-cols-4"
          }`}
        >
          {kpis.map((item, indice) => {
            const Icono = item.icon;
            return (
              <div
                key={item.label}
                style={{ animationDelay: `${80 + indice * 60}ms` }}
                className="sei-pop bg-[#212224] px-3.5 py-3"
              >
                <div className="flex items-center gap-1.5 text-white/45">
                  <Icono className="h-3 w-3 text-[#F39200]" />
                  <p className="sei-label">{item.label}</p>
                </div>
                <p className="sei-figure mt-1.5 text-[22px] font-semibold leading-none text-white">
                  {item.value}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
