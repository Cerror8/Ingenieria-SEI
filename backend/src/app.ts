import cors from "cors";
import express from "express";
import { pool } from "./db.js";
import { ah, errorHandler } from "./http.js";
import { proyectos } from "./routes/proyectos.js";
import { ficha } from "./routes/ficha.js";
import { seguimiento } from "./routes/seguimiento.js";

export const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/salud", ah(async (_req, res) => { await pool.query("SELECT 1"); res.json({ ok: true }); }));

// Catálogos para los selects del formulario
app.get("/api/catalogos", ah(async (_req, res) => {
  const [l, d, o, a] = await Promise.all([
    pool.query("SELECT id, nombre FROM lineas_investigacion ORDER BY nombre"),
    pool.query("SELECT id, nombre FROM dependencias ORDER BY nombre"),
    pool.query("SELECT id, nombre FROM ods ORDER BY id"),
    pool.query(`SELECT a.codigo, a.nombre, l.nombre AS linea, a.tipo_documento AS tipo, a.anio, a.nivel_estructuracion AS nivel
                  FROM antecedentes a LEFT JOIN lineas_investigacion l ON l.id = a.linea_id ORDER BY a.anio DESC`),
  ]);
  res.json({ lineas: l.rows, dependencias: d.rows, ods: o.rows, antecedentes: a.rows });
}));

app.use("/api/proyectos", proyectos);
app.use("/api/proyectos/:codigo/ficha", ficha);
app.use("/api/proyectos/:codigo", seguimiento);
app.use(errorHandler);
