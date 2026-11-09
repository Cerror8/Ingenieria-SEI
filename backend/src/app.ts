import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { requireAuth } from "./auth/session.js";
import { pool } from "./db.js";
import { ah, errorHandler } from "./http.js";
import { archivos } from "./routes/archivos.js";
import { auditoria } from "./routes/auditoria.js";
import { auth } from "./routes/auth.js";
import { calendario } from "./routes/calendario.js";
import { cron } from "./routes/cron.js";
import { dashboard } from "./routes/dashboard.js";
import { documentos } from "./routes/documentos.js";
import { formatos } from "./routes/formatos.js";
import { indicadores } from "./routes/indicadores.js";
import { informes } from "./routes/informes.js";
import { miTablero } from "./routes/mi-tablero.js";
import { notificaciones } from "./routes/notificaciones.js";
import { proyectos } from "./routes/proyectos.js";
import { tableros } from "./routes/tableros.js";
import { tareas } from "./routes/tareas.js";
import { usuarios } from "./routes/usuarios.js";
import { valores } from "./routes/valores.js";

export const app = express();

// Vercel y otros proxies: usa la IP real del cliente para el rate limit y las cookies seguras.
app.set("trust proxy", 1);

app.disable("x-powered-by");
app.use(
  helmet({
    // La CSP de la interfaz se define en vercel.json; la API solo devuelve JSON o archivos.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
  }),
);

// Límite general anti-abuso; los endpoints de acceso tienen límites más estrictos en routes/auth.ts.
const limitadorApi = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones. Espera unos minutos e inténtalo de nuevo." },
});
app.use("/api", limitadorApi);

const origenes = (process.env.CORS_ORIGIN ?? "http://localhost:5174")
  .split(",")
  .map((origen) => origen.trim())
  .filter(Boolean);

app.use(cors({ origin: origenes, credentials: true }));
app.use(express.json({ limit: "4mb" }));
app.use(cookieParser());

app.get(
  "/api/salud",
  ah(async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  }),
);

app.use("/api/auth", auth);
app.use("/api/cron", cron);

app.use("/api/dashboard", requireAuth, dashboard);
app.use("/api/proyectos", requireAuth, proyectos);
app.use("/api/indicadores", requireAuth, indicadores);
app.use("/api/documentos", requireAuth, documentos);
app.use("/api/archivos", requireAuth, archivos);
app.use("/api/informes", requireAuth, informes);
app.use("/api/auditoria", requireAuth, auditoria);
app.use("/api/tableros", requireAuth, tableros);
app.use("/api/tableros", requireAuth, tareas);
app.use("/api/mi-tablero", requireAuth, miTablero);
app.use("/api/notificaciones", requireAuth, notificaciones);
app.use("/api/calendario", requireAuth, calendario);
app.use("/api/usuarios", requireAuth, usuarios);
app.use("/api/valores", requireAuth, valores);
app.use("/api/formatos", requireAuth, formatos);

app.use(errorHandler);
