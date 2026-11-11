import { Router } from "express";
import { z } from "zod";
import { registrarAuditoria } from "../audit.js";
import type { UsuarioSesion } from "../auth/session.js";
import { pool, type Db } from "../db.js";
import { ah, HttpError } from "../http.js";
import { recalcularAvanceProyecto } from "../lib/avance.js";
import {
  TIPOS_CONTRATO,
  asegurarFasesProyecto,
  crearTableroFase,
  crearTareaActividad,
  plantillaDe,
  sembrarChecklist,
  sincronizarTareasDeActividad,
  type FaseEdt,
  type TipoContrato,
} from "../lib/edtFases.js";
import { estructuraPorId, normalizarCarpeta } from "../lib/estructura.js";

export const ESTADOS_EDT = ["Completado", "En ejecución", "No realizado"] as const;
export const TIPOS_ACTIVIDAD_EDT = ["Actividad", "Documento", "Acta"] as const;

const CAMPOS = `
  a.id, a.proyecto_id AS "proyectoId", a.fase_id AS "faseId", a.etapa,
  a.padre_id AS "padreId", a.actividad AS "nombre", a.descripcion,
  a.tipo, a.plantilla_clave AS "plantillaClave", a.prioridad,
  a.requiere_documento AS "requiereDocumento", a.carpeta,
  a.responsable, a.responsable_id AS "responsableId",
  a.fecha_cumplimiento AS "fechaCumplimiento", a.estado, a.orden,
  (SELECT COUNT(*)::int FROM documentos d WHERE d.edt_actividad_id = a.id) AS documentos,
  (SELECT COUNT(*)::int FROM tareas_tablero t WHERE t.edt_actividad_id = a.id) AS tareas
`;

const CAMPOS_REQUISITOS = `
  COALESCE((
    SELECT json_agg(json_build_object(
             'id', r.id,
             'nombre', r.actividad,
             'estado', r.estado,
             'tipo', r.tipo,
             'tieneDocumento', EXISTS(
               SELECT 1 FROM documentos d WHERE d.edt_actividad_id = r.id
             )
           ) ORDER BY r.orden)
      FROM edt_requisitos q
      JOIN edt_actividades r ON r.id = q.requisito_id
     WHERE q.actividad_id = a.id
  ), '[]'::json) AS requisitos
`;

const fechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato AAAA-MM-DD")
  .nullable()
  .optional();

const baseActividad = {
  nombre: z.string().trim().max(300).default(""),
  descripcion: z.string().trim().max(2000).optional().default(""),
  tipo: z.enum(["Actividad", "Documento", "Acta"]).optional().default("Actividad"),
  prioridad: z.enum(["Alta", "Media", "Baja"]).optional().default("Alta"),
  requiereDocumento: z.boolean().optional(),
  carpeta: z.string().trim().max(300).nullable().optional(),
  responsable: z.string().trim().max(120).nullable().optional(),
  responsableId: z.string().uuid("Responsable inválido").nullable().optional(),
  fechaCumplimiento: fechaSchema,
  estado: z.enum(["Completado", "En ejecución", "No realizado"]).optional().default("No realizado"),
  requisitoIds: z.array(z.string().uuid("Requisito inválido")).max(20).optional(),
};

const crearSchema = z.object({
  ...baseActividad,
  faseId: z.string().uuid("La fase es inválida"),
});

const actualizarSchema = z
  .object({
    ...baseActividad,
    faseId: z.string().uuid("La fase es inválida").optional(),
    padreId: z.string().uuid("El predecesor es inválido").nullable().optional(),
  })
  .partial()
  .strict();

const faseSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre de la fase es obligatorio").max(120),
  descripcion: z.string().trim().max(500).optional().default(""),
  dependeDeFaseId: z.string().uuid("La fase anterior es inválida").nullable().optional(),
});

type ProyectoRef = {
  id: string;
  nombre: string;
  liderId: string | null;
  estructura: string | null;
  tipoContrato: TipoContrato;
};

