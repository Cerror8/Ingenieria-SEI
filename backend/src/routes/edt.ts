import { Router } from "express";
import { z } from "zod";
import { registrarAuditoria } from "../audit.js";
import type { UsuarioSesion } from "../auth/session.js";
import { pool, withTx } from "../db.js";
import { ah, HttpError } from "../http.js";

export const ESTADOS_EDT = ["Completado", "En ejecución", "No realizado"] as const;

const CAMPOS = `
  id, proyecto_id AS "proyectoId", etapa, padre_id AS "padreId", actividad AS "nombre",
  responsable, fecha_cumplimiento AS "fechaCumplimiento", estado, orden
`;

const crearSchema = z.object({
  etapa: z.coerce.number().int().min(1).max(3),
  padreId: z.string().uuid("La actividad predecesora es inválida").nullable().optional(),
  nombre: z.string().trim().max(300).default(""),
  responsable: z.string().trim().max(120).nullable().optional(),
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

    const { rows } = await pool.query(
      `INSERT INTO edt_actividades
         (proyecto_id, etapa, padre_id, actividad, responsable, fecha_cumplimiento, estado, orden)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
         (SELECT COALESCE(MAX(orden), 0) + 1 FROM edt_actividades WHERE proyecto_id = $1 AND etapa = $2))
       RETURNING ${CAMPOS}`,
      [
        proyecto.id,
        datos.etapa,
        datos.padreId ?? null,
        datos.nombre,
        datos.responsable || null,
        datos.fechaCumplimiento ?? null,
        datos.estado,
      ],
    );
    const actividad = rows[0] as ActividadFila;

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

    const { rows } = await pool.query(
      `UPDATE edt_actividades
          SET etapa = $2,
              padre_id = $3,
              actividad = COALESCE($4, actividad),
              responsable = CASE WHEN $5 THEN $6 ELSE responsable END,
              fecha_cumplimiento = CASE WHEN $7 THEN $8::date ELSE fecha_cumplimiento END,
              estado = COALESCE($9, estado)
        WHERE id = $1
        RETURNING ${CAMPOS}`,
      [
        actual.id,
        etapa,
        padreId ?? null,
        datos.nombre,
        Object.prototype.hasOwnProperty.call(req.body, "responsable"),
        datos.responsable || null,
        Object.prototype.hasOwnProperty.call(req.body, "fechaCumplimiento"),
        datos.fechaCumplimiento ?? null,
        datos.estado ?? null,
      ],
    );
    const actualizada = rows[0] as ActividadFila;

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

type ItemPlantilla = {
  nombre: string;
  responsable: string | null;
  fecha: string | null;
  estado: (typeof ESTADOS_EDT)[number];
  hijos: Array<Omit<ItemPlantilla, "hijos">>;
};

// Actividades diligenciadas en SAC-PI031 v1.0 (etapa constructiva).
const PLANTILLA: ItemPlantilla[] = [
  {
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
    nombre: "Informe mensual constructivo 2",
    responsable: "Carlos Montenegro",
    fecha: "2026-11-04",
    estado: "En ejecución",
    hijos: [],
  },
  {
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
    nombre: "Actas de reunión",
    responsable: "Carlos Montenegro",
    fecha: null,
    estado: "No realizado",
    hijos: [
      { nombre: "Acta 15", responsable: null, fecha: "2026-10-27", estado: "No realizado" },
      { nombre: "Acta 16", responsable: null, fecha: "2026-11-03", estado: "No realizado" },
    ],
  },
];

edt.post(
  "/:proyectoId/plantilla",
  ah(async (req, res) => {
    const proyecto = await proyectoDeRuta(z.string().trim().min(1).parse(req.params.proyectoId));
    const usuario = res.locals.usuario as UsuarioSesion;

    await withTx(async (db) => {
      const { rows: existentes } = await db.query(
        "SELECT 1 FROM edt_actividades WHERE proyecto_id = $1 LIMIT 1",
        [proyecto.id],
      );
      if (existentes[0]) {
        throw new HttpError(
          409,
          "El checklist ya tiene actividades. Elimínalas antes de volver a cargar la plantilla.",
        );
      }

      let orden = 0;

      for (const item of PLANTILLA) {
        orden += 1;
        const { rows } = await db.query<{ id: string }>(
          `INSERT INTO edt_actividades
             (proyecto_id, etapa, actividad, responsable, fecha_cumplimiento, estado, orden)
           VALUES ($1, 2, $2, $3, $4, $5, $6)
           RETURNING id`,
          [proyecto.id, item.nombre, item.responsable, item.fecha, item.estado, orden],
        );
        const padreId = rows[0].id;

        for (const hijo of item.hijos) {
          orden += 1;
          await db.query(
            `INSERT INTO edt_actividades
               (proyecto_id, etapa, padre_id, actividad, responsable, fecha_cumplimiento, estado, orden)
             VALUES ($1, 2, $2, $3, $4, $5, $6, $7)`,
            [
              proyecto.id,
              padreId,
              hijo.nombre,
              hijo.responsable,
              hijo.fecha,
              hijo.estado,
              orden,
            ],
          );
        }
      }
    });

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Creación",
      entidad: "Actividad EDT",
      registro: proyecto.id,
      nuevo: "Plantilla SAC-PI031 cargada",
    });

    res.status(201).json({ actividades: await listar(proyecto.id) });
  }),
);
