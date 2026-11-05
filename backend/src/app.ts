import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { requireAuth } from "./auth/session.js";
import { pool } from "./db.js";
import { ah, errorHandler } from "./http.js";
import { auditoria } from "./routes/auditoria.js";
import { auth } from "./routes/auth.js";
import { calendario } from "./routes/calendario.js";
import { dashboard } from "./routes/dashboard.js";
import { documentos } from "./routes/documentos.js";
import { indicadores } from "./routes/indicadores.js";
import { informes } from "./routes/informes.js";
import { notificaciones } from "./routes/notificaciones.js";
import { proyectos } from "./routes/proyectos.js";
import { tableros } from "./routes/tableros.js";

export const app = express();

const origenes = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origen) => origen.trim())
  .filter(Boolean);

app.use(cors({ origin: origenes, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get(
  "/api/salud",
  ah(async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  }),
);

app.use("/api/auth", auth);

app.use("/api/dashboard", requireAuth, dashboard);
app.use("/api/proyectos", requireAuth, proyectos);
app.use("/api/indicadores", requireAuth, indicadores);
app.use("/api/documentos", requireAuth, documentos);
app.use("/api/informes", requireAuth, informes);
app.use("/api/auditoria", requireAuth, auditoria);
app.use("/api/tableros", requireAuth, tableros);
app.use("/api/notificaciones", requireAuth, notificaciones);
app.use("/api/calendario", requireAuth, calendario);

app.use(errorHandler);