type ActividadFila = {
  id: string;
  proyectoId: string;
  faseId: string | null;
  etapa: number;
  padreId: string | null;
  nombre: string;
  descripcion: string;
  tipo: (typeof TIPOS_ACTIVIDAD_EDT)[number];
  prioridad: string;
  requiereDocumento: boolean;
  carpeta: string | null;
  responsable: string | null;
  responsableId: string | null;
  fechaCumplimiento: string | null;
  estado: (typeof ESTADOS_EDT)[number];
  orden: number;
  documentos: number;
  tareas: number;
  requisitos: Array<{
    id: string;
    nombre: string;
    estado: string;
    tipo: string;
    tieneDocumento: boolean;
  }>;
};

async function proyectoDeRuta(id: string): Promise<ProyectoRef> {
  const { rows } = await pool.query<ProyectoRef>(
    `SELECT id, nombre, lider_id AS "liderId", estructura,
            COALESCE(tipo_contrato, 'Interventoría') AS "tipoContrato"
       FROM proyectos WHERE id = $1`,
    [id],
  );
  if (!rows[0]) throw new HttpError(404, "Proyecto no encontrado");
  return rows[0];
}

async function faseDeRuta(id: string): Promise<FaseEdt> {
  const { rows } = await pool.query<FaseEdt>(
    `SELECT id, proyecto_id AS "proyectoId", nombre, descripcion, clave, orden,
            es_principal AS "esPrincipal", depende_de_fase_id AS "dependeDeFaseId"
       FROM edt_fases WHERE id = $1`,
    [id],
  );
  if (!rows[0]) throw new HttpError(404, "Fase del EDT no encontrada");
  return rows[0];
}

async function actividadDeRuta(id: string): Promise<ActividadFila> {
  const { rows } = await pool.query<ActividadFila>(
    `SELECT ${CAMPOS}, ${CAMPOS_REQUISITOS}
       FROM edt_actividades a WHERE a.id = $1`,
    [id],
  );
  if (!rows[0]) throw new HttpError(404, "Actividad del EDT no encontrada");
  return rows[0];
}

async function resolverResponsable(
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

function validarCarpeta(carpeta: string | null | undefined, estructuraId: string | null): string | null {
  if (carpeta == null || carpeta === "") return null;
  const ruta = carpeta.trim().replaceAll("\\", "/");
  const normalizada = normalizarCarpeta(ruta);
  if (!normalizada || normalizada !== ruta) {
    throw new HttpError(400, `Carpeta no válida: ${ruta}`);
  }
  const estructura = estructuraId ? estructuraPorId(estructuraId) : null;
  if (!estructura) {
    throw new HttpError(400, "El proyecto no tiene una estructura documental definida.");
  }
  const valida = estructura.carpetas.find(
    (permitida) => permitida.toLowerCase() === normalizada.toLowerCase(),
  );
  if (!valida) {
    throw new HttpError(400, `La carpeta no pertenece a la estructura del proyecto: ${normalizada}`);
  }
  return valida;
}

async function validarFaseDeProyecto(faseId: string, proyectoId: string): Promise<FaseEdt> {
  const fase = await faseDeRuta(faseId);
  if (fase.proyectoId !== proyectoId) {
    throw new HttpError(400, "La fase no pertenece al proyecto.");
  }
  return fase;
}

async function validarRequisitos(actividadId: string): Promise<void> {
  const { rows } = await pool.query<{ nombre: string; estado: string; requiere: boolean; docs: number }>(
    `SELECT r.actividad AS nombre, r.estado, r.requiere_documento AS requiere,
            (SELECT COUNT(*)::int FROM documentos d WHERE d.edt_actividad_id = r.id) AS docs
       FROM edt_requisitos q
       JOIN edt_actividades r ON r.id = q.requisito_id
      WHERE q.actividad_id = $1
      ORDER BY r.orden`,
    [actividadId],
  );
  const pendientes = rows.filter(
    (fila) => fila.estado !== "Completado" || (fila.requiere && fila.docs === 0),
  );
  if (pendientes.length) {
    const nombres = pendientes.map((fila) => fila.nombre || "Sin nombre").join(", ");
    throw new HttpError(
      400,
      `Antes de completar esta actividad deben estar completos y con documento: ${nombres}.`,
    );
  }
}

async function validarDocumentoObligatorio(actividadId: string, requiere: boolean): Promise<void> {
  if (!requiere) return;
  const { rows } = await pool.query<{ total: number }>(
    "SELECT COUNT(*)::int AS total FROM documentos WHERE edt_actividad_id = $1",
    [actividadId],
  );
  if (!rows[0]?.total) {
    throw new HttpError(
      400,
      "Esta actividad exige un documento. Carga el archivo antes de marcarla como completada.",
    );
  }
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
    `SELECT etapa, padre_id AS "padreId" FROM edt_actividades
      WHERE id = $1 AND proyecto_id = $2`,
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
    const { rows: hijos } = await pool.query(
      "SELECT 1 FROM edt_actividades WHERE padre_id = $1 LIMIT 1",
      [propioId],
    );
    if (hijos[0]) {
      throw new HttpError(400, "Una actividad con subproductos no puede convertirse en subproducto.");
    }
  }
}

