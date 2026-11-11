import { Router } from "express";
import { z } from "zod";
import { registrarAuditoria } from "../audit.js";
import type { UsuarioSesion } from "../auth/session.js";
import { pool, withTx, type Db } from "../db.js";
import { ah, HttpError } from "../http.js";
import { recalcularAvanceProyecto } from "../lib/avance.js";

export const ESTADOS_EDT = ["Completado", "En ejecución", "No realizado"] as const;

const CAMPOS = `
  id, proyecto_id AS "proyectoId", etapa, padre_id AS "padreId", actividad AS "nombre",
  responsable, responsable_id AS "responsableId",
  fecha_cumplimiento AS "fechaCumplimiento", estado, orden
`;

const crearSchema = z.object({
  etapa: z.coerce.number().int().min(1).max(3),
  padreId: z.string().uuid("La actividad predecesora es inválida").nullable().optional(),
  nombre: z.string().trim().max(300).default(""),
  responsable: z.string().trim().max(120).nullable().optional(),
  responsableId: z.string().uuid("Responsable inválido").nullable().optional(),
  fechaCumplimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato AAAA-MM-DD")
    .nullable()
    .optional(),
  estado: z.enum(ESTADOS_EDT).optional().default("No realizado"),
});

const actualizarSchema = crearSchema.partial();

type ProyectoRef = { id: string; nombre: string };

async function proyectoDeRuta(id: string): Promise<ProyectoRef> {
  const { rows } = await pool.query<ProyectoRef>(
    "SELECT id, nombre FROM proyectos WHERE id = $1",
    [id],
  );
  if (!rows[0]) throw new HttpError(404, "Proyecto no encontrado");
  return rows[0];
}

type ActividadFila = {
  id: string;
  proyectoId: string;
  etapa: number;
  padreId: string | null;
  nombre: string;
  estado: (typeof ESTADOS_EDT)[number];
};

async function actividadDeRuta(id: string): Promise<ActividadFila> {
  const { rows } = await pool.query<ActividadFila>(
    `SELECT ${CAMPOS} FROM edt_actividades WHERE id = $1`,
    [id],
  );
  if (!rows[0]) throw new HttpError(404, "Actividad del EDT no encontrada");
  return rows[0];
}

async function resolverResponsableEdt(
  responsableId: string | null | undefined,
  texto: string | null | undefined,
  enviadoId: boolean,
): Promise<{ id: string | null; nombre: string | null }> {
  if (enviadoId) {
    if (!responsableId) return { id: null, nombre: null };
    const { rows } = await pool.query<{ nombre: string }>(
      "SELECT nombre FROM usuarios WHERE id = $1 AND activo = true",
      [responsableId],
    );
    if (!rows[0]) {
      throw new HttpError(400, "El responsable seleccionado no existe o está inactivo.");
    }
    return { id: responsableId, nombre: rows[0].nombre };
  }
  return { id: null, nombre: texto?.trim() || null };
}

async function validarPadre(
  padreId: string,
  proyectoId: string,
  etapa: number,
  propioId?: string,
): Promise<void> {
  if (propioId && padreId === propioId) {
    throw new HttpError(400, "Una actividad no puede ser subproducto de sí misma.");
  }

  const { rows } = await pool.query<{ etapa: number; padreId: string | null }>(
    "SELECT etapa, padre_id AS \"padreId\" FROM edt_actividades WHERE id = $1 AND proyecto_id = $2",
    [padreId, proyectoId],
  );
  const padre = rows[0];
  if (!padre) throw new HttpError(400, "La actividad predecesora no existe en este proyecto.");
  if (padre.padreId) {
    throw new HttpError(400, "Un subproducto no puede tener subproductos propios.");
  }
  if (padre.etapa !== etapa) {
    throw new HttpError(400, "La actividad predecesora debe pertenecer a la misma etapa.");
  }

  if (propioId) {
    const { rows: hijos } = await pool.query("SELECT 1 FROM edt_actividades WHERE padre_id = $1 LIMIT 1", [
      propioId,
    ]);
    if (hijos[0]) {
      throw new HttpError(400, "Una actividad con subproductos no puede convertirse en subproducto.");
    }
  }
}

