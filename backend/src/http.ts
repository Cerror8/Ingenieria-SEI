import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const ah =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof ZodError)
    return res.status(400).json({ error: "Datos inválidos", detalles: err.flatten().fieldErrors });

  const e = err as { code?: string; constraint?: string; message?: string };
  if (e.code === "23505")
    return res.status(409).json({ error: "Ya existe un registro con ese valor único." });
  if (e.code === "23503")
    return res.status(409).json({ error: "Referencia inválida a otro registro." });
  if (e.code === "23514")
    return res.status(400).json({ error: "Un valor no cumple las reglas del negocio." });

  console.error(err);
  res.status(500).json({ error: "Error interno" });
}