async function validarCambioEstado(
  actividad: ActividadFila,
  estado: (typeof ESTADOS_EDT)[number],
  requiereDocumento: boolean,
): Promise<void> {
  if (estado === "Completado") {
    const { rows } = await pool.query<{ nombre: string }>(
      `SELECT COALESCE(NULLIF(actividad, ''), 'Sin nombre') AS nombre
         FROM edt_actividades
        WHERE padre_id = $1 AND estado <> 'Completado'
        ORDER BY orden`,
      [actividad.id],
    );
    if (rows.length) {
      const pendientes = rows.map((hijo) => hijo.nombre).join(", ");
      throw new HttpError(
        400,
        `La actividad no puede completarse antes que sus subproductos: ${pendientes}.`,
      );
    }
    await validarRequisitos(actividad.id);
    await validarDocumentoObligatorio(actividad.id, requiereDocumento);
    return;
  }

  if (!actividad.padreId) return;
  const { rows } = await pool.query<{ estado: string; nombre: string }>(
    `SELECT estado, COALESCE(NULLIF(actividad, ''), 'Sin nombre') AS nombre
       FROM edt_actividades WHERE id = $1`,
    [actividad.padreId],
  );
  if (rows[0]?.estado === "Completado") {
    throw new HttpError(
      400,
      `La actividad principal "${rows[0].nombre}" ya está completada. Reábrala antes de cambiar el estado de su subproducto.`,
    );
  }
}

async function reemplazarRequisitos(
  db: Db | typeof pool,
  actividadId: string,
  proyectoId: string,
  requisitoIds: string[],
): Promise<void> {
  const unicos = [...new Set(requisitoIds)].filter((id) => id !== actividadId);
  if (unicos.length) {
    const { rows } = await db.query<{ total: number }>(
      "SELECT COUNT(*)::int AS total FROM edt_actividades WHERE proyecto_id = $1 AND id = ANY($2::uuid[])",
      [proyectoId, unicos],
    );
    if (rows[0].total !== unicos.length) {
      throw new HttpError(400, "Alguno de los requisitos no pertenece al proyecto.");
    }
  }
  await db.query("DELETE FROM edt_requisitos WHERE actividad_id = $1", [actividadId]);
  for (const requisitoId of unicos) {
    await db.query(
      "INSERT INTO edt_requisitos (actividad_id, requisito_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [actividadId, requisitoId],
    );
  }
}

async function listarFases(proyecto: ProyectoRef): Promise<FaseEdt[]> {
  return asegurarFasesProyecto(pool, proyecto.id, proyecto.tipoContrato);
}

