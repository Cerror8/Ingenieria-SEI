import path from "node:path";
import { Router } from "express";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { ah, HttpError } from "../http.js";
import { almacenEnBlob } from "../lib/almacen.js";

const CARPETAS = ["documentos", "valores", "tareas", "paquetes"] as const;
const carpetaSchema = z.enum(CARPETAS);

const EXTENSIONES = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".ppt", ".pptx",
  ".png", ".jpg", ".jpeg", ".txt",
]);

const MAXIMO_POR_CARPETA: Record<(typeof CARPETAS)[number], number> = {
  documentos: 20 * 1024 * 1024,
  valores: 30 * 1024 * 1024,
  tareas: 20 * 1024 * 1024,
  paquetes: 100 * 1024 * 1024,
};

export const archivos = Router();

archivos.get("/config", (_req, res) => {
  res.json({ directo: almacenEnBlob });
});

archivos.post(
  "/",
  ah(async (req, res) => {
    const resultado = await handleUpload({
      request: req,
      body: req.body as HandleUploadBody,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let carpeta: (typeof CARPETAS)[number];
        try {
          const payload = JSON.parse(clientPayload ?? "{}") as { carpeta?: unknown };
          carpeta = carpetaSchema.parse(payload.carpeta);
        } catch {
          throw new HttpError(400, "Solicitud de subida no válida");
        }

        if (!pathname.startsWith(`${carpeta}/`)) throw new HttpError(400, "Ruta no permitida");

        const extension = path.extname(pathname).toLowerCase();
        const permitida =
          carpeta === "paquetes" ? extension === ".zip" : EXTENSIONES.has(extension);
        if (!permitida) throw new HttpError(400, "Formato no permitido");

        return {
          maximumSizeInBytes: MAXIMO_POR_CARPETA[carpeta],
          addRandomSuffix: false,
        };
      },
    });

    res.json(resultado);
  }),
);
