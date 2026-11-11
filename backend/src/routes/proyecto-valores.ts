import { Router } from "express";
import { z } from "zod";
import { registrarAuditoria } from "../audit.js";
import type { UsuarioSesion } from "../auth/session.js";
import { pool, withTx } from "../db.js";
import { ah, HttpError } from "../http.js";

export const CATEGORIAS_VALOR = ["Material", "Instrumento", "Otro"] as const;

const CAMPOS = `
  id, proyecto_id AS "proyectoId", valor_id AS "valorId", tabla_id AS "tablaId",
  fila_indice AS "filaIndice", nombre, categoria, unidad,
  cantidad::float AS cantidad, valor_unitario AS "valorUnitario",
  valor_total AS "valorTotal", tipo_proyecto AS "tipoProyecto", origen,
  creado_por AS "creadoPor", creado_en AS "creadoEn"
`;

type ProyectoRef = { id: string; nombre: string; linea: string };

async function proyectoDeRuta(id: string): Promise<ProyectoRef> {
  const { rows } = await pool.query<ProyectoRef>(
    "SELECT id, nombre, linea FROM proyectos WHERE id = $1",
    [id],
  );
  if (!rows[0]) throw new HttpError(404, "Proyecto no encontrado");
  return rows[0];
}

// El tipo vacío aplica a cualquier proyecto; si tiene valor debe coincidir con la línea.
function tipoDeItem(
  item: { nombre: string; tipoProyecto?: string },
  proyecto: ProyectoRef,
): string {
  const tipo = item.tipoProyecto === undefined ? proyecto.linea.trim() : item.tipoProyecto.trim();
  if (tipo && tipo.toLowerCase() !== proyecto.linea.trim().toLowerCase()) {
    throw new HttpError(
      400,
      `El valor "${item.nombre}" está marcado para el tipo "${tipo}" y el proyecto es de tipo "${proyecto.linea}".`,
    );
  }
  return tipo;
}

async function resumenProyecto(proyecto: ProyectoRef) {
  const { rows } = await pool.query<{
    categoria: string;
    items: number;
    total: number;
  }>(
    `SELECT categoria, count(*)::int AS items, COALESCE(sum(valor_total), 0)::bigint AS total
       FROM proyecto_valores
      WHERE proyecto_id = $1
        AND (tipo_proyecto = '' OR lower(btrim(tipo_proyecto)) = lower(btrim($2)))
      GROUP BY categoria`,
    [proyecto.id, proyecto.linea],
  );

  const porCategoria: Record<string, { items: number; total: number }> = {
    Material: { items: 0, total: 0 },
    Instrumento: { items: 0, total: 0 },
    Otro: { items: 0, total: 0 },
  };
  let total = 0;
  for (const fila of rows) {
    porCategoria[fila.categoria] = { items: fila.items, total: fila.total };
    total += fila.total;
  }

  const { rows: proyectoRows } = await pool.query<{ presupuesto: number }>(
    "SELECT presupuesto FROM proyectos WHERE id = $1",
    [proyecto.id],
  );
  const presupuesto = proyectoRows[0]?.presupuesto ?? 0;

  return {
    total,
    porCategoria,
    presupuesto,
    diferencia: presupuesto - total,
  };
}