async function listar(proyectoId: string): Promise<ActividadFila[]> {
  const { rows } = await pool.query<ActividadFila>(
    `SELECT ${CAMPOS}, ${CAMPOS_REQUISITOS}
       FROM edt_actividades a
      WHERE a.proyecto_id = $1
      ORDER BY a.etapa, a.orden, a.creado_en`,
    [proyectoId],
  );
  return rows;
}

async function responderEdt(proyecto: ProyectoRef) {
  const fases = await listarFases(proyecto);
  return {
    proyecto: {
      id: proyecto.id,
      nombre: proyecto.nombre,
      tipoContrato: proyecto.tipoContrato,
      estructura: proyecto.estructura,
    },
    fases,
    actividades: await listar(proyecto.id),
  };
}

export const edt = Router();

edt.get(
  "/:proyectoId",
  ah(async (req, res) => {
    const proyecto = await proyectoDeRuta(z.string().trim().min(1).parse(req.params.proyectoId));
    res.json(await responderEdt(proyecto));
  }),
);

edt.post(
  "/:proyectoId/fases",
  ah(async (req, res) => {
    const proyecto = await proyectoDeRuta(z.string().trim().min(1).parse(req.params.proyectoId));
    const datos = faseSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;
    const fases = await asegurarFasesProyecto(pool, proyecto.id, proyecto.tipoContrato);
    const anterior =
      datos.dependeDeFaseId ?? fases.at(-1)?.id ?? null;
    if (anterior) await validarFaseDeProyecto(anterior, proyecto.id);

    const { rows } = await pool.query<FaseEdt>(
      `INSERT INTO edt_fases
         (proyecto_id, nombre, descripcion, orden, es_principal, depende_de_fase_id)
       VALUES ($1, $2, $3,
         COALESCE((SELECT MAX(orden) + 1 FROM edt_fases WHERE proyecto_id = $1), 1),
         false, $4)
       RETURNING id, proyecto_id AS "proyectoId", nombre, descripcion, clave, orden,
                 es_principal AS "esPrincipal", depende_de_fase_id AS "dependeDeFaseId"`,
      [proyecto.id, datos.nombre, datos.descripcion, anterior],
    );
    await crearTableroFase(pool, proyecto, rows[0]);

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Creación",
      entidad: "Fase EDT",
      registro: proyecto.id,
      nuevo: rows[0].nombre,
    });

    res.status(201).json({ fase: rows[0] });
  }),
);

edt.patch(
  "/fases/:id",
  ah(async (req, res) => {
    const id = z.string().uuid("Fase inválida").parse(req.params.id);
    const actual = await faseDeRuta(id);
    const datos = faseSchema.partial().parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;

    if (datos.dependeDeFaseId) {
      if (datos.dependeDeFaseId === actual.id) {
        throw new HttpError(400, "Una fase no puede depender de sí misma.");
      }
      await validarFaseDeProyecto(datos.dependeDeFaseId, actual.proyectoId);
    }

    const { rows } = await pool.query<FaseEdt>(
      `UPDATE edt_fases
          SET nombre = COALESCE($2, nombre),
              descripcion = COALESCE($3, descripcion),
              depende_de_fase_id = CASE WHEN $4 THEN $5 ELSE depende_de_fase_id END
        WHERE id = $1
        RETURNING id, proyecto_id AS "proyectoId", nombre, descripcion, clave, orden,
                  es_principal AS "esPrincipal", depende_de_fase_id AS "dependeDeFaseId"`,
      [
        actual.id,
        datos.nombre ?? null,
        datos.descripcion ?? null,
        datos.dependeDeFaseId !== undefined,
        datos.dependeDeFaseId ?? null,
      ],
    );

    await pool.query(
      "UPDATE tableros SET nombre = $2 WHERE fase_id = $1",
      [actual.id, `F${rows[0].orden} · ${rows[0].nombre}`.slice(0, 120)],
    );

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Actualización",
      entidad: "Fase EDT",
      registro: actual.proyectoId,
      previo: actual.nombre,
      nuevo: rows[0].nombre,
    });

    res.json({ fase: rows[0] });
  }),
);

