import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { pool } from "./db.js";
import { ah, errorHandler } from "./http.js";
import { auth } from "./routes/auth.js";

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
app.use(errorHandler);
