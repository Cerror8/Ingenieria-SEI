export type NivelUrgencia =
  | "verde"
  | "azul"
  | "amarillo"
  | "naranja"
  | "rojo"
  | "morado"
  | "sin-fecha";

export type Urgencia = {
  nivel: NivelUrgencia;
  etiqueta: string;
  restante: string;
  horas: number | null;
  badge: string;
  barra: string;
  punto: string;
};

const NIVELES: Record<
  Exclude<NivelUrgencia, "sin-fecha">,
  { etiqueta: string; badge: string; barra: string; punto: string }
> = {
  verde: {
    etiqueta: "A tiempo",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    barra: "bg-emerald-500",
    punto: "bg-emerald-500",
  },
  azul: {
    etiqueta: "Programada",
    badge: "border-sky-200 bg-sky-50 text-sky-700",
    barra: "bg-sky-500",
    punto: "bg-sky-500",
  },
  amarillo: {
    etiqueta: "Próxima",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    barra: "bg-amber-400",
    punto: "bg-amber-400",
  },
  naranja: {
    etiqueta: "Esta semana",
    badge: "border-orange-200 bg-orange-50 text-orange-700",
    barra: "bg-orange-500",
    punto: "bg-orange-500",
  },
  rojo: {
    etiqueta: "Urgente",
    badge: "border-rose-200 bg-rose-50 text-rose-700",
    barra: "bg-rose-500",
    punto: "bg-rose-500",
  },
  morado: {
    etiqueta: "Vencida",
    badge: "border-purple-200 bg-purple-50 text-purple-700",
    barra: "bg-purple-600",
    punto: "bg-purple-600",
  },
};

const SIN_FECHA: Urgencia = {
  nivel: "sin-fecha",
  etiqueta: "Sin fecha",
  restante: "Sin fecha límite",
  horas: null,
  badge: "border-slate-200 bg-slate-50 text-slate-500",
  barra: "bg-slate-300",
  punto: "bg-slate-300",
};

export function calcularUrgencia(fechaLimite: string | null | undefined): Urgencia {
  if (!fechaLimite) return SIN_FECHA;

  const fin = new Date(`${fechaLimite.slice(0, 10)}T23:59:59`);
  if (Number.isNaN(fin.getTime())) return SIN_FECHA;

  const horas = (fin.getTime() - Date.now()) / 3_600_000;
  const dias = Math.ceil(horas / 24);

  let nivel: Exclude<NivelUrgencia, "sin-fecha">;
  if (horas <= 0) nivel = "morado";
  else if (dias <= 3) nivel = "rojo";
  else if (dias <= 7) nivel = "naranja";
  else if (dias <= 14) nivel = "amarillo";
  else if (dias <= 30) nivel = "azul";
  else nivel = "verde";

  const base = NIVELES[nivel];
  let restante: string;
  if (horas <= 0) {
    const vencidas = Math.abs(Math.floor(horas / 24));
    restante = vencidas <= 1 ? "Vencida hace menos de un día" : `Vencida hace ${vencidas} días`;
  } else if (horas < 48) {
    const horasRestantes = Math.max(1, Math.ceil(horas));
    restante = `${horasRestantes} ${horasRestantes === 1 ? "hora" : "horas"}`;
  } else if (dias < 14) {
    restante = `${dias} ${dias === 1 ? "día" : "días"}`;
  } else {
    const semanas = Math.ceil(dias / 7);
    restante = `${semanas} ${semanas === 1 ? "semana" : "semanas"}`;
  }

  return { nivel, ...base, restante, horas };
}

export function fechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return "Sin fecha";
  const [anio, mes, dia] = fecha.slice(0, 10).split("-");
  return dia && mes && anio ? `${dia}/${mes}/${anio}` : fecha;
}