async function listar(proyecto: ProyectoRef) {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS}
       FROM proyecto_valores
      WHERE proyecto_id = $1
        AND (tipo_proyecto = '' OR lower(btrim(tipo_proyecto)) = lower(btrim($2)))
      ORDER BY categoria, nombre, creado_en`,
    [proyecto.id, proyecto.linea],
  );
  return rows;
}

const itemSchema = z.object({
  nombre: z.string().trim().min(1, "Cada valor necesita un nombre").max(200),
  categoria: z.enum(CATEGORIAS_VALOR).optional().default("Otro"),
  unidad: z.string().trim().max(40).optional().default(""),
  cantidad: z.coerce.number().min(0).max(1_000_000),
  valorUnitario: z.coerce.number().int().min(0).max(9_000_000_000),
  tipoProyecto: z.string().trim().max(120).optional(),
  valorId: z.string().trim().max(80).nullable().optional(),
  tablaId: z.string().trim().max(80).nullable().optional(),
  filaIndice: z.coerce.number().int().min(0).nullable().optional(),
});

const crearSchema = z.object({
  items: z.array(itemSchema).min(1, "No hay valores para agregar").max(500, "Máximo 500 valores por carga"),
});

const actualizarSchema = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio").max(200).optional(),
    categoria: z.enum(CATEGORIAS_VALOR).optional(),
    unidad: z.string().trim().max(40).optional(),
    cantidad: z.coerce.number().min(0).max(1_000_000).optional(),
    valorUnitario: z.coerce.number().int().min(0).max(9_000_000_000).optional(),
    tipoProyecto: z.string().trim().max(120).optional(),
  })
  .strict()
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), {
    message: "Envía al menos un dato para actualizar",
  });

async function validarReferencias(items: z.infer<typeof itemSchema>[]) {
  const valorIds = [...new Set(items.map((item) => item.valorId).filter(Boolean))] as string[];
  const tablaIds = [...new Set(items.map((item) => item.tablaId).filter(Boolean))] as string[];

  if (valorIds.length) {
    const { rows } = await pool.query<{ total: number }>(
      "SELECT count(*)::int AS total FROM valores_referencia WHERE id = ANY($1::text[])",
      [valorIds],
    );
    if (rows[0].total !== valorIds.length) {
      throw new HttpError(400, "Alguno de los valores de referencia ya no existe.");
    }
  }
  if (tablaIds.length) {
    const { rows } = await pool.query<{ total: number }>(
      "SELECT count(*)::int AS total FROM valores_tablas WHERE id = ANY($1::text[])",
      [tablaIds],
    );
    if (rows[0].total !== tablaIds.length) {
      throw new HttpError(400, "Alguna de las tablas analizadas ya no existe.");
    }
  }
}

export const proyectoValores = Router();

proyectoValores.get(
  "/:proyectoId/valores",
  ah(async (req, res) => {
    const proyecto = await proyectoDeRuta(z.string().trim().min(1).parse(req.params.proyectoId));
    res.json({
      proyecto: { id: proyecto.id, nombre: proyecto.nombre, linea: proyecto.linea },
      valores: await listar(proyecto),
      resumen: await resumenProyecto(proyecto),
    });
  }),
);

proyectoValores.post(
  "/:proyectoId/valores",
  ah(async (req, res) => {
    const proyecto = await proyectoDeRuta(z.string().trim().min(1).parse(req.params.proyectoId));
    const datos = crearSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;

    await validarReferencias(datos.items);
    const tipos = datos.items.map((item) => tipoDeItem(item, proyecto));

    const creados = await withTx(async (db) => {
      for (const [indice, item] of datos.items.entries()) {
        await db.query(
          `INSERT INTO proyecto_valores
             (proyecto_id, valor_id, tabla_id, fila_indice, nombre, categoria, unidad,
              cantidad, valor_unitario, tipo_proyecto, origen, creado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            proyecto.id,
            item.valorId ?? null,
            item.tablaId ?? null,
            item.filaIndice ?? null,
            item.nombre,
            item.categoria,
            item.unidad,
            item.cantidad,
            item.valorUnitario,
            tipos[indice],
            item.tablaId ? "Tabla" : "Manual",
            usuario.nombre,
          ],
        );
      }
      return datos.items.length;
    });

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Creación",
      entidad: "Valor de proyecto",
      registro: proyecto.id,
      nuevo: `${creados} valor(es) agregado(s) al presupuesto`,
    });

    res.status(201).json({
      creados,
      valores: await listar(proyecto),
      resumen: await resumenProyecto(proyecto),
    });
  }),
);

proyectoValores.patch(
  "/:proyectoId/valores/:valorId",
  ah(async (req, res) => {
    const proyecto = await proyectoDeRuta(z.string().trim().min(1).parse(req.params.proyectoId));
    const valorId = z.string().uuid("Valor inválido").parse(req.params.valorId);
    const datos = actualizarSchema.parse(req.body);
    const usuario = res.locals.usuario as UsuarioSesion;

    const { rows: actuales } = await pool.query<{ nombre: string }>(
      "SELECT nombre FROM proyecto_valores WHERE id = $1 AND proyecto_id = $2",
      [valorId, proyecto.id],
    );
    if (!actuales[0]) throw new HttpError(404, "Valor del proyecto no encontrado");

    let tipoProyecto: string | undefined;
    if (datos.tipoProyecto !== undefined) {
      tipoProyecto = tipoDeItem({ nombre: datos.nombre ?? actuales[0].nombre, tipoProyecto: datos.tipoProyecto }, proyecto);
    }

    const { rows } = await pool.query(
      `UPDATE proyecto_valores SET
         nombre = COALESCE($3, nombre),
         categoria = COALESCE($4, categoria),
         unidad = COALESCE($5, unidad),
         cantidad = COALESCE($6, cantidad),
         valor_unitario = COALESCE($7, valor_unitario),
         tipo_proyecto = COALESCE($8, tipo_proyecto)
       WHERE id = $1 AND proyecto_id = $2
       RETURNING ${CAMPOS}`,
      [
        valorId,
        proyecto.id,
        datos.nombre ?? null,
        datos.categoria ?? null,
        datos.unidad ?? null,
        datos.cantidad ?? null,
        datos.valorUnitario ?? null,
        tipoProyecto ?? null,
      ],
    );

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Actualización",
      entidad: "Valor de proyecto",
      registro: proyecto.id,
      previo: actuales[0].nombre,
      nuevo: rows[0]?.nombre ?? datos.nombre ?? "",
    });

    res.json({ valor: rows[0], resumen: await resumenProyecto(proyecto) });
  }),
);

proyectoValores.delete(
  "/:proyectoId/valores/:valorId",
  ah(async (req, res) => {
    const proyecto = await proyectoDeRuta(z.string().trim().min(1).parse(req.params.proyectoId));
    const valorId = z.string().uuid("Valor inválido").parse(req.params.valorId);
    const usuario = res.locals.usuario as UsuarioSesion;

    const { rows } = await pool.query<{ nombre: string }>(
      "DELETE FROM proyecto_valores WHERE id = $1 AND proyecto_id = $2 RETURNING nombre",
      [valorId, proyecto.id],
    );
    if (!rows[0]) throw new HttpError(404, "Valor del proyecto no encontrado");

    await registrarAuditoria({
      usuario: usuario.nombre,
      accion: "Eliminación",
      entidad: "Valor de proyecto",
      registro: proyecto.id,
      previo: rows[0].nombre,
    });

    res.json({ ok: true, resumen: await resumenProyecto(proyecto) });
  }),
);
