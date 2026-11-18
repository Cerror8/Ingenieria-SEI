export const CHART_COLORS = [
  "#F39200",
  "#0EA5E9",
  "#10B981",
  "#8B5CF6",
  "#F43F5E",
  "#F59E0B",
  "#6366F1",
  "#14B8A6",
  "#EC4899",
  "#64748B",
];

export function chartColor(indice: number): string {
  return CHART_COLORS[((indice % CHART_COLORS.length) + CHART_COLORS.length) % CHART_COLORS.length];
}