edt.delete(
  "/fases/:id",
  ah(async (req, res) => {
    const id = z.string().uuid("Fase inválida").parse(req.params.id);
    const actual = await faseDeRuta(id);
    const usuario = res.locals.usuario as UsuarioSesion;

    if (actual.esPrincipal) {
      throw new HttpError(400, "Las tres fases principales no se pueden eliminar; puedes renombrarlas.");
    }

    await pool.query("DELETE FROM edt_fases WHERE id = $1", [actual.id]);
    await recalcularAvanceProyecto(pool, actual.proyectoId);

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Eliminación",
      entidad: "Fase EDT",
      registro: actual.proyectoId,
      previo: actual.nombre,
    });

    res.json({ ok: true });
  }),
);

edt.post(
  "/:proyectoId",
  ah(async (req, res) => {
    const proyecto = await proyectoDeRuta(z.string().trim().min(1).parse(req.params.proyectoId));
    const datos = crearSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;
    const fase = await validarFaseDeProyecto(datos.faseId, proyecto.id);

    const responsable = await resolverResponsable(
      datos.responsableId,
      datos.responsable,
      Object.prototype.hasOwnProperty.call(req.body, "responsableId"),
    );
    const requiereDocumento =
      datos.requiereDocumento ?? (datos.tipo === "Documento" || datos.tipo === "Acta");
    const carpeta = validarCarpeta(datos.carpeta, proyecto.estructura);

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO edt_actividades
         (proyecto_id, fase_id, etapa, actividad, descripcion, tipo, prioridad,
          requiere_documento, carpeta, responsable, responsable_id, fecha_cumplimiento,
          estado, orden)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::date, $13,
         COALESCE((SELECT MAX(orden) + 1 FROM edt_actividades WHERE fase_id = $2), 1))
       RETURNING id`,
      [
        proyecto.id,
        fase.id,
        Math.min(3, fase.orden),
        datos.nombre,
        datos.descripcion,
        datos.tipo,
        datos.prioridad,
        requiereDocumento,
        carpeta,
        responsable.nombre,
        responsable.id,
        datos.fechaCumplimiento ?? null,
        datos.estado,
      ],
    );
    const actividad = await actividadDeRuta(rows[0].id);

    if (datos.requisitoIds?.length) {
      await reemplazarRequisitos(pool, actividad.id, proyecto.id, datos.requisitoIds);
    }

    await crearTareaActividad(pool, proyecto, fase, actividad);
    await recalcularAvanceProyecto(pool, proyecto.id);

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Creación",
      entidad: "Actividad EDT",
      registro: proyecto.id,
      nuevo: `${datos.nombre || "Sin nombre"} · ${fase.nombre}`,
    });

    res.status(201).json({ actividad, fase });
  }),
);

edt.patch(
  "/actividades/:id",
  ah(async (req, res) => {
    const id = z.string().uuid("Actividad inválida").parse(req.params.id);
    const actual = await actividadDeRuta(id);
    const datos = actualizarSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;
    const proyecto = await proyectoDeRuta(actual.proyectoId);

    const fase = datos.faseId
      ? await validarFaseDeProyecto(datos.faseId, proyecto.id)
      : actual.faseId
        ? await faseDeRuta(actual.faseId)
        : await asegurarFasesProyecto(pool, proyecto.id, proyecto.tipoContrato).then(
            (fases) => fases[0],
          );
    const etapa = datos.faseId ? Math.min(3, fase.orden) : actual.etapa;
    const padreId = datos.padreId === undefined ? actual.padreId : datos.padreId;
    if (padreId) await validarPadre(padreId, actual.proyectoId, etapa, actual.id);

    const requiereDocumento =
      datos.requiereDocumento ??
      (datos.tipo
        ? datos.tipo === "Documento" || datos.tipo === "Acta"
        : actual.requiereDocumento);
    const estado = datos.estado ?? actual.estado;
    await validarCambioEstado(actual, estado, requiereDocumento);

    const cambiaResponsable =
      Object.prototype.hasOwnProperty.call(req.body, "responsableId") ||
      Object.prototype.hasOwnProperty.call(req.body, "responsable");
    const responsable = cambiaResponsable
      ? await resolverResponsable(
          datos.responsableId,
          datos.responsable,
          Object.prototype.hasOwnProperty.call(req.body, "responsableId"),
        )
      : { id: null, nombre: null };
    const carpeta =
      datos.carpeta !== undefined ? validarCarpeta(datos.carpeta, proyecto.estructura) : undefined;

    const { rows } = await pool.query<{ id: string }>(
      `UPDATE edt_actividades
          SET fase_id = $2,
              etapa = $3,
              padre_id = $4,
              actividad = COALESCE($5, actividad),
              descripcion = COALESCE($6, descripcion),
              tipo = COALESCE($7, tipo),
              prioridad = COALESCE($8, prioridad),
              requiere_documento = CASE WHEN $9 THEN $10 ELSE requiere_documento END,
              carpeta = CASE WHEN $11 THEN $12 ELSE carpeta END,
              responsable = CASE WHEN $13 THEN $14 ELSE responsable END,
              responsable_id = CASE WHEN $13 THEN $15 ELSE responsable_id END,
              fecha_cumplimiento = CASE WHEN $16 THEN $17::date ELSE fecha_cumplimiento END,
              estado = COALESCE($18, estado)
        WHERE id = $1
        RETURNING id`,
      [
        actual.id,
        fase.id,
        etapa,
        padreId ?? null,
        datos.nombre,
        datos.descripcion,
        datos.tipo,
        datos.prioridad,
        datos.requiereDocumento !== undefined,
        requiereDocumento,
        carpeta !== undefined,
        carpeta ?? null,
        cambiaResponsable,
        responsable.nombre,
        responsable.id,
        Object.prototype.hasOwnProperty.call(req.body, "fechaCumplimiento"),
        datos.fechaCumplimiento ?? null,
        datos.estado ?? null,
      ],
    );

    if (datos.requisitoIds !== undefined) {
      await reemplazarRequisitos(pool, actual.id, proyecto.id, datos.requisitoIds);
    }

    await sincronizarTareasDeActividad(pool, actual.id);
    await recalcularAvanceProyecto(pool, actual.proyectoId);

    const actualizada = await actividadDeRuta(rows[0].id);
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

    await pool.query("DELETE FROM tareas_tablero WHERE edt_actividad_id = $1", [actual.id]);
    await pool.query("DELETE FROM edt_actividades WHERE id = $1", [actual.id]);
    await recalcularAvanceProyecto(pool, actual.proyectoId);

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Eliminación",
      entidad: "Actividad EDT",
      registro: actual.proyectoId,
      previo: `${actual.nombre || "Sin nombre"} · ${actual.estado}`,
    });

    res.json({ ok: true });
  }),
);

edt.post(
  "/:proyectoId/plantilla",
  ah(async (req, res) => {
    const proyecto = await proyectoDeRuta(z.string().trim().min(1).parse(req.params.proyectoId));
    const usuario = res.locals.usuario as UsuarioSesion;
    const tipo = TIPOS_CONTRATO.includes(proyecto.tipoContrato)
      ? proyecto.tipoContrato
      : "Interventoría";

    const resumen = await sembrarChecklist(pool, proyecto.id, tipo);
    await recalcularAvanceProyecto(pool, proyecto.id);

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Creación",
      entidad: "Actividad EDT",
      registro: proyecto.id,
      nuevo: `Checklist ${tipo} · ${resumen.actividadesCreadas} actividad(es) nueva(s)`,
    });

    const edtActual = await responderEdt(proyecto);
    res.status(resumen.actividadesCreadas > 0 ? 201 : 200).json({
      ...edtActual,
      plantilla: tipo,
      fasesPlantilla: plantillaDe(tipo).length,
      creados: resumen.actividadesCreadas,
      tablerosCreados: resumen.tablerosCreados,
      tareasCreadas: resumen.tareasCreadas,
    });
  }),
);
