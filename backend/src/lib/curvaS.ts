import { pool, type Db } from "../db.js";

type Consulta = typeof pool | Db;

const MS_DIA = 86_400_000;

type ProyectoCurva = {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  presupuesto: number;
  avance: number;
  ejecucion: number;
  hoy: string;
};

type ActividadCurva = { mesInicio: number; mesFin: number };

type Corte = { fecha: string; avance: number; ejecucion: number };

export type PuntoCurva = {
  fecha: string;
  avanceProgramado: number;
  avanceReal: number | null;
  ejecucionProgramada: number;
  ejecucionReal: number | null;
};

export type CurvaS = {
  proyecto: {
    id: string;
    fechaInicio: string;
    fechaFin: string;
    presupuesto: number;
    avance: number;
    ejecucionPct: number;
  };
  fuenteProgramacion: "Gantt" | "Lineal";
  puntos: PuntoCurva[];
  resumen: {
    avanceProgramadoHoy: number;
    avanceRealHoy: number;
    desviacionAvance: number;
    ejecucionProgramadaHoy: number;
    ejecucionRealHoy: number;
    desviacionEjecucion: number;
    diasEquivalentes: number;
  };
};

const aFecha = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const aIso = (fecha: Date) => fecha.toISOString().slice(0, 10);
const acotar = (valor: number) => Math.max(0, Math.min(100, valor));
const redondear = (valor: number) => Math.round(valor * 10) / 10;
const diasEntre = (desde: Date, hasta: Date) => (hasta.getTime() - desde.getTime()) / MS_DIA;

function primerDiaMes(base: Date, indice: number): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + indice, 1));
}

function ultimoDiaMes(base: Date, indice: number): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + indice + 1, 0));
}

function rangoActividad(
  actividad: ActividadCurva,
  inicio: Date,
  fin: Date,
): { inicio: Date; fin: Date } {
  const inicioPlan = primerDiaMes(inicio, actividad.mesInicio - 1);
  const finPlan = ultimoDiaMes(inicio, actividad.mesFin - 1);
  return {
    inicio: new Date(Math.max(inicioPlan.getTime(), inicio.getTime())),
    fin: new Date(Math.min(finPlan.getTime(), fin.getTime())),
  };
}

function fraccionActividad(
  actividad: ActividadCurva,
  fecha: Date,
  inicio: Date,
  fin: Date,
): number {
  const rango = rangoActividad(actividad, inicio, fin);
  if (rango.fin <= rango.inicio) return fecha >= rango.fin ? 1 : 0;
  if (fecha <= rango.inicio) return 0;
  if (fecha >= rango.fin) return 1;
  return (fecha.getTime() - rango.inicio.getTime()) / (rango.fin.getTime() - rango.inicio.getTime());
}

function fechasDeCurva(inicio: Date, fin: Date, cortes: Corte[], hoy: string): string[] {
  const fechas = new Set<string>([aIso(inicio), aIso(fin), hoy]);
  for (let indice = 0; ; indice += 1) {
    const mes = primerDiaMes(inicio, indice);
    if (mes > fin) break;
    const cierre = ultimoDiaMes(inicio, indice);
    fechas.add(aIso(new Date(Math.min(cierre.getTime(), fin.getTime()))));
  }
  for (const corte of cortes) {
    if (corte.fecha >= aIso(inicio)) fechas.add(corte.fecha);
  }
  return [...fechas].sort();
}

export async function registrarCorteAvance(db: Consulta, proyectoId: string): Promise<void> {
  const { rows } = await db.query<{ avance: number; ejecucion: number }>(
    "SELECT avance, ejecucion_pct AS ejecucion FROM proyectos WHERE id = $1",
    [proyectoId],
  );
  if (!rows[0]) return;
  await db.query(
    `INSERT INTO proyecto_avance_cortes (proyecto_id, fecha_corte, avance_real, ejecucion_real)
     VALUES ($1, (now() AT TIME ZONE 'America/Bogota')::date, $2, $3)
     ON CONFLICT (proyecto_id, fecha_corte)
     DO UPDATE SET avance_real = EXCLUDED.avance_real, ejecucion_real = EXCLUDED.ejecucion_real`,
    [proyectoId, rows[0].avance, rows[0].ejecucion],
  );
}

