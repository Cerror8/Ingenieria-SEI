import { Router } from "express";
import { ESTRUCTURAS, estructuraPorId } from "../lib/estructura.js";

export const estructuras = Router();

estructuras.get("/", (_req, res) => {
  res.json({ estructuras: ESTRUCTURAS });
});

estructuras.get("/:id", (req, res) => {
  const estructura = estructuraPorId(req.params.id);
  if (!estructura) {
    res.status(404).json({ error: "Estructura no encontrada" });
    return;
  }
  res.json({ estructura });
});