async function validarCambioEstado(fila: ActividadFila, estado: ActividadFila["estado"]): Promise<void> {
  if (estado === "Completado") {
    const { rows } = await pool.query<{ nombre: string }>(
      `SELECT COALESCE(NULLIF(actividad, ''), 'Sin nombre') AS nombre
         FROM edt_actividades
        WHERE padre_id = $1 AND estado <> 'Completado'
        ORDER BY orden`,
      [fila.id],
    );
    if (rows.length) {
      const pendientes = rows.map((hijo) => hijo.nombre).join(", ");
      throw new HttpError(
        400,
        `La actividad no puede completarse antes que sus subproductos: ${pendientes}.`,
      );
    }
    return;
  }

  if (!fila.padreId) return;

  const { rows } = await pool.query<{ estado: string; nombre: string }>(
    `SELECT estado, COALESCE(NULLIF(actividad, ''), 'Sin nombre') AS nombre
       FROM edt_actividades
      WHERE id = $1`,
    [fila.padreId],
  );
  if (rows[0]?.estado === "Completado") {
    throw new HttpError(
      400,
      `La actividad principal "${rows[0].nombre}" ya está completada. Reábrela antes de cambiar el estado de su subproducto.`,
    );
  }
}

async function listar(proyectoId: string) {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS}
       FROM edt_actividades
      WHERE proyecto_id = $1
      ORDER BY etapa, orden, creado_en`,
    [proyectoId],
  );
  return rows;
}

export const edt = Router();

edt.get(
  "/:proyectoId",
  ah(async (req, res) => {
    const proyecto = await proyectoDeRuta(z.string().trim().min(1).parse(req.params.proyectoId));
    const actividades = await listar(proyecto.id);
    res.json({ proyecto, actividades });
  }),
);

edt.post(
  "/:proyectoId",
  ah(async (req, res) => {
    const proyecto = await proyectoDeRuta(z.string().trim().min(1).parse(req.params.proyectoId));
    const datos = crearSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;

    if (datos.padreId) {
      await validarPadre(datos.padreId, proyecto.id, datos.etapa);
    }

    const responsable = await resolverResponsableEdt(
      datos.responsableId,
      datos.responsable,
      Object.prototype.hasOwnProperty.call(req.body, "responsableId"),
    );

    const { rows } = await pool.query(
      `INSERT INTO edt_actividades
         (proyecto_id, etapa, padre_id, actividad, responsable, responsable_id,
          fecha_cumplimiento, estado, orden)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
         (SELECT COALESCE(MAX(orden), 0) + 1 FROM edt_actividades WHERE proyecto_id = $1 AND etapa = $2))
       RETURNING ${CAMPOS}`,
      [
        proyecto.id,
        datos.etapa,
        datos.padreId ?? null,
        datos.nombre,
        responsable.nombre,
        responsable.id,
        datos.fechaCumplimiento ?? null,
        datos.estado,
      ],
    );
    const actividad = rows[0] as ActividadFila;

    await recalcularAvanceProyecto(pool, proyecto.id);

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Creación",
      entidad: "Actividad EDT",
      registro: proyecto.id,
      nuevo: `${datos.nombre || "Sin nombre"} · Etapa ${datos.etapa}`,
    });

    res.status(201).json({ actividad });
  }),
);

edt.patch(
  "/actividades/:id",
  ah(async (req, res) => {
    const id = z.string().uuid("Actividad inválida").parse(req.params.id);
    const actual = await actividadDeRuta(id);
    const datos = actualizarSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;

    const etapa = datos.etapa ?? actual.etapa;
    const padreId =
      datos.padreId === undefined ? actual.padreId : datos.padreId;

    if (padreId) {
      await validarPadre(padreId, actual.proyectoId, etapa, actual.id);
    }

    await validarCambioEstado(actual, datos.estado ?? actual.estado);

    const cambiaResponsable =
      Object.prototype.hasOwnProperty.call(req.body, "responsableId") ||
      Object.prototype.hasOwnProperty.call(req.body, "responsable");
    const responsable = cambiaResponsable
      ? await resolverResponsableEdt(
          datos.responsableId,
          datos.responsable,
          Object.prototype.hasOwnProperty.call(req.body, "responsableId"),
        )
      : { id: null, nombre: null };

    const { rows } = await pool.query(
      `UPDATE edt_actividades
          SET etapa = $2,
              padre_id = $3,
              actividad = COALESCE($4, actividad),
              responsable = CASE WHEN $5 THEN $6 ELSE responsable END,
              responsable_id = CASE WHEN $5 THEN $7 ELSE responsable_id END,
              fecha_cumplimiento = CASE WHEN $8 THEN $9::date ELSE fecha_cumplimiento END,
              estado = COALESCE($10, estado)
        WHERE id = $1
        RETURNING ${CAMPOS}`,
      [
        actual.id,
        etapa,
        padreId ?? null,
        datos.nombre,
        cambiaResponsable,
        responsable.nombre,
        responsable.id,
        Object.prototype.hasOwnProperty.call(req.body, "fechaCumplimiento"),
        datos.fechaCumplimiento ?? null,
        datos.estado ?? null,
      ],
    );
    const actualizada = rows[0] as ActividadFila;

    await recalcularAvanceProyecto(pool, actual.proyectoId);

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Actualización",
      entidad: "Actividad EDT",
      registro: actual.proyectoId,
      previo: `${actual.nombre || "Sin nombre"} · ${actual.estado}`,
      nuevo: `${actualizada.nombre || "Sin nombre"} · ${actualizada.estado}`,
    });

    res.json({ actividad: actualizada });
  }),
);

edt.delete(
  "/actividades/:id",
  ah(async (req, res) => {
    const id = z.string().uuid("Actividad inválida").parse(req.params.id);
    const actual = await actividadDeRuta(id);
    const usuario = res.locals.usuario as UsuarioSesion;

    await pool.query("DELETE FROM edt_actividades WHERE id = $1", [actual.id]);

    await recalcularAvanceProyecto(pool, actual.proyectoId);

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Eliminación",
      entidad: "Actividad EDT",
      registro: actual.proyectoId,
      previo: `${actual.nombre || "Sin nombre"} · Etapa ${actual.etapa}`,
    });

    res.json({ ok: true });
  }),
);

type HijoPlantilla = {
  nombre: string;
  responsable: string | null;
  fecha: string | null;
  estado: (typeof ESTADOS_EDT)[number];
};

type ItemPlantilla = HijoPlantilla & {
  etapa: 1 | 2 | 3;
  hijos: HijoPlantilla[];
};

// Etapa 2 transcrita del SAC-PI031 v1.0; las etapas 1 y 3 son la base editable
// propuesta para interventoría y consultoría, sin responsables ni fechas asignadas.
const PLANTILLA: ItemPlantilla[] = [
  {
    etapa: 1,
    nombre: "Revisión de información básica, estudios y diseños",
    responsable: null,
    fecha: null,
    estado: "No realizado",
    hijos: [
      {
        nombre: "Consolidar observaciones y solicitudes de ajuste",
        responsable: null,
        fecha: null,
        estado: "No realizado",
      },
    ],
  },
  {
    etapa: 1,
    nombre: "Acta de inicio y socialización del contrato",
    responsable: null,
    fecha: null,
    estado: "No realizado",
    hijos: [],
  },
  {
    etapa: 1,
    nombre: "Planificación de la interventoría",
    responsable: null,
    fecha: null,
    estado: "No realizado",
    hijos: [
      {
        nombre: "Cronograma detallado y matriz de riesgos",
        responsable: null,
        fecha: null,
        estado: "No realizado",
      },
    ],
  },
  {
    etapa: 1,
    nombre: "Informe preconstructivo inicial",
    responsable: null,
    fecha: null,
    estado: "No realizado",
    hijos: [],
  },
  {
    etapa: 2,
    nombre: "Informe mensual preconstructivo",
    responsable: "Carlos Montenegro",
    fecha: "2026-10-31",
    estado: "En ejecución",
    hijos: [
      {
        nombre: "Llenar formato de planillas y resumen general del informe preconstructivo",
        responsable: null,
        fecha: "2026-11-03",
        estado: "En ejecución",
      },
    ],
  },
  {
    etapa: 2,
    nombre: "Informe mensual constructivo 2",
    responsable: "Carlos Montenegro",
    fecha: "2026-11-04",
    estado: "En ejecución",
    hijos: [],
  },
  {
    etapa: 2,
    nombre: "Informes semanales",
    responsable: null,
    fecha: null,
    estado: "No realizado",
    hijos: [
      {
        nombre: "Producto no. 5",
        responsable: "Carlos Montenegro",
        fecha: "2026-11-01",
        estado: "Completado",
      },
    ],
  },
  {
    etapa: 2,
    nombre: "Actas de reunión",
    responsable: "Carlos Montenegro",
    fecha: null,
    estado: "No realizado",
    hijos: [
      { nombre: "Acta 15", responsable: null, fecha: "2026-10-27", estado: "No realizado" },
      { nombre: "Acta 16", responsable: null, fecha: "2026-11-03", estado: "No realizado" },
    ],
  },
  {
    etapa: 3,
    nombre: "Informe final de interventoría",
    responsable: null,
    fecha: null,
    estado: "No realizado",
    hijos: [],
  },
  {
    etapa: 3,
    nombre: "Acta de liquidación y recibo a satisfacción",
    responsable: null,
    fecha: null,
    estado: "No realizado",
    hijos: [],
  },
  {
    etapa: 3,
    nombre: "Cierre documental y financiero",
    responsable: null,
    fecha: null,
    estado: "No realizado",
    hijos: [
      {
        nombre: "Entrega del expediente documental",
        responsable: null,
        fecha: null,
        estado: "No realizado",
      },
      {
        nombre: "Paz y salvo y garantías",
        responsable: null,
        fecha: null,
        estado: "No realizado",
      },
    ],
  },
  {
    etapa: 3,
    nombre: "Lecciones aprendidas y retroalimentación",
    responsable: null,
    fecha: null,
    estado: "No realizado",
    hijos: [],
  },
];

async function siguienteOrden(db: Db, proyectoId: string, etapa: number): Promise<number> {
  const { rows } = await db.query<{ orden: number }>(
    `SELECT COALESCE(MAX(orden), 0) + 1 AS orden
       FROM edt_actividades
      WHERE proyecto_id = $1 AND etapa = $2`,
    [proyectoId, etapa],
  );
  return rows[0].orden;
}

async function sembrarPlantilla(db: Db, proyectoId: string): Promise<number> {
  let creados = 0;

  for (const item of PLANTILLA) {
    const { rows: existentes } = await db.query<{ id: string }>(
      `SELECT id FROM edt_actividades
        WHERE proyecto_id = $1 AND etapa = $2 AND padre_id IS NULL
          AND lower(btrim(actividad)) = lower(btrim($3))
        LIMIT 1`,
      [proyectoId, item.etapa, item.nombre],
    );

    let padreId = existentes[0]?.id;
    if (!padreId) {
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO edt_actividades
           (proyecto_id, etapa, actividad, responsable, fecha_cumplimiento, estado, orden)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          proyectoId,
          item.etapa,
          item.nombre,
          item.responsable,
          item.fecha,
          item.estado,
          await siguienteOrden(db, proyectoId, item.etapa),
        ],
      );
      padreId = rows[0].id;
      creados += 1;
    }

    for (const hijo of item.hijos) {
      const { rows: hijosExistentes } = await db.query<{ id: string }>(
        `SELECT id FROM edt_actividades
          WHERE proyecto_id = $1 AND padre_id = $2
            AND lower(btrim(actividad)) = lower(btrim($3))
          LIMIT 1`,
        [proyectoId, padreId, hijo.nombre],
      );
      if (hijosExistentes[0]) continue;

      await db.query(
        `INSERT INTO edt_actividades
           (proyecto_id, etapa, padre_id, actividad, responsable, fecha_cumplimiento, estado, orden)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          proyectoId,
          item.etapa,
          padreId,
          hijo.nombre,
          hijo.responsable,
          hijo.fecha,
          hijo.estado,
          await siguienteOrden(db, proyectoId, item.etapa),
        ],
      );
      creados += 1;
    }
  }

  return creados;
}

edt.post(
  "/:proyectoId/plantilla",
  ah(async (req, res) => {
    const proyecto = await proyectoDeRuta(z.string().trim().min(1).parse(req.params.proyectoId));
    const usuario = res.locals.usuario as UsuarioSesion;

    const creados = await withTx((db) => sembrarPlantilla(db, proyecto.id));
    await recalcularAvanceProyecto(pool, proyecto.id);

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Creación",
      entidad: "Actividad EDT",
      registro: proyecto.id,
      nuevo: `Plantilla SAC-PI031 · ${creados} actividad(es) nueva(s)`,
    });

    res.status(creados > 0 ? 201 : 200).json({
      actividades: await listar(proyecto.id),
      creados,
    });
  }),
);