export async function calcularCurvaS(db: Consulta, proyectoId: string): Promise<CurvaS | null> {
  const { rows } = await db.query<ProyectoCurva>(
    `SELECT id, fecha_inicio AS "fechaInicio", fecha_fin AS "fechaFin", presupuesto,
            avance, ejecucion_pct AS ejecucion,
            (now() AT TIME ZONE 'America/Bogota')::date AS hoy
       FROM proyectos WHERE id = $1`,
    [proyectoId],
  );
  const proyecto = rows[0];
  if (!proyecto) return null;

  const [{ rows: actividades }, { rows: cortes }] = await Promise.all([
    db.query<ActividadCurva>(
      `SELECT mes_inicio AS "mesInicio", mes_fin AS "mesFin"
         FROM actividades WHERE proyecto_id = $1 ORDER BY mes_inicio, mes_fin`,
      [proyectoId],
    ),
    db.query<Corte>(
      `SELECT fecha_corte AS fecha, avance_real AS avance, ejecucion_real AS ejecucion
         FROM proyecto_avance_cortes WHERE proyecto_id = $1 ORDER BY fecha_corte`,
      [proyectoId],
    ),
  ]);

  const inicio = aFecha(proyecto.fechaInicio);
  const fin = aFecha(proyecto.fechaFin);
  const totalDias = Math.max(1, diasEntre(inicio, fin));
  const pesos = actividades.map((actividad) => Math.max(1, actividad.mesFin - actividad.mesInicio + 1));
  const pesoTotal = pesos.reduce((suma, peso) => suma + peso, 0);

  const programadoLineal = (fecha: Date) => {
    if (fecha <= inicio) return 0;
    if (fecha >= fin) return 100;
    return acotar((diasEntre(inicio, fecha) / totalDias) * 100);
  };

  const avanceProgramado = (fecha: Date) => {
    if (!pesoTotal) return programadoLineal(fecha);
    const avance = actividades.reduce(
      (suma, actividad, indice) =>
        suma + pesos[indice] * fraccionActividad(actividad, fecha, inicio, fin),
      0,
    );
    return acotar((avance / pesoTotal) * 100);
  };

  const cortesOrdenados = [...cortes].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const corteEn = (fecha: string): { avance: number; ejecucion: number } | null => {
    if (fecha === proyecto.hoy) {
      return { avance: proyecto.avance, ejecucion: proyecto.ejecucion };
    }
    let encontrado: Corte | null = null;
    for (const corte of cortesOrdenados) {
      if (corte.fecha <= fecha) encontrado = corte;
      else break;
    }
    return encontrado;
  };
  const corteVisible = (fecha: string) => fecha <= proyecto.hoy;

  const puntos: PuntoCurva[] = fechasDeCurva(inicio, fin, cortes, proyecto.hoy).map((fecha) => {
    const dia = aFecha(fecha);
    const real = corteVisible(fecha) ? corteEn(fecha) : null;
    return {
      fecha,
      avanceProgramado: redondear(avanceProgramado(dia)),
      avanceReal: real ? real.avance : null,
      ejecucionProgramada: redondear(programadoLineal(dia)),
      ejecucionReal: real ? real.ejecucion : null,
    };
  });

  const hoy = aFecha(proyecto.hoy);
  const programadoHoy = redondear(avanceProgramado(hoy));
  const financieroHoy = redondear(programadoLineal(hoy));
  const desviacionAvance = redondear(proyecto.avance - programadoHoy);
  const desviacionEjecucion = redondear(proyecto.ejecucion - financieroHoy);
  const diasEquivalentes = Math.round((desviacionAvance / 100) * totalDias);

  return {
    proyecto: {
      id: proyecto.id,
      fechaInicio: proyecto.fechaInicio,
      fechaFin: proyecto.fechaFin,
      presupuesto: proyecto.presupuesto,
      avance: proyecto.avance,
      ejecucionPct: proyecto.ejecucion,
    },
    fuenteProgramacion: actividades.length ? "Gantt" : "Lineal",
    puntos,
    resumen: {
      avanceProgramadoHoy: programadoHoy,
      avanceRealHoy: proyecto.avance,
      desviacionAvance,
      ejecucionProgramadaHoy: financieroHoy,
      ejecucionRealHoy: proyecto.ejecucion,
      desviacionEjecucion,
      diasEquivalentes,
    },
  };
}
