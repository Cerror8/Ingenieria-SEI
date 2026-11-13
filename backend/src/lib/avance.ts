import { pool, type Db } from "../db.js";

type Consulta = typeof pool | Db;

const VALOR_ESTADO: Record<string, number> = {
  Completado: 100,
  "En ejecución": 50,
  "No realizado": 0,
};

const redondear = (valor: number) => Math.max(0, Math.min(100, Math.round(valor)));

type FilaEdt = { id: string; padreId: string | null; estado: string; noAplica: boolean };

// El avance del proyecto se calcula desde el EDT (promedio de actividades raíz,
// donde cada raíz con subproductos vale el promedio de sus hijos) y, si no hay
// EDT, desde el promedio del Gantt. Sin actividades se conserva el avance manual.
export async function recalcularAvanceProyecto(
  db: Consulta,
  proyectoId: string,
): Promise<{ avance: number; origen: "EDT" | "Gantt" } | null> {
  const { rows: edt } = await db.query<FilaEdt>(
    `SELECT id, padre_id AS "padreId", estado, no_aplica AS "noAplica"
       FROM edt_actividades
      WHERE proyecto_id = $1`,
    [proyectoId],
  );

  let avance: number | null = null;
  let origen: "EDT" | "Gantt" = "EDT";

  const aplicables = edt.filter((fila) => !fila.noAplica);
  if (aplicables.length) {
    const hijos = new Map<string, FilaEdt[]>();
    const raices: FilaEdt[] = [];
    for (const fila of aplicables) {
      if (fila.padreId) {
        const lista = hijos.get(fila.padreId) ?? [];
        lista.push(fila);
        hijos.set(fila.padreId, lista);
      } else {
        raices.push(fila);
      }
    }

    const valor = (fila: FilaEdt): number => {
      const suyos = hijos.get(fila.id) ?? [];
      if (suyos.length) {
        return suyos.reduce((suma, hijo) => suma + valor(hijo), 0) / suyos.length;
      }
      return VALOR_ESTADO[fila.estado] ?? 0;
    };

    if (raices.length) {
      avance = redondear(raices.reduce((suma, raiz) => suma + valor(raiz), 0) / raices.length);
    }
  } else {
    const { rows } = await db.query<{ total: number; promedio: number | null }>(
      `SELECT count(*)::int AS total, avg(avance)::float AS promedio
         FROM actividades
        WHERE proyecto_id = $1`,
      [proyectoId],
    );
    if (rows[0]?.total) {
      avance = redondear(rows[0].promedio ?? 0);
      origen = "Gantt";
    }
  }

  if (avance === null) {
    // Sin EDT ni Gantt, el avance vuelve a control manual conservando el último valor.
    await db.query(
      `UPDATE proyectos SET avance_origen = 'Manual' WHERE id = $1 AND avance_origen <> 'Manual'`,
      [proyectoId],
    );
    return null;
  }

  const { rows: actuales } = await db.query<{ avance: number; origen: string }>(
    `SELECT avance, avance_origen AS origen FROM proyectos WHERE id = $1`,
    [proyectoId],
  );
  const actual = actuales[0];
  if (!actual) return null;

  if (actual.avance !== avance || actual.origen !== origen) {
    await db.query(
      `UPDATE proyectos SET avance = $2, avance_origen = $3 WHERE id = $1`,
      [proyectoId, avance, origen],
    );
  }
  return { avance, origen };
}

async function estadoDesdeHijos(db: Consulta, actividadId: string): Promise<string | null> {
  const { rows: hijos } = await db.query<{ id: string; estado: string }>(
    `SELECT id, estado FROM edt_actividades WHERE padre_id = $1 AND no_aplica = false`,
    [actividadId],
  );
  if (!hijos.length) return null;

  // Un padre sólo se recalcula cuando alguna tarea quedó vinculada a sus subproductos.
  const { rows: conTareas } = await db.query(
    `SELECT 1 FROM tareas_tablero WHERE edt_actividad_id = ANY($1::uuid[]) LIMIT 1`,
    [hijos.map((hijo) => hijo.id)],
  );
  if (!conTareas.length) return null;

  if (hijos.every((hijo) => hijo.estado === "Completado")) return "Completado";
  if (hijos.some((hijo) => hijo.estado !== "No realizado")) return "En ejecución";
  return null;
}

async function estadoDesdeTareas(db: Consulta, actividadId: string): Promise<string | null> {
  const { rows } = await db.query<{ columna: string }>(
    `SELECT columna FROM tareas_tablero WHERE edt_actividad_id = $1`,
    [actividadId],
  );
  if (!rows.length) return null;
  if (rows.every((tarea) => tarea.columna === "completado")) return "Completado";
  if (rows.some((tarea) => tarea.columna !== "por-hacer")) return "En ejecución";
  return null;
}

// Una actividad con documento obligatorio o con requisitos previos pendientes
// no puede quedar completada sólo porque sus tareas se aprobaron.
export async function bloqueoParaCompletar(
  db: Consulta,
  actividadId: string,
): Promise<string | null> {
  const { rows } = await db.query<{
    requiere: boolean;
    documentos: number;
    requisitos: number;
  }>(
    `SELECT a.requiere_documento AS requiere,
            (SELECT COUNT(*)::int FROM documentos d WHERE d.edt_actividad_id = a.id) AS documentos,
            (SELECT COUNT(*)::int
               FROM edt_requisitos q
               JOIN edt_actividades r ON r.id = q.requisito_id
              WHERE q.actividad_id = a.id
                AND r.no_aplica = false
                AND (r.estado <> 'Completado'
                     OR (r.requiere_documento
                         AND NOT EXISTS (SELECT 1 FROM documentos d2 WHERE d2.edt_actividad_id = r.id)))
            ) AS requisitos
       FROM edt_actividades a WHERE a.id = $1`,
    [actividadId],
  );
  const fila = rows[0];
  if (!fila) return null;
  if (fila.requiere && fila.documentos === 0) {
    return "La actividad exige un documento cargado.";
  }
  if (fila.requisitos > 0) return "Hay requisitos previos pendientes.";
  return null;
}

// Al mover, aprobar, devolver o eliminar una tarea vinculada, el estado sube
// hacia la actividad EDT y su padre. Nunca se rebaja a "No realizado" de forma
// automática: una actividad completada permanece así hasta que se reabra a mano.
export async function sincronizarEdtDesdeTareas(
  db: Consulta,
  actividadId: string | null | undefined,
): Promise<void> {
  if (!actividadId) return;

  const { rows } = await db.query<{
    id: string;
    proyectoId: string;
    padreId: string | null;
    estado: string;
    noAplica: boolean;
  }>(
    `SELECT id, proyecto_id AS "proyectoId", padre_id AS "padreId", estado,
            no_aplica AS "noAplica"
       FROM edt_actividades WHERE id = $1`,
    [actividadId],
  );
  const actividad = rows[0];
  if (!actividad) return;
  if (actividad.noAplica) return;

  let nuevo =
    (await estadoDesdeHijos(db, actividad.id)) ?? (await estadoDesdeTareas(db, actividad.id));
  if (nuevo === "Completado") {
    const bloqueo = await bloqueoParaCompletar(db, actividad.id);
    if (bloqueo && actividad.estado !== "Completado") nuevo = "En ejecución";
  }
  if (nuevo && nuevo !== actividad.estado) {
    await db.query(`UPDATE edt_actividades SET estado = $2 WHERE id = $1`, [actividad.id, nuevo]);
  }

  if (actividad.padreId) {
    const padreNuevo = await estadoDesdeHijos(db, actividad.padreId);
    if (padreNuevo) {
      const bloqueo =
        padreNuevo === "Completado" ? await bloqueoParaCompletar(db, actividad.padreId) : null;
      if (!bloqueo) {
        await db.query(
          `UPDATE edt_actividades SET estado = $2 WHERE id = $1 AND estado <> $2`,
          [actividad.padreId, padreNuevo],
        );
      }
    }
  }

  await recalcularAvanceProyecto(db, actividad.proyectoId);
}
